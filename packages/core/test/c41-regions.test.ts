import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../src/db";
import { campaignCurrency, currencyOf, detectRegion, formatMinor } from "../src/i18n/regions";
import { checkDisclosure, checkLeadingDisclosure } from "../src/compliance/disclosure";
import { assertInfluencerFitsCampaign } from "../src/domain/campaign-region";
import { ensureStarterCredits } from "../src/creative/credits";
import { submitGeneration } from "../src/creative/generate";
import { setFalClient } from "../src/creative/fal";
import { makeTenant, resetDb } from "./helpers";

describe("K41 bölgeler: dil, para birimi, ülke ayrımı, ülkeye göre uyum", () => {
  beforeAll(async () => {
    await resetDb();
    setFalClient({ async submit() { return { requestId: `req-r-${Math.random()}` }; }, async download() { return { bytes: new Uint8Array([1]), mime: "image/png" }; } });
  });

  it("dil ve ülke otomatik algılama: IP ülkesi öncelikli, tarayıcı dili destekliyse o dil", () => {
    expect(detectRegion({ ipCountry: "DE", acceptLanguage: "de-DE,de;q=0.9" })).toEqual({ country: "DE", locale: "de" });
    expect(detectRegion({ ipCountry: "DE", acceptLanguage: "tr-TR,tr;q=0.9" })).toEqual({ country: "DE", locale: "tr" });
    expect(detectRegion({ ipCountry: "FR", acceptLanguage: "ja" })).toEqual({ country: "FR", locale: "fr" });
    expect(detectRegion({ ipCountry: null, acceptLanguage: "en-GB,en;q=0.8" })).toEqual({ country: "GB", locale: "en" });
    expect(detectRegion({ ipCountry: "JP", acceptLanguage: "ja-JP" })).toEqual({ country: "TR", locale: "tr" });
  });

  it("para birimi çevrilmez; kampanyada ülkeler aynı para birimini kullanmalı", () => {
    expect(currencyOf("AT")).toBe("EUR");
    expect(currencyOf("CH")).toBe("CHF");
    expect(campaignCurrency(["DE", "FR", "BE"], "TR")).toEqual({ currency: "EUR", mixed: false });
    expect(campaignCurrency(["TR", "DE"], "TR").mixed).toBe(true);
    expect(campaignCurrency([], "GB").currency).toBe("GBP");
    expect(formatMinor(125000, "EUR")).toMatch(/1\.250\s?€/);
    expect(formatMinor(125000, "TRY")).toContain("1.250");
  });

  it("uyum kayıtlı ülkeye göre: DE 'Werbung', FR 'Publicité', GB '#ad'; TR kuralı değişmedi", () => {
    expect(checkLeadingDisclosure("Werbung | Lumi — neue Hautpflege", "Lumi", null, "DE")).toEqual([]);
    expect(checkLeadingDisclosure("Neue Hautpflege von Lumi #werbung", "Lumi", null, "DE")).toEqual([]);
    expect(checkLeadingDisclosure("Neue Hautpflege von Lumi", "Lumi", null, "DE")[0]?.code).toBe("ACIKLAMA_YOK");
    expect(checkLeadingDisclosure(`${"x".repeat(140)} Werbung`, "Lumi", null, "DE")[0]?.code).toBe("ILK_BAKISTA_DEGIL");
    expect(checkLeadingDisclosure("Publicité — nouvelle crème Lumi", "Lumi", null, "FR")).toEqual([]);
    expect(checkLeadingDisclosure("#ad Loving the new Lumi serum", "Lumi", null, "GB")).toEqual([]);
    expect(checkLeadingDisclosure("Loving the new Lumi serum #sp", "Lumi", null, "GB")[0]?.code).toBe("ACIKLAMA_YOK");
    // TR: hashtag yetmez, ilk unsur + marka
    expect(checkLeadingDisclosure("Yeni serum #reklam", "Lumi", null, "TR")[0]?.code).toBe("HASHTAG_YETMEZ");
    expect(checkLeadingDisclosure("Reklam | Lumi yeni serum", "Lumi", null, "TR")).toEqual([]);
    const r = checkDisclosure({ platform: "INSTAGRAM", caption: "Anzeige | Lumi", advertiser: "Lumi", paidPartnershipToggle: true, country: "AT" });
    expect(r.compliant).toBe(true);
    expect(r.checklist.join(" ")).toContain("AT");
  });

  it("influencer ülke ayrımı: hedef ülke ve para birimi uyumsuzsa atanamaz", async () => {
    const brand = await makeTenant("Region Brand");
    const c = await prisma.campaign.create({ data: { brandId: brand.tenantId, name: "DE kampanya", slug: `de-${Date.now()}`, budgetKurus: 0, brandTotalFeeKurus: 0, startsAt: new Date(), endsAt: new Date(Date.now() + 86_400_000), targets: [], targetCountries: ["DE", "AT"], currency: "EUR" } });
    const de = await prisma.influencer.create({ data: { name: "Lena", category: "moda", iban: "DE89370400440532013000", ibanHolder: "Lena", taxStatus: "FATURA", canIssueInvoice: true, country: "DE" } });
    const tr = await prisma.influencer.create({ data: { name: "Ayşe", category: "moda", iban: "TR1", ibanHolder: "Ayşe", taxStatus: "FATURA", canIssueInvoice: true, country: "TR" } });
    const fr = await prisma.influencer.create({ data: { name: "Chloé", category: "moda", iban: "FR1", ibanHolder: "C", taxStatus: "FATURA", canIssueInvoice: true, country: "FR" } });
    await expect(assertInfluencerFitsCampaign(prisma, c.id, de.id)).resolves.toBeUndefined();
    await expect(assertInfluencerFitsCampaign(prisma, c.id, tr.id)).rejects.toThrow(/Türkiye/);
    await expect(assertInfluencerFitsCampaign(prisma, c.id, fr.id)).rejects.toThrow(/Fransa/);
  });

  it("Creative: EUR hesabı kendi para biriminde açılır ve EUR üzerinden ücretlenir", async () => {
    const b = await makeTenant("Berlin GmbH");
    await prisma.brand.update({ where: { id: b.tenantId }, data: { country: "DE" } });
    const acc = await ensureStarterCredits(b.tenantId, 250);
    const full = await prisma.creditAccount.findUniqueOrThrow({ where: { tenantId: acc.tenantId } });
    expect(full.currency).toBe("EUR");
    expect(Number(full.balanceCredits)).toBeGreaterThan(0);
    expect(Number(full.balanceCredits)).toBeLessThan(20);
    const job = await submitGeneration({ tenantId: b.tenantId, modelKey: "flux-schnell", prompt: "Kaffeetasse im Studio", aspect: "1:1" });
    const hold = await prisma.creditHold.findUniqueOrThrow({ where: { id: job.creditHoldId! } });
    // TL fiyatın EUR karşılığı: birkaç cent; TL'deki 2 TL minimumu EUR'da ~0,04 €.
    expect(Number(hold.credits)).toBeGreaterThan(0);
    expect(Number(hold.credits)).toBeLessThan(1);
  });
});
