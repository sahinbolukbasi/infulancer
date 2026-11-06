"use server";
import { z } from "zod";
import { prisma } from "@infulancer/core/db";
import { audit } from "@infulancer/core/audit";
import { toAuditActor } from "@infulancer/core/access/actor";
import { requestBudgetChange } from "@infulancer/core/ads/budget-optimizer";
import { ensureStarterCredits, topUp } from "@infulancer/core/creative/credits";
import { CreativeRejectedError, handleFalWebhook, submitCreative } from "@infulancer/core/creative/fal";
import { ModelUnavailableError } from "@infulancer/core/creative/registry";
import { InsufficientCreditsError } from "@infulancer/core/creative/credits";
import { DomainError } from "@infulancer/core/domain/errors";
import type { ActionState } from "@/lib/action-state";
import { attempt, parseInput, revalidateAll, str } from "@/lib/action-utils";
import { requireActor } from "@/lib/auth-guard";

/** Reklam: ad set bütçe değişikliği isteği — limit aşılırsa reddedilmez, sonraki saate ötelenir. */
export async function requestAdBudget(_p: ActionState, fd: FormData): Promise<ActionState> {
  const actor = await requireActor("ADMIN");
  return attempt(async () => {
    const input = parseInput(z.object({ tenantId: z.string().min(1).max(64), adSetId: z.string().regex(/^\d{5,30}$/, { error: "Ad set ID yalnız rakamlardan oluşur." }), budget: z.number().positive().max(10_000_000) }), {
      tenantId: str(fd, "tenantId"),
      adSetId: str(fd, "adSetId"),
      budget: Number(str(fd, "budget").replace(",", ".")),
    });
    // Marketing API bağlantısı kurulana kadar uygulama adımı kayıt altına alınır (gerçek çağrı yok).
    const d = await requestBudgetChange({ tenantId: input.tenantId, adSetId: input.adSetId, newBudgetMinor: Math.round(input.budget * 100) });
    await audit.append({ actor: toAuditActor(actor), action: "AD_BUDGET_REQUESTED", entityType: "AdSet", entityId: input.adSetId, data: { budget: input.budget, status: d.status, scheduledFor: d.scheduledFor.toISOString() } });
    revalidateAll();
    return d.status === "applied"
      ? { ok: true, message: "Bütçe değişikliği uygulandı." }
      : { ok: true, message: `Limit nedeniyle ötelendi: ${d.scheduledFor.toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" })}. ${d.reason ?? ""}` };
  });
}

/** Creative format/stil seçenekleri: istemin sonuna eklenir (model tek bir metin istemi alır). */
const CREATIVE_FORMATS: Record<string, string> = { dikey: "9:16 dikey (Reels, TikTok, Story)", kare: "1:1 kare (akış gönderisi)", yatay: "16:9 yatay (YouTube, web)" };
const CREATIVE_STYLES = new Set(["Minimal", "Sinematik", "Pastel", "Neon", "Doğal ışık", "Stüdyo", "Retro", "Lüks"]);
/** Kimin adına üretileceği: marka/influencer kendi hesabına; ajans/yönetici seçtiği marka veya influencer'a. */
async function creativeTenant(actor: Awaited<ReturnType<typeof requireActor>>, fd: FormData): Promise<string> {
  if (actor.role === "BRAND") return actor.brandId!;
  if (actor.role === "INFLUENCER") return actor.influencerId!;
  const tenantId = str(fd, "tenantId");
  if (!tenantId) throw new DomainError("DOGRULAMA", "Kimin adına üretileceğini seçin.");
  const [b, i] = await Promise.all([prisma.brand.findUnique({ where: { id: tenantId }, select: { id: true } }), prisma.influencer.findUnique({ where: { id: tenantId }, select: { id: true } })]);
  if (!b && !i) throw new DomainError("BULUNAMADI", "Marka veya influencer bulunamadı.");
  return tenantId;
}
/** Creative üretimi (tüm roller). Demo (mock) modunda fal webhook'u beklemeden sonuç simüle edilir. */
export async function generateCreative(_p: ActionState, fd: FormData): Promise<ActionState> {
  const actor = await requireActor("ADMIN", "BRAND", "INFLUENCER");
  return attempt(async () => {
    const input = parseInput(z.object({ modelKey: z.string().min(2).max(80), prompt: z.string().trim().min(10, { error: "İstek en az 10 karakter olmalı." }).max(2000), units: z.number().positive().max(10_000) }), {
      modelKey: str(fd, "modelKey"),
      prompt: str(fd, "prompt"),
      units: Number(str(fd, "units") || "1"),
    });
    const tenantId = await creativeTenant(actor, fd);
    if (actor.role !== "ADMIN") await ensureStarterCredits(tenantId);
    const format = CREATIVE_FORMATS[str(fd, "format")];
    const style = str(fd, "style");
    const prompt = [input.prompt, format ? `Format: ${format}` : "", CREATIVE_STYLES.has(style) ? `Stil: ${style}` : ""].filter(Boolean).join(". ");
    try {
      const job = await submitCreative({ tenantId, modelKey: input.modelKey, prompt, units: input.units, referenceImageIsPortrait: str(fd, "portrait") === "on" });
      if ((process.env.FAL_MODE ?? "mock") === "mock" && job.requestId) {
        await handleFalWebhook({ request_id: job.requestId, status: "OK", payload: { images: [{ url: "https://example.invalid/mock.png" }] }, metrics: { inference_time: 1.2 } });
      }
      await audit.append({ actor: toAuditActor(actor), action: "CREATIVE_SUBMITTED", entityType: "CreativeJob", entityId: job.id, data: { tenantId, modelKey: input.modelKey, units: input.units } });
    } catch (e) {
      if (e instanceof CreativeRejectedError || e instanceof ModelUnavailableError || e instanceof InsufficientCreditsError) throw new DomainError("KURAL_IHLALI", e.message);
      throw e;
    }
    revalidateAll();
    return { ok: true, message: "Üretim tamamlandı; galeriye eklendi (AI etiketi gömülü)." };
  });
}

export async function topUpCredits(_p: ActionState, fd: FormData): Promise<ActionState> {
  const actor = await requireActor("ADMIN");
  return attempt(async () => {
    const input = parseInput(z.object({ tenantId: z.string().min(1).max(64), credits: z.number().int().positive().max(1_000_000) }), { tenantId: str(fd, "tenantId"), credits: Number(str(fd, "credits")) });
    const [b, i] = await Promise.all([prisma.brand.findUnique({ where: { id: input.tenantId }, select: { id: true } }), prisma.influencer.findUnique({ where: { id: input.tenantId }, select: { id: true } })]);
    if (!b && !i) throw new DomainError("BULUNAMADI", "Marka veya influencer bulunamadı.");
    await topUp(input.tenantId, input.credits);
    await audit.append({ actor: toAuditActor(actor), action: "CREDITS_TOPPED_UP", entityType: "CreditAccount", entityId: input.tenantId, data: { credits: input.credits } });
    revalidateAll();
    return { ok: true, message: `${input.credits} kredi yüklendi.` };
  });
}
