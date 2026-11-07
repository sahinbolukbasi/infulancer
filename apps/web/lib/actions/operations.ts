"use server";
import { z } from "zod";
import { prisma } from "@infulancer/core/db";
import { audit } from "@infulancer/core/audit";
import { toAuditActor } from "@infulancer/core/access/actor";
import { requestBudgetChange } from "@infulancer/core/ads/budget-optimizer";
import { ensureStarterCredits, topUp } from "@infulancer/core/creative/credits";
import { CreativeRejectedError, handleFalWebhook, submitCreative } from "@infulancer/core/creative/fal";
import { ModelUnavailableError, resolveModel, seedModelRegistry } from "@infulancer/core/creative/registry";
import { getConfig, setConfig } from "@infulancer/core/config/store";
import { planGeneration, type Aspect } from "@infulancer/core/creative/adapters";
import { InsufficientCreditsError } from "@infulancer/core/creative/credits";
import { DomainError } from "@infulancer/core/domain/errors";
import type { ActionState } from "@/lib/action-state";
import { attempt, parseInput, revalidateAll, str } from "@/lib/action-utils";
import { assertPlatformAdmin, requireActor } from "@/lib/auth-guard";

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

const CREATIVE_STYLES = new Set(["Minimal", "Sinematik", "Pastel", "Neon", "Doğal ışık", "Stüdyo", "Retro", "Lüks"]);
const ASPECTS = new Set(["9:16", "1:1", "4:5", "16:9"]);
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
/**
 * Creative üretimi (tüm roller). Model gövdesi ve faturalanan birim sunucuda hesaplanır
 * (adapters.planGeneration): video süresi modele gider, ses birimi metinden sayılır,
 * oran (Story 9:16) modele parametre olarak verilir. Demo (mock) modunda sonuç simüle edilir.
 */
export async function generateCreative(_p: ActionState, fd: FormData): Promise<ActionState> {
  const actor = await requireActor("ADMIN", "BRAND", "INFLUENCER");
  return attempt(async () => {
    const input = parseInput(z.object({ modelKey: z.string().min(2).max(80), prompt: z.string().trim().min(10, { error: "İstek en az 10 karakter olmalı." }).max(4000) }), {
      modelKey: str(fd, "modelKey"),
      prompt: str(fd, "prompt"),
    });
    const tenantId = await creativeTenant(actor, fd);
    if (actor.role !== "ADMIN") await ensureStarterCredits(tenantId);
    const model = await resolveModel(input.modelKey).catch((e) => {
      throw new DomainError("KURAL_IHLALI", (e as Error).message);
    });
    const aspectRaw = str(fd, "aspect");
    const aspect = (ASPECTS.has(aspectRaw) ? aspectRaw : "9:16") as Aspect;
    const style = str(fd, "style");
    // Seslendirmede metin olduğu gibi okunur; görsel/videoda stil istemin sonuna eklenir.
    const storyHint = model.kind === "image" && aspect === "9:16" ? "Instagram Story düzeni: dikey 9:16, üst ve alt %15'te yazı ve arayüz için sade boş alan bırak" : "";
    const prompt = model.kind === "audio" ? input.prompt : [input.prompt, CREATIVE_STYLES.has(style) ? `Stil: ${style}` : "", storyHint].filter(Boolean).join(". ");
    const plan = planGeneration({ modelKey: model.key, kind: model.kind, prompt, aspect, seconds: Number(str(fd, "seconds") || "0") || undefined });
    try {
      const job = await submitCreative({ tenantId, modelKey: model.key, prompt, units: plan.units, falInput: plan.falInput, referenceImageIsPortrait: str(fd, "portrait") === "on" });
      if ((process.env.FAL_MODE ?? "mock") === "mock" && job.requestId) {
        const payload = model.kind === "video" ? { video: { url: "https://example.invalid/mock.mp4" } } : model.kind === "audio" ? { audio: { url: "https://example.invalid/mock.mp3" } } : { images: [{ url: "https://example.invalid/mock.png" }] };
        await handleFalWebhook({ request_id: job.requestId, status: "OK", payload, metrics: { inference_time: 1.2 } });
      }
      await audit.append({ actor: toAuditActor(actor), action: "CREATIVE_SUBMITTED", entityType: "CreativeJob", entityId: job.id, data: { tenantId, modelKey: model.key, units: plan.units, aspect } });
    } catch (e) {
      if (e instanceof CreativeRejectedError || e instanceof ModelUnavailableError || e instanceof InsufficientCreditsError) throw new DomainError("KURAL_IHLALI", e.message);
      throw e;
    }
    revalidateAll();
    return { ok: true, message: "Üretim başladı; hazır olunca galeriye düşer (AI etiketi gömülü)." };
  });
}

export async function topUpCredits(_p: ActionState, fd: FormData): Promise<ActionState> {
  const actor = await requireActor("ADMIN");
  return attempt(async () => {
    const input = parseInput(z.object({ tenantId: z.string().min(1).max(64), credits: z.number().int().positive().max(1_000_000) }), { tenantId: str(fd, "tenantId"), credits: Number(str(fd, "credits")) });
    const [b, i] = await Promise.all([prisma.brand.findUnique({ where: { id: input.tenantId }, select: { id: true } }), prisma.influencer.findUnique({ where: { id: input.tenantId }, select: { id: true } })]);
    if (!b && !i) throw new DomainError("BULUNAMADI", "Marka veya influencer bulunamadı.");
    await topUp(input.tenantId, input.credits, "Yönetici yüklemesi");
    await audit.append({ actor: toAuditActor(actor), action: "CREDITS_TOPPED_UP", entityType: "CreditAccount", entityId: input.tenantId, data: { credits: input.credits } });
    revalidateAll();
    return { ok: true, message: `${input.credits} kredi yüklendi.` };
  });
}

/** Yönetici: Creative fiyatlandırma ayarı (markup, en düşük ücret, kur) ve tüm model fiyatlarını yeniden hesapla. */
export async function savePricingAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const actor = await requireActor("ADMIN");
  assertPlatformAdmin(actor);
  return attempt(async () => {
    const input = parseInput(
      z.object({ markup: z.number().min(1, { error: "Markup en az 1 olmalı (maliyetin altında satılmaz)." }).max(20), minTry: z.number().min(0).max(1000), usdTry: z.number().min(1).max(1000), autoFx: z.boolean() }),
      { markup: Number(str(fd, "markup").replace(",", ".")), minTry: Number(str(fd, "minTry").replace(",", ".")), usdTry: Number(str(fd, "usdTry").replace(",", ".")), autoFx: str(fd, "autoFx") === "on" },
    );
    const cur = await getConfig("pricing.creative");
    await setConfig("pricing.creative", { ...cur, ...input, fxUpdatedAt: input.usdTry !== cur.usdTry ? new Date().toISOString() : cur.fxUpdatedAt }, true);
    await seedModelRegistry();
    await audit.append({ actor: toAuditActor(actor), action: "CREATIVE_PRICING_SAVED", entityType: "ConfigValue", entityId: "pricing.creative", data: input });
    revalidateAll();
    return { ok: true, message: "Fiyatlandırma kaydedildi; tüm model fiyatları yeniden hesaplandı." };
  });
}
