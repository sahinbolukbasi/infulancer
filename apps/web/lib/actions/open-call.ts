"use server";
import { z } from "zod";
import { redirect } from "next/navigation";
import { prisma } from "@infulancer/core/db";
import { audit } from "@infulancer/core/audit";
import { toAuditActor } from "@infulancer/core/access/actor";
import { applyToOpenCall, createOpenCall, reviewApplication, setOpenCallStatus } from "@infulancer/core/campaigns/open-call";
import { DomainError } from "@infulancer/core/domain/errors";
import type { ActionState } from "@/lib/action-state";
import { attempt, optStr, parseInput, revalidateAll, str, tlToKurus } from "@/lib/action-utils";
import { requireActor } from "@/lib/auth-guard";
import { AGENCY_TZ, isDay, zonedToUtc } from "@/lib/time";

const createSchema = z.object({
  title: z.string().min(3, { error: "Başlık en az 3 karakter." }).max(140),
  description: z.string().min(10, { error: "Açıklama en az 10 karakter." }).max(4000),
  category: z.string().max(80).optional(),
  budgetMinKurus: z.number().int().nonnegative().nullable(),
  budgetMaxKurus: z.number().int().nonnegative().nullable(),
  platforms: z.array(z.enum(["INSTAGRAM", "TIKTOK", "YOUTUBE"])).max(3),
  coverImageKey: z.string().optional(),
  deadlineDay: z.string().optional(),
});

/** Marka açık çağrı (başvuru) oluşturur. */
export async function createOpenCallAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const actor = await requireActor("ADMIN", "BRAND");
  const created: { id?: string } = {};
  const res = await attempt(async () => {
    const tenantId = actor.role === "BRAND" ? actor.brandId! : (optStr(fd, "tenantId") ?? "");
    const minRaw = str(fd, "budgetMin");
    const maxRaw = str(fd, "budgetMax");
    const dl = str(fd, "deadlineDay");
    const input = parseInput(createSchema, {
      title: str(fd, "title"),
      description: str(fd, "description"),
      category: str(fd, "category") || undefined,
      budgetMinKurus: minRaw ? tlToKurus(minRaw) : null,
      budgetMaxKurus: maxRaw ? tlToKurus(maxRaw) : null,
      platforms: fd.getAll("platforms").map(String),
      coverImageKey: str(fd, "coverImageKey") || undefined,
      deadlineDay: dl || undefined,
    });
    const call = await createOpenCall({
      tenantId,
      title: input.title,
      description: input.description,
      category: input.category,
      budgetMinKurus: input.budgetMinKurus,
      budgetMaxKurus: input.budgetMaxKurus,
      platforms: input.platforms,
      coverImageKey: input.coverImageKey,
      deadline: input.deadlineDay && isDay(input.deadlineDay) ? zonedToUtc(input.deadlineDay, "23:59", AGENCY_TZ) : null,
      createdByUserId: actor.userId,
    });
    await audit.append({ actor: toAuditActor(actor), action: "OPEN_CALL_CREATED", entityType: "CampaignOpenCall", entityId: call.id, data: { title: input.title } });
    created.id = call.id;
    revalidateAll();
    return { ok: true, message: "Başvuru çağrısı oluşturuldu (taslak)." };
  });
  if (res.ok && created.id && actor.role === "BRAND") redirect(`/marka/teklifler/cagri/${created.id}`);
  return res;
}

export async function setOpenCallStatusAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const actor = await requireActor("ADMIN", "BRAND");
  return attempt(async () => {
    const id = str(fd, "id");
    const to = str(fd, "to") as "TASLAK" | "ACIK" | "KAPALI";
    const tenantId = actor.role === "BRAND" ? actor.brandId! : (await prisma.campaignOpenCall.findUnique({ where: { id }, select: { tenantId: true } }))?.tenantId;
    if (!tenantId) throw new DomainError("BULUNAMADI", "Çağrı bulunamadı.");
    await setOpenCallStatus(tenantId, id, to);
    await audit.append({ actor: toAuditActor(actor), action: "OPEN_CALL_STATUS", entityType: "CampaignOpenCall", entityId: id, data: { to } });
    revalidateAll();
    return { ok: true, message: "Durum güncellendi." };
  });
}

/** Influencer çağrıya başvurur. */
export async function applyOpenCallAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const actor = await requireActor("INFLUENCER");
  return attempt(async () => {
    const openCallId = str(fd, "openCallId");
    const pitch = str(fd, "pitch");
    const quoteRaw = str(fd, "quote");
    const app = await applyToOpenCall({ openCallId, influencerId: actor.influencerId!, pitch, quotedKurus: quoteRaw ? tlToKurus(quoteRaw) : null });
    await audit.append({ actor: toAuditActor(actor), action: "OPEN_CALL_APPLIED", entityType: "CampaignApplication", entityId: app.id, data: { openCallId } });
    revalidateAll();
    return { ok: true, message: "Başvurunuz gönderildi." };
  });
}

export async function reviewApplicationAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const actor = await requireActor("ADMIN", "BRAND");
  return attempt(async () => {
    const id = str(fd, "id");
    const to = str(fd, "to") as "INCELENIYOR" | "KABUL" | "RED";
    const note = optStr(fd, "reviewNote");
    const tenantId = actor.role === "BRAND" ? actor.brandId! : (await prisma.campaignApplication.findUnique({ where: { id }, select: { openCall: { select: { tenantId: true } } } }))?.openCall.tenantId;
    if (!tenantId) throw new DomainError("BULUNAMADI", "Başvuru bulunamadı.");
    await reviewApplication(tenantId, id, to, note, actor.userId);
    await audit.append({ actor: toAuditActor(actor), action: "OPEN_CALL_REVIEWED", entityType: "CampaignApplication", entityId: id, data: { to } });
    revalidateAll();
    return { ok: true, message: to === "KABUL" ? "Başvuru kabul edildi; Teklifler listesine kabul edilmiş teklif olarak eklendi." : to === "RED" ? "Başvuru reddedildi." : "İncelemeye alındı." };
  });
}
