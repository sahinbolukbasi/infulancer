"use server";
import { z } from "zod";
import { audit } from "@infulancer/core/audit";
import { toAuditActor } from "@infulancer/core/access/actor";
import { prisma } from "@infulancer/core/db";
import { DomainError } from "@infulancer/core/domain/errors";
import type { ActionState } from "@/lib/action-state";
import { attempt, optStr, parseInput, str, tlToKurus } from "@/lib/action-utils";
import { requireActor } from "@/lib/auth-guard";
import { copilotAnswer, copilotWelcome, type CopilotAnswer, type CopilotWelcome } from "@/lib/copilot";
import { notifyAdmins } from "@/lib/notify";
import { isDay } from "@/lib/time";

/** Basit istek sınırı: kullanıcı başına dakikada 20 mesaj (süreç içi; çok görevli ortamda yaklaşık). */
const hits = new Map<string, number[]>();
function rateLimited(userId: string): boolean {
  const now = Date.now();
  const arr = (hits.get(userId) ?? []).filter((t) => now - t < 60_000);
  arr.push(now);
  hits.set(userId, arr);
  return arr.length > 20;
}

const askSchema = z.object({
  message: z.string().trim().min(1).max(1000),
  history: z.array(z.object({ role: z.enum(["user", "assistant"]), text: z.string().max(2000) })).max(12),
});

export async function askCopilot(input: unknown): Promise<CopilotAnswer | { error: string }> {
  const actor = await requireActor("ADMIN", "BRAND", "INFLUENCER");
  const parsed = askSchema.safeParse(input);
  if (!parsed.success) return { error: "Mesaj 1–1000 karakter olmalı." };
  if (rateLimited(actor.userId)) return { error: "Çok hızlı mesaj gönderdiniz; bir dakika sonra tekrar deneyin." };
  return copilotAnswer(actor, parsed.data.message, parsed.data.history);
}

export async function getCopilotWelcome(): Promise<CopilotWelcome> {
  const actor = await requireActor("ADMIN", "BRAND", "INFLUENCER");
  return copilotWelcome(actor);
}

const requestSchema = z
  .object({
    title: z.string().trim().min(3, { error: "Kampanya adı en az 3 karakter." }).max(140),
    goal: z.string().trim().min(10, { error: "Hedefi biraz daha açık yazın (en az 10 karakter)." }).max(2000),
    startsAt: z.string().refine(isDay, { error: "Geçerli bir başlangıç tarihi girin." }),
    endsAt: z.string().refine(isDay, { error: "Geçerli bir bitiş tarihi girin." }),
    budgetKurus: z.number().int().nonnegative().nullable(),
    platforms: z.array(z.enum(["INSTAGRAM", "TIKTOK", "YOUTUBE"])).max(3),
  })
  .refine((v) => v.endsAt >= v.startsAt, { error: "Bitiş tarihi başlangıçtan önce olamaz.", path: ["endsAt"] });

/** Marka kampanya talebi: ajans adminlerine bildirim + denetim kaydı. Kampanyayı ajans oluşturur. */
export async function requestCampaignAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const actor = await requireActor("BRAND");
  return attempt(async () => {
    if (!actor.brandId) throw new DomainError("YETKISIZ", "Hesabınız bir markaya bağlı değil.");
    const budget = optStr(fd, "budget");
    const input = parseInput(
      requestSchema,
      {
        title: str(fd, "title"),
        goal: str(fd, "goal"),
        startsAt: str(fd, "startsAt"),
        endsAt: str(fd, "endsAt"),
        budgetKurus: budget ? tlToKurus(budget) : null,
        platforms: fd.getAll("platforms").map(String),
      },
      { title: "Kampanya adı", goal: "Hedef", startsAt: "Başlangıç", endsAt: "Bitiş", budgetKurus: "Bütçe" },
    );
    const brandId = actor.brandId;
    await prisma.$transaction(async (tx) => {
      const brand = await tx.brand.findUniqueOrThrow({ where: { id: brandId }, select: { name: true } });
      await audit.append({ actor: toAuditActor(actor), action: "CAMPAIGN_REQUESTED", entityType: "Brand", entityId: brandId, data: input });
      await notifyAdmins(tx, {
        title: `Kampanya talebi: ${brand.name}`,
        body: `“${input.title}” · ${input.startsAt} – ${input.endsAt}${input.budgetKurus != null ? ` · bütçe ~${(input.budgetKurus / 100).toLocaleString("tr-TR")} TL` : ""}${input.platforms.length ? ` · ${input.platforms.join(", ")}` : ""}. Hedef: ${input.goal.slice(0, 300)}`,
        href: `/admin/kampanyalar/yeni?marka=${brandId}`,
      });
    });
    return { ok: true, message: "Talebiniz ajansa iletildi. Taslak hazırlandığında onayınıza sunulacak." };
  });
}
