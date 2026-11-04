import { z } from "zod";
import { prisma, type ContentType, type Platform, type Prisma } from "../db";
import { DomainError } from "./errors";
import { assertContentType } from "./platform-rules";

/**
 * Fiyat listesi ve teklifler: içerik üreticisi platform × içerik türü fiyatlarını girer; marka
 * seçtiği üreticilere teklif gönderir; üretici kabul/red eder. Kabul edilen teklif ajans tarafından
 * kampanyaya atamaya dönüştürülür (marka çakışması ve münhasırlık kuralları orada uygulanır).
 */
export const OFFER_STATUSES = ["GONDERILDI", "KABUL", "RED", "GERI_CEKILDI", "SURESI_DOLDU", "KAMPANYAYA_EKLENDI"] as const;
export type OfferStatus = (typeof OFFER_STATUSES)[number];
export const offerStatusLabels: Record<OfferStatus, string> = {
  GONDERILDI: "Yanıt bekliyor",
  KABUL: "Kabul edildi",
  RED: "Reddedildi",
  GERI_CEKILDI: "Geri çekildi",
  SURESI_DOLDU: "Süresi doldu",
  KAMPANYAYA_EKLENDI: "Kampanyaya eklendi",
};
export const OFFER_TTL_DAYS = 7;

const item = z.object({
  platform: z.enum(["INSTAGRAM", "TIKTOK", "YOUTUBE"]),
  contentType: z.string().min(2).max(30),
  qty: z.number().int().min(1).max(20),
  priceKurus: z.number().int().min(0).max(1_000_000_000),
});
export const offerItemsSchema = z.array(item).min(1, { error: "En az bir içerik seçin." }).max(12);
export type OfferItem = z.infer<typeof item>;

export function offerTotal(items: OfferItem[]): number {
  return items.reduce((s, i) => s + i.qty * i.priceKurus, 0);
}

/** Fiyat listesini toplu kaydeder; fiyatı boş/0 olan satır kapatılır. İçerik türü platforma uygun olmalı. */
export async function saveRateCard(influencerId: string, rows: { platform: Platform; contentType: ContentType; priceKurus: number | null; note?: string | null }[]) {
  for (const r of rows) assertContentType(r.platform, r.contentType);
  await prisma.$transaction(async (tx) => {
    for (const r of rows) {
      const where = { influencerId_platform_contentType: { influencerId, platform: r.platform, contentType: r.contentType } };
      if (!r.priceKurus) {
        await tx.rateCard.updateMany({ where: { influencerId, platform: r.platform, contentType: r.contentType }, data: { active: false } });
        continue;
      }
      await tx.rateCard.upsert({
        where,
        create: { influencerId, platform: r.platform, contentType: r.contentType, priceKurus: r.priceKurus, note: r.note ?? null },
        update: { priceKurus: r.priceKurus, note: r.note ?? null, active: true },
      });
    }
  });
}

export type OfferInput = { brandId: string; createdById: string; influencerIds: string[]; title: string; message: string; publishBy: Date | null; campaignId: string | null; items: OfferItem[]; perInfluencerPricing: boolean };

/**
 * Teklif gönderimi: her üretici için ayrı teklif. `perInfluencerPricing` açıksa birim fiyat o üreticinin
 * fiyat listesinden alınır (listede yoksa formdaki fiyat). Aynı markadan bekleyen teklifi olan üreticiye tekrar gönderilmez.
 */
export async function sendOffers(input: OfferInput, now = new Date()): Promise<{ created: { id: string; influencerId: string }[]; skipped: { influencerId: string; reason: string }[] }> {
  const items = offerItemsSchema.parse(input.items);
  for (const i of items) assertContentType(i.platform as Platform, i.contentType as ContentType);
  if (input.campaignId) {
    const c = await prisma.campaign.findFirst({ where: { id: input.campaignId, brandId: input.brandId, status: { in: ["TASLAK", "AKTIF"] } }, select: { id: true } });
    if (!c) throw new DomainError("DOGRULAMA", "Kampanya bulunamadı veya kapalı.");
  }
  const ids = [...new Set(input.influencerIds)].slice(0, 50);
  const [cards, pending] = await Promise.all([
    prisma.rateCard.findMany({ where: { influencerId: { in: ids }, active: true } }),
    prisma.offer.findMany({ where: { brandId: input.brandId, influencerId: { in: ids }, status: "GONDERILDI", expiresAt: { gt: now } }, select: { influencerId: true } }),
  ]);
  const busy = new Set(pending.map((p) => p.influencerId));
  const created: { id: string; influencerId: string }[] = [];
  const skipped: { influencerId: string; reason: string }[] = [];
  const expiresAt = new Date(now.getTime() + OFFER_TTL_DAYS * 86_400_000);
  for (const influencerId of ids) {
    if (busy.has(influencerId)) {
      skipped.push({ influencerId, reason: "Yanıt bekleyen bir teklifiniz var." });
      continue;
    }
    const priced = items.map((i) => {
      const card = input.perInfluencerPricing ? cards.find((c) => c.influencerId === influencerId && c.platform === i.platform && c.contentType === i.contentType) : null;
      return { ...i, priceKurus: card?.priceKurus ?? i.priceKurus };
    });
    const total = offerTotal(priced);
    if (total <= 0) {
      skipped.push({ influencerId, reason: "Fiyat belirlenemedi (fiyat listesi boş)." });
      continue;
    }
    const o = await prisma.offer.create({
      data: {
        brandId: input.brandId,
        influencerId,
        createdById: input.createdById,
        campaignId: input.campaignId,
        title: input.title,
        message: input.message,
        items: priced as unknown as Prisma.InputJsonValue,
        totalKurus: total,
        publishBy: input.publishBy,
        expiresAt,
      },
    });
    created.push({ id: o.id, influencerId });
  }
  return { created, skipped };
}

/** Üretici yanıtı: yalnız kendi, süresi dolmamış, yanıt bekleyen teklif. */
export async function respondOffer(offerId: string, influencerId: string, decision: "KABUL" | "RED", note: string | null, now = new Date()) {
  const o = await prisma.offer.findUnique({ where: { id: offerId } });
  if (!o || o.influencerId !== influencerId) throw new DomainError("BULUNAMADI", "Teklif bulunamadı.");
  if (o.status !== "GONDERILDI") throw new DomainError("GECERSIZ_GECIS", "Bu teklif artık yanıtlanamaz.");
  if (o.expiresAt <= now) {
    await prisma.offer.update({ where: { id: o.id }, data: { status: "SURESI_DOLDU" } });
    throw new DomainError("GECERSIZ_GECIS", "Teklifin süresi doldu.");
  }
  if (decision === "RED" && (!note || note.trim().length < 3)) throw new DomainError("DOGRULAMA", "Reddederken kısa bir not yazın.");
  return prisma.offer.update({ where: { id: o.id }, data: { status: decision, responseNote: note, respondedAt: now } });
}

/** Marka teklifi geri çeker (yalnız yanıt bekleyen). */
export async function withdrawOffer(offerId: string, brandId: string) {
  const o = await prisma.offer.findUnique({ where: { id: offerId } });
  if (!o || o.brandId !== brandId) throw new DomainError("BULUNAMADI", "Teklif bulunamadı.");
  if (o.status !== "GONDERILDI") throw new DomainError("GECERSIZ_GECIS", "Yalnız yanıt bekleyen teklif geri çekilebilir.");
  return prisma.offer.update({ where: { id: o.id }, data: { status: "GERI_CEKILDI" } });
}

/** Süresi dolan teklifleri kapatır (zamanlanmış). */
export async function expireOffers(now = new Date()): Promise<number> {
  const r = await prisma.offer.updateMany({ where: { status: "GONDERILDI", expiresAt: { lte: now } }, data: { status: "SURESI_DOLDU" } });
  return r.count;
}
