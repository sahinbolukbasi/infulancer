import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../src/db";
import { generatePost, generateBrief } from "../src/creative/post-brief";
import { applyToOpenCall, createOpenCall, reviewApplication, setOpenCallStatus } from "../src/campaigns/open-call";
import { DomainError } from "../src/domain/errors";
import { makeTenant, resetDb } from "./helpers";

async function makeInf() {
  await prisma.user.create({ data: { email: `oc-${Date.now()}-${Math.random().toString(36).slice(2,7)}@ex.com`, name: "Inf", role: "INFLUENCER", passwordHash: "x" } });
  return prisma.influencer.create({ data: { name: "Başvuran", category: "moda", iban: "TR000000000000000000000000", ibanHolder: "Başvuran", taxStatus: "STOPAJLI", canIssueInvoice: false } });
}

describe("K30 post ve brief üretimi", () => {
  it("post taslağı caption + hashtag + CTA üretir", async () => {
    const p = await generatePost({ prompt: "pastel stüdyoda yeni sezon elbise çekimi", brandName: "Lumi", tone: "samimi" });
    expect(p.caption.length).toBeGreaterThan(10);
    expect(p.hashtags.length).toBeGreaterThan(0);
    expect(p.callToAction).toBeTruthy();
    expect(p.caption).toContain("#reklam");
  });
  it("brief taslağı tüm alanları doldurur ve reklam ibaresi zorunlu", async () => {
    const b = await generateBrief({ prompt: "yeni parfüm lansmanı", brandName: "Lumi", goal: "bilinirlik" });
    expect(b.text.length).toBeGreaterThan(10);
    expect(b.dos.length).toBeGreaterThan(0);
    expect(b.donts.length).toBeGreaterThan(0);
    expect(b.disclosureRequired).toBe(true);
    expect(b.mentions[0]).toContain("@");
  });
});

describe("K30 açık çağrı (başvuru)", () => {
  let T: Awaited<ReturnType<typeof makeTenant>>;
  let inf: Awaited<ReturnType<typeof makeInf>>;
  beforeAll(async () => {
    await resetDb();
    T = await makeTenant("Çağrı");
    inf = await makeInf();
  });

  it("çağrı açar, influencer başvurur, marka kabul eder", async () => {
    const call = await createOpenCall({ tenantId: T.tenantId, title: "Yaz koleksiyonu", description: "Moda içerik üreticileri arıyoruz", budgetMinKurus: 500000, budgetMaxKurus: 2000000, platforms: ["INSTAGRAM"] });
    expect(call.status).toBe("TASLAK");
    await expect(applyToOpenCall({ openCallId: call.id, influencerId: inf.id, pitch: "Harika bir fikrim var ve kitlem uygun." })).rejects.toBeInstanceOf(DomainError); // kapalı
    await setOpenCallStatus(T.tenantId, call.id, "ACIK");
    const app = await applyToOpenCall({ openCallId: call.id, influencerId: inf.id, pitch: "Harika bir fikrim var ve kitlem uygun.", quotedKurus: 1500000 });
    expect(app.status).toBe("BASVURULDU");
    await expect(applyToOpenCall({ openCallId: call.id, influencerId: inf.id, pitch: "tekrar başvuru denemesi" })).rejects.toBeInstanceOf(DomainError); // tekrar
    const reviewed = await reviewApplication(T.tenantId, app.id, "KABUL", "Uygun bulundu", T.user.id);
    expect(reviewed.status).toBe("KABUL");
    // Kabul edilen başvuru Teklifler akışına "kabul edilmiş teklif" olarak düşer.
    expect(reviewed.offerId).toBeTruthy();
    const offer = await prisma.offer.findUniqueOrThrow({ where: { id: reviewed.offerId! } });
    expect(offer.status).toBe("KABUL");
    expect(offer.influencerId).toBe(inf.id);
    expect(offer.totalKurus).toBe(1500000);
    // İdempotent: tekrar kabul yeni teklif açmaz; teklife dönüşmüş başvuru reddedilemez.
    const again = await reviewApplication(T.tenantId, app.id, "KABUL", null, T.user.id);
    expect(again.offerId).toBe(reviewed.offerId);
    expect(await prisma.offer.count({ where: { influencerId: inf.id, brandId: T.tenantId } })).toBe(1);
    await expect(reviewApplication(T.tenantId, app.id, "RED")).rejects.toBeInstanceOf(DomainError);
  });

  it("kısa başvuru reddedilir; bütçe tutarsızlığı engellenir", async () => {
    const call = await createOpenCall({ tenantId: T.tenantId, title: "X", description: "açıklama" });
    await setOpenCallStatus(T.tenantId, call.id, "ACIK");
    const inf2 = await makeInf();
    await expect(applyToOpenCall({ openCallId: call.id, influencerId: inf2.id, pitch: "kısa" })).rejects.toBeInstanceOf(DomainError);
    await expect(createOpenCall({ tenantId: T.tenantId, title: "Y", description: "d", budgetMinKurus: 2000, budgetMaxKurus: 1000 })).rejects.toBeInstanceOf(DomainError);
  });
});
