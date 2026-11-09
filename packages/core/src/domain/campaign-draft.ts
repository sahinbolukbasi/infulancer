import { audit } from "../audit";
import { toAuditActor, type Actor } from "../access/actor";
import { notifyAdmins } from "../agents/common";
import { prisma } from "../db";
import type { Platform } from "../enums";
import { audienceSchema, contentPlanSchema, draftChecks, OBJECTIVES, parseContentPlan, type Objective } from "./campaign-plan";
import { DomainError } from "./errors";
import { utmSafe } from "./utm";
import { campaignCurrency, currencyOf } from "../i18n/regions";

/**
 * Kampanya taslağı (sihirbaz) — marka ve ajans ortak kullanır.
 * Kurallar:
 *  - Marka yalnız kendi markası adına ve yalnız TASLAK durumundaki kampanyayı düzenler.
 *  - Markanın girdiği bütçe "marka bedeli"dir; influencer bütçesi/komisyon ajansın işidir (0 açılır).
 *  - Marka influencer'ı doğrudan atamaz: önerdiği influencerlar shortlist'e yazılır, ajans tek seferde atar.
 *  - Gönder: zorunlu adımlar tamamsa submittedAt yazılır ve ajansa bildirim düşer.
 */
const OBJECTIVE_TARGETS: Record<Objective, { kpi: string; target: number; weight: number; windowDays: number }[]> = {
  bilinirlik: [
    { kpi: "reach", target: 500000, weight: 2, windowDays: 30 },
    { kpi: "impressions", target: 1200000, weight: 1, windowDays: 30 },
  ],
  etkilesim: [
    { kpi: "er", target: 0.05, weight: 2, windowDays: 14 },
    { kpi: "reach", target: 200000, weight: 1, windowDays: 30 },
  ],
  satis: [
    { kpi: "sales", target: 1000, weight: 3, windowDays: 30 },
    { kpi: "click", target: 20000, weight: 1, windowDays: 30 },
  ],
  video: [
    { kpi: "views", target: 1000000, weight: 2, windowDays: 30 },
    { kpi: "er", target: 0.04, weight: 1, windowDays: 30 },
  ],
};
const DAY = 86_400_000;

function slugify(v: string): string {
  return utmSafe(v).replace(/[._]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 70) || "kampanya";
}
async function uniqueSlug(base: string): Promise<string> {
  let slug = base;
  for (let i = 2; i < 200; i++) {
    if (!(await prisma.campaign.findFirst({ where: { slug }, select: { id: true } }))) return slug;
    slug = `${base}-${i}`;
  }
  throw new DomainError("DOGRULAMA", "Benzersiz kısa ad üretilemedi.");
}

/** Düzenleme yetkisi: admin (kapanmamış), marka (kendi + TASLAK). */
export async function assertCanEditDraft(actor: Actor, campaignId: string) {
  const c = await prisma.campaign.findUnique({ where: { id: campaignId }, select: { id: true, brandId: true, status: true, submittedAt: true, name: true, executionMode: true } });
  if (!c) throw new DomainError("BULUNAMADI", "Kampanya bulunamadı.");
  if (actor.role === "ADMIN") {
    if (c.status === "KAPANDI" || c.status === "IPTAL") throw new DomainError("KURAL_IHLALI", "Kapanmış/iptal kampanya düzenlenemez.");
    return c;
  }
  if (actor.role !== "BRAND" || c.brandId !== actor.brandId) throw new DomainError("BULUNAMADI", "Kampanya bulunamadı.");
  if (c.executionMode === "SELF") {
    // Kendi yürüten marka AKTIF kampanyayı da düzenler; yalnız kapanmış/iptal engellidir.
    if (c.status === "KAPANDI" || c.status === "IPTAL") throw new DomainError("KURAL_IHLALI", "Kapanmış/iptal kampanya düzenlenemez.");
  } else if (c.status !== "TASLAK") {
    throw new DomainError("KURAL_IHLALI", "Ajansa devredilmiş ve yayına alınmış kampanyayı yalnız ajans değiştirebilir. Değişiklik için ajansa yazın.");
  }
  return c;
}

export async function createDraft(actor: Actor, input: { brandId?: string | null; name: string; objective: string; description?: string | null }) {
  if (actor.role !== "ADMIN" && actor.role !== "BRAND") throw new DomainError("YETKISIZ", "Kampanya oluşturma yetkiniz yok.");
  const brandId = actor.role === "BRAND" ? actor.brandId : input.brandId;
  if (!brandId) throw new DomainError("DOGRULAMA", "Marka seçin.");
  const brand = await prisma.brand.findUnique({ where: { id: brandId }, select: { id: true, country: true, defaultExecutionMode: true } });
  if (!brand) throw new DomainError("DOGRULAMA", "Marka bulunamadı.");
  const name = input.name.trim();
  if (name.length < 3 || name.length > 140) throw new DomainError("DOGRULAMA", "Kampanya adı 3–140 karakter olmalı.");
  const objective = OBJECTIVES.find((o) => o.id === input.objective)?.id;
  if (!objective) throw new DomainError("DOGRULAMA", "Kampanyanın amacını seçin.");
  const start = new Date(Math.ceil(Date.now() / DAY) * DAY + 7 * DAY);
  const c = await prisma.campaign.create({
    data: {
      brandId,
      name,
      slug: await uniqueSlug(slugify(name)),
      objective,
      description: input.description?.trim().slice(0, 4000) || null,
      budgetKurus: 0,
      brandTotalFeeKurus: 0,
      startsAt: start,
      endsAt: new Date(start.getTime() + 30 * DAY - 60_000),
      targets: OBJECTIVE_TARGETS[objective],
      status: "TASLAK",
      executionMode: actor.role === "BRAND" ? brand.defaultExecutionMode : "AJANS",
      createdById: actor.userId,
      // Varsayılan bölge markanın ülkesi; hedef kitle adımında değişir.
      targetCountries: [brand.country],
      currency: currencyOf(brand.country),
    },
  });
  await audit.append({ actor: toAuditActor(actor), action: "CAMPAIGN_CREATED", entityType: "Campaign", entityId: c.id, data: { brandId, name, objective, via: "wizard" } });
  return c;
}

export async function updateBasics(actor: Actor, id: string, input: { name: string; objective: string; description?: string | null }) {
  await assertCanEditDraft(actor, id);
  const name = input.name.trim();
  if (name.length < 3 || name.length > 140) throw new DomainError("DOGRULAMA", "Kampanya adı 3–140 karakter olmalı.");
  const objective = OBJECTIVES.find((o) => o.id === input.objective)?.id;
  if (!objective) throw new DomainError("DOGRULAMA", "Kampanyanın amacını seçin.");
  const prev = await prisma.campaign.findUniqueOrThrow({ where: { id }, select: { objective: true } });
  await prisma.campaign.update({
    where: { id },
    data: { name, objective, description: input.description?.trim().slice(0, 4000) || null, ...(prev.objective !== objective ? { targets: OBJECTIVE_TARGETS[objective] } : {}) },
  });
  await audit.append({ actor: toAuditActor(actor), action: "CAMPAIGN_UPDATED", entityType: "Campaign", entityId: id, data: { step: "temel", name, objective } });
}

export async function updateAudience(actor: Actor, id: string, raw: unknown) {
  await assertCanEditDraft(actor, id);
  const r = audienceSchema.safeParse(raw);
  if (!r.success) throw new DomainError("DOGRULAMA", r.error.issues[0]?.message ?? "Hedef kitle geçersiz.");
  const c = await prisma.campaign.findUniqueOrThrow({ where: { id }, select: { brand: { select: { country: true } } } });
  const { currency, mixed } = campaignCurrency(r.data.targetCountries, c.brand.country);
  if (mixed) throw new DomainError("DOGRULAMA", "Seçilen ülkelerin para birimleri farklı (ör. TRY ve EUR). Tutarlar çevrilmediği için her para birimi bölgesine ayrı kampanya açın.");
  await prisma.campaign.update({ where: { id }, data: { ...r.data, platforms: r.data.platforms as Platform[], currency } });
  await audit.append({ actor: toAuditActor(actor), action: "CAMPAIGN_UPDATED", entityType: "Campaign", entityId: id, data: { step: "kitle", ...r.data } });
}

/** Tarih (UTC, çağıran saat dilimine çevirmiş olmalı) ve bütçe. Marka yalnız marka bedelini girer. */
export async function updateSchedule(actor: Actor, id: string, input: { startsAt: Date; endsAt: Date; brandTotalFeeKurus: number; budgetKurus?: number | null }) {
  await assertCanEditDraft(actor, id);
  if (!(input.endsAt > input.startsAt)) throw new DomainError("DOGRULAMA", "Bitiş tarihi başlangıçtan sonra olmalı.");
  if (!Number.isInteger(input.brandTotalFeeKurus) || input.brandTotalFeeKurus <= 0) throw new DomainError("DOGRULAMA", "Toplam bütçeyi girin.");
  const data: { startsAt: Date; endsAt: Date; brandTotalFeeKurus: bigint; budgetKurus?: bigint } = {
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    brandTotalFeeKurus: BigInt(input.brandTotalFeeKurus),
  };
  if (actor.role === "ADMIN" && input.budgetKurus != null) {
    if (!Number.isInteger(input.budgetKurus) || input.budgetKurus < 0) throw new DomainError("DOGRULAMA", "Influencer bütçesi geçersiz.");
    data.budgetKurus = BigInt(input.budgetKurus);
  }
  await prisma.campaign.update({ where: { id }, data });
  await audit.append({ actor: toAuditActor(actor), action: "CAMPAIGN_UPDATED", entityType: "Campaign", entityId: id, data: { step: "butce", startsAt: input.startsAt.toISOString(), endsAt: input.endsAt.toISOString(), brandTotalFeeKurus: input.brandTotalFeeKurus } });
}

export async function updateContentPlan(actor: Actor, id: string, raw: unknown) {
  await assertCanEditDraft(actor, id);
  const r = contentPlanSchema.safeParse(raw);
  if (!r.success) throw new DomainError("DOGRULAMA", r.error.issues[0]?.message ?? "İçerik planı geçersiz.");
  if (r.data.length === 0) throw new DomainError("DOGRULAMA", "En az bir içerik satırı ekleyin.");
  await prisma.campaign.update({ where: { id }, data: { contentPlan: r.data } });
  await audit.append({ actor: toAuditActor(actor), action: "CAMPAIGN_UPDATED", entityType: "Campaign", entityId: id, data: { step: "icerik", items: r.data.length } });
}

/** Brief: her kayıt yeni sürüm (ajans formuyla aynı kural). */
export async function saveDraftBrief(
  actor: Actor,
  id: string,
  input: { text: string; dos: string[]; donts: string[]; hashtags: string[]; mentions: string[]; disclosureRequired: boolean },
) {
  await assertCanEditDraft(actor, id);
  if (input.text.trim().length < 10) throw new DomainError("DOGRULAMA", "Brief metni en az 10 karakter olmalı.");
  if (input.hashtags.some((h) => !/^#[\p{L}\p{N}_]+$/u.test(h))) throw new DomainError("DOGRULAMA", "Etiketler # ile başlamalı (boşluksuz).");
  if (input.mentions.some((m) => !/^@[\w.]+$/u.test(m))) throw new DomainError("DOGRULAMA", "Bahsetmeler @ ile başlamalı.");
  const last = await prisma.campaignBrief.findFirst({ where: { campaignId: id }, orderBy: { version: "desc" }, select: { version: true } });
  const version = (last?.version ?? 0) + 1;
  const b = await prisma.campaignBrief.create({
    data: {
      campaignId: id,
      version,
      text: input.text.trim().slice(0, 20_000),
      dos: input.dos.slice(0, 50),
      donts: input.donts.slice(0, 50),
      hashtags: input.hashtags.slice(0, 30),
      mentions: input.mentions.slice(0, 30),
      requiredPhrases: [],
      bannedPhrases: [],
      disclosureRequired: input.disclosureRequired,
      createdById: actor.userId,
    },
  });
  await audit.append({ actor: toAuditActor(actor), action: "BRIEF_VERSION_CREATED", entityType: "CampaignBrief", entityId: b.id, data: { campaignId: id, version } });
  return version;
}

/** Markanın önerdiği influencerlar (toplu). Yalnız var olan ve vitrinde görünen influencerlar kabul edilir. */
export async function updateShortlist(actor: Actor, id: string, influencerIds: string[]) {
  await assertCanEditDraft(actor, id);
  const unique = [...new Set(influencerIds)].slice(0, 200);
  const found = await prisma.influencer.findMany({
    where: { id: { in: unique }, ...(actor.role === "BRAND" ? { showcaseVisible: true } : {}) },
    select: { id: true },
  });
  const ok = new Set(found.map((f) => f.id));
  const ids = unique.filter((i) => ok.has(i));
  await prisma.campaign.update({ where: { id }, data: { shortlistInfluencerIds: ids } });
  await audit.append({ actor: toAuditActor(actor), action: "CAMPAIGN_UPDATED", entityType: "Campaign", entityId: id, data: { step: "influencer", count: ids.length } });
  return ids.length;
}

export async function draftStatus(id: string) {
  const c = await prisma.campaign.findUniqueOrThrow({
    where: { id },
    include: {
      _count: { select: { briefs: true, assets: { where: { uploadStatus: "TAMAM" } } } },
      assignments: { where: { contractStatus: { not: "RED" } }, select: { id: true } },
    },
  });
  const checks = draftChecks({
    name: c.name,
    objective: c.objective,
    targetCountries: c.targetCountries,
    platforms: c.platforms,
    brandTotalFeeKurus: c.brandTotalFeeKurus,
    startsAt: c.startsAt,
    endsAt: c.endsAt,
    contentPlan: c.contentPlan,
    briefCount: c._count.briefs,
    mediaCount: c._count.assets,
    influencerCount: new Set([...c.shortlistInfluencerIds, ...c.assignments.map((a) => a.id)]).size,
  });
  return { campaign: c, checks, ready: checks.every((x) => x.ok), plan: parseContentPlan(c.contentPlan) };
}

/** Marka: kampanyayı ajansa gönderir. Ajans: taslağı kuruluma hazır işaretler. */
export async function submitDraft(actor: Actor, id: string) {
  const c = await assertCanEditDraft(actor, id);
  const { ready, checks } = await draftStatus(id);
  if (!ready) {
    const missing = checks.filter((x) => !x.ok).map((x) => x.note);
    throw new DomainError("DOGRULAMA", `Göndermeden önce tamamlayın: ${missing.join(", ")}.`);
  }
  const first = !c.submittedAt;
  await prisma.campaign.update({ where: { id }, data: { submittedAt: new Date() } });
  await audit.append({ actor: toAuditActor(actor), action: "CAMPAIGN_SUBMITTED", entityType: "Campaign", entityId: id, data: { by: actor.role, first, mode: c.executionMode } });
  // Yalnız AJANS moduna devredilmiş kampanyada ajansa kurulum bildirimi düşer; SELF'te marka kendi kurar.
  if (actor.role === "BRAND" && c.executionMode === "AJANS") {
    await notifyAdmins(first ? "Markadan yeni kampanya" : "Marka kampanyayı güncelledi", `"${c.name}" kampanyası kuruluma hazır: influencer ataması, bedeller ve yayın kontrolü.`, `/admin/kampanyalar/${id}/kurulum?adim=influencerlar`);
  }
  return { first, mode: c.executionMode };
}
