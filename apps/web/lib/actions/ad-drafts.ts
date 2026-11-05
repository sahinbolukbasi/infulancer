"use server";
import { z } from "zod";
import { prisma } from "@infulancer/core/db";
import { audit } from "@infulancer/core/audit";
import { toAuditActor } from "@infulancer/core/access/actor";
import { createAdDraft, createAdDraftsBulk, objectivesFor, transitionAdDraft, type AdPlatform } from "@infulancer/core/ads/drafts";
import { DomainError } from "@infulancer/core/domain/errors";
import type { ActionState } from "@/lib/action-state";
import { attempt, parseInput, revalidateAll, str, tlToKurus } from "@/lib/action-utils";
import { requireActor } from "@/lib/auth-guard";

const platforms = ["META", "TIKTOK"] as const;
const objectiveKeys = [...new Set(["META", "TIKTOK"].flatMap((p) => objectivesFor(p as AdPlatform).map((o) => o.key)))] as [string, ...string[]];

async function resolveTenant(fd: FormData, role: "ADMIN" | "BRAND", brandId?: string | null): Promise<string> {
  const tenantId = role === "BRAND" ? brandId! : str(fd, "tenantId");
  if (!(await prisma.brand.findUnique({ where: { id: tenantId }, select: { id: true } }))) throw new DomainError("BULUNAMADI", "Marka bulunamadı.");
  return tenantId;
}

const createSchema = z.object({
  platform: z.enum(platforms),
  name: z.string().min(2, { error: "Reklam adı en az 2 karakter." }).max(120),
  objective: z.enum(objectiveKeys),
  dailyBudgetKurus: z.number().int().min(1000, { error: "Günlük bütçe en az 10 TL." }),
  primaryText: z.string().min(1, { error: "Reklam metni gerekli." }).max(2000),
  assetId: z.string().optional(),
});

/** Tek reklam taslağı oluştur (Creative çıktısından ya da sıfırdan). */
export async function createAdDraftAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const actor = await requireActor("ADMIN", "BRAND");
  return attempt(async () => {
    const tenantId = await resolveTenant(fd, actor.role as "ADMIN" | "BRAND", actor.brandId);
    const input = parseInput(createSchema, {
      platform: str(fd, "platform"),
      name: str(fd, "name"),
      objective: str(fd, "objective"),
      dailyBudgetKurus: tlToKurus(str(fd, "dailyBudgetTl")),
      primaryText: str(fd, "primaryText"),
      assetId: str(fd, "assetId") || undefined,
    });
    const d = await createAdDraft({ ...input, tenantId, createdByUserId: actor.userId });
    await audit.append({ actor: toAuditActor(actor), action: "AD_DRAFT_CREATED", entityType: "AdDraft", entityId: d.id, data: { platform: input.platform, objective: input.objective } });
    revalidateAll();
    return { ok: true, message: "Reklam taslağı oluşturuldu (henüz yayınlanmadı)." };
  });
}

const bulkSchema = z.object({
  name: z.string().min(2).max(120),
  objective: z.enum(objectiveKeys),
  dailyBudgetKurus: z.number().int().min(1000, { error: "Günlük bütçe en az 10 TL." }),
  primaryText: z.string().min(1).max(2000),
  assetId: z.string().optional(),
  platforms: z.array(z.enum(platforms)).min(1, { error: "En az bir platform seçin." }),
});

/** Toplu kampanya: tek formla birden çok platformda taslak oluştur. */
export async function createAdDraftsBulkAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const actor = await requireActor("ADMIN", "BRAND");
  return attempt(async () => {
    const tenantId = await resolveTenant(fd, actor.role as "ADMIN" | "BRAND", actor.brandId);
    const input = parseInput(bulkSchema, {
      name: str(fd, "name"),
      objective: str(fd, "objective"),
      dailyBudgetKurus: tlToKurus(str(fd, "dailyBudgetTl")),
      primaryText: str(fd, "primaryText"),
      assetId: str(fd, "assetId") || undefined,
      platforms: fd.getAll("platforms").map(String),
    });
    const { batchId, drafts } = await createAdDraftsBulk(
      { tenantId, name: input.name, objective: input.objective, dailyBudgetKurus: input.dailyBudgetKurus, primaryText: input.primaryText, assetId: input.assetId ?? null, createdByUserId: actor.userId },
      input.platforms as AdPlatform[],
    );
    await audit.append({ actor: toAuditActor(actor), action: "AD_DRAFT_BULK_CREATED", entityType: "AdDraft", entityId: batchId, data: { count: drafts.length, platforms: input.platforms } });
    revalidateAll();
    return { ok: true, message: `${drafts.length} reklam taslağı oluşturuldu (${input.platforms.join(", ")}).` };
  });
}

const statusSchema = z.object({
  id: z.string().min(1),
  to: z.enum(["TASLAK", "ONAY_BEKLIYOR", "ONAYLANDI", "REDDEDILDI"]),
  reviewNote: z.string().max(500).optional(),
});

/** Taslak durum geçişi. Onaya gönderme marka+admin; onay/ret yalnız admin. */
export async function transitionAdDraftAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const actor = await requireActor("ADMIN", "BRAND");
  return attempt(async () => {
    const input = parseInput(statusSchema, { id: str(fd, "id"), to: str(fd, "to"), reviewNote: str(fd, "reviewNote") || undefined });
    if ((input.to === "ONAYLANDI" || input.to === "REDDEDILDI") && actor.role !== "ADMIN") {
      throw new DomainError("KURAL_IHLALI", "Onay/ret yalnız yöneticide.");
    }
    const tenantId = actor.role === "BRAND" ? actor.brandId! : (await prisma.adDraft.findUnique({ where: { id: input.id }, select: { tenantId: true } }))?.tenantId;
    if (!tenantId) throw new DomainError("BULUNAMADI", "Reklam taslağı bulunamadı.");
    const d = await transitionAdDraft(tenantId, input.id, input.to, input.reviewNote);
    await audit.append({ actor: toAuditActor(actor), action: "AD_DRAFT_TRANSITION", entityType: "AdDraft", entityId: d.id, data: { to: input.to } });
    revalidateAll();
    const labels: Record<string, string> = { ONAY_BEKLIYOR: "onaya gönderildi", ONAYLANDI: "onaylandı", REDDEDILDI: "reddedildi", TASLAK: "taslağa alındı" };
    return { ok: true, message: `Reklam ${labels[input.to]}.` };
  });
}
