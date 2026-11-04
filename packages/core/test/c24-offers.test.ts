import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../src/db";
import { expireOffers, respondOffer, saveRateCard, sendOffers, withdrawOffer } from "../src/domain/offers";
import { resetDb } from "./helpers";

describe("fiyat listesi ve teklifler", () => {
  let brandId = "";
  let userId = "";
  let a = "";
  let b = "";
  beforeAll(async () => {
    await resetDb();
    userId = (await prisma.user.create({ data: { email: "brand-off@ex.com", name: "Marka", role: "BRAND", passwordHash: "x" } })).id;
    brandId = (await prisma.brand.create({ data: { name: "Off Marka", taxOffice: "X", taxNumber: "1234567890", contactName: "A", contactEmail: "a@ex.com", contactPhone: "+90", category: "moda" } })).id;
    const mk = (n: string) => prisma.influencer.create({ data: { name: n, category: "moda", iban: "TR00", ibanHolder: n, taxStatus: "FATURA", canIssueInvoice: true } });
    a = (await mk("A")).id;
    b = (await mk("B")).id;
  });
  it("fiyat listesi: platforma uymayan içerik türü reddedilir, 0 fiyat satırı kapatır", async () => {
    await expect(saveRateCard(a, [{ platform: "YOUTUBE", contentType: "STORY", priceKurus: 100 }])).rejects.toThrow();
    await saveRateCard(a, [{ platform: "INSTAGRAM", contentType: "REELS", priceKurus: 3_000_000 }]);
    expect((await prisma.rateCard.findFirstOrThrow({ where: { influencerId: a } })).priceKurus).toBe(3_000_000);
    await saveRateCard(a, [{ platform: "INSTAGRAM", contentType: "REELS", priceKurus: null }]);
    expect((await prisma.rateCard.findFirstOrThrow({ where: { influencerId: a } })).active).toBe(false);
    await saveRateCard(a, [{ platform: "INSTAGRAM", contentType: "REELS", priceKurus: 3_000_000 }]);
  });
  it("teklif: üretici fiyatı uygulanır, bekleyen teklif tekrarlanmaz, kabul/red akışı", async () => {
    const r = await sendOffers({ brandId, createdById: userId, influencerIds: [a, b], title: "Yaz", message: "Merhaba", publishBy: null, campaignId: null, items: [{ platform: "INSTAGRAM", contentType: "REELS", qty: 2, priceKurus: 1_000_000 }], perInfluencerPricing: true });
    expect(r.created).toHaveLength(2);
    const offA = await prisma.offer.findFirstOrThrow({ where: { influencerId: a } });
    const offB = await prisma.offer.findFirstOrThrow({ where: { influencerId: b } });
    expect(offA.totalKurus).toBe(6_000_000); // listedeki fiyat × 2
    expect(offB.totalKurus).toBe(2_000_000); // listesi yok → form fiyatı
    const again = await sendOffers({ brandId, createdById: userId, influencerIds: [a], title: "Yaz", message: "x", publishBy: null, campaignId: null, items: [{ platform: "INSTAGRAM", contentType: "REELS", qty: 1, priceKurus: 1 }], perInfluencerPricing: false });
    expect(again.skipped).toHaveLength(1);
    await expect(respondOffer(offA.id, b, "KABUL", null)).rejects.toThrow(/bulunamadı/);
    await expect(respondOffer(offB.id, b, "RED", "")).rejects.toThrow(/not/);
    expect((await respondOffer(offA.id, a, "KABUL", null)).status).toBe("KABUL");
    await expect(withdrawOffer(offA.id, brandId)).rejects.toThrow();
    expect((await withdrawOffer(offB.id, brandId)).status).toBe("GERI_CEKILDI");
  });
  it("süresi dolan teklifler kapanır", async () => {
    await sendOffers({ brandId, createdById: userId, influencerIds: [b], title: "Kış", message: "x", publishBy: null, campaignId: null, items: [{ platform: "TIKTOK", contentType: "VIDEO", qty: 1, priceKurus: 500_000 }], perInfluencerPricing: false });
    expect(await expireOffers(new Date(Date.now() + 8 * 86_400_000))).toBe(1);
  });
});
