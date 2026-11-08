import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../src/db";
import type { Actor } from "../src/access/actor";
import {
  assertCanEditDraft,
  createDraft,
  draftStatus,
  saveDraftBrief,
  submitDraft,
  updateAudience,
  updateContentPlan,
  updateSchedule,
  updateShortlist,
} from "../src/domain/campaign-draft";
import { expandPlanSchedule, parseContentPlan } from "../src/domain/campaign-plan";
import { makeTenant, resetDb } from "./helpers";

describe("K37 kampanya sihirbazı: marka kampanya oluşturur", () => {
  let brand: Actor;
  let other: Actor;
  let admin: Actor;
  let infIds: string[];
  beforeAll(async () => {
    await resetDb();
    const a = await makeTenant("Sihirbaz Marka");
    const b = await makeTenant("Rakip Marka");
    brand = { userId: a.user.id, role: "BRAND", brandId: a.tenantId, influencerId: null };
    other = { userId: b.user.id, role: "BRAND", brandId: b.tenantId, influencerId: null };
    const adm = await prisma.user.create({ data: { email: "adm-wiz@ex.com", name: "Ajans", role: "ADMIN", passwordHash: "x" } });
    admin = { userId: adm.id, role: "ADMIN", brandId: null, influencerId: null };
    infIds = [];
    for (const n of ["Ada", "Bora", "Cem"]) {
      const i = await prisma.influencer.create({ data: { name: n, category: "moda", iban: "TR1", ibanHolder: n, taxStatus: "FATURA", canIssueInvoice: true } });
      infIds.push(i.id);
    }
    await prisma.influencer.create({ data: { name: "Gizli", category: "moda", iban: "TR1", ibanHolder: "G", taxStatus: "FATURA", canIssueInvoice: true, showcaseVisible: false } });
  });

  it("marka kendi adına taslak açar; başka marka kimliği yok sayılır, düzenleyemez", async () => {
    const c = await createDraft(brand, { brandId: other.brandId, name: "Yaz lansmanı", objective: "satis" });
    expect(c.brandId).toBe(brand.brandId);
    expect(c.status).toBe("TASLAK");
    expect(Number(c.budgetKurus)).toBe(0);
    expect(c.createdById).toBe(brand.userId);
    await expect(assertCanEditDraft(other, c.id)).rejects.toThrow(/bulunamadı/i);
    await expect(createDraft(brand, { name: "x", objective: "satis" })).rejects.toThrow(/3–140/);
    await expect(createDraft(brand, { name: "Geçersiz amaç", objective: "yok" })).rejects.toThrow(/amacını/);
  });

  it("tüm adımlar kaydedilir; eksik varken gönderilemez, tamamlanınca ajansa bildirim gider", async () => {
    const c = await createDraft(brand, { name: "Sonbahar koleksiyonu", objective: "bilinirlik" });
    await expect(submitDraft(brand, c.id)).rejects.toThrow(/tamamlayın/);
    await expect(updateAudience(brand, c.id, { targetCountries: [], platforms: ["INSTAGRAM"], audienceAgeMin: 18, audienceAgeMax: 30, audienceGender: "hepsi", audienceInterests: [] })).rejects.toThrow(/ülke/);
    await expect(updateAudience(brand, c.id, { targetCountries: ["TR"], platforms: ["INSTAGRAM"], audienceAgeMin: 40, audienceAgeMax: 20, audienceGender: null, audienceInterests: [] })).rejects.toThrow(/Yaş/);
    await updateAudience(brand, c.id, { targetCountries: ["TR", "DE"], platforms: ["INSTAGRAM", "TIKTOK"], audienceAgeMin: 18, audienceAgeMax: 34, audienceGender: "kadin", audienceInterests: ["moda"] });
    await expect(updateSchedule(brand, c.id, { startsAt: new Date("2026-12-10"), endsAt: new Date("2026-12-01"), brandTotalFeeKurus: 100 })).rejects.toThrow(/Bitiş/);
    // Marka influencer bütçesini (ajans iç bilgisi) değiştiremez.
    await updateSchedule(brand, c.id, { startsAt: new Date("2026-12-01"), endsAt: new Date("2026-12-31"), brandTotalFeeKurus: 25_000_000, budgetKurus: 999 });
    await expect(updateContentPlan(brand, c.id, [{ platform: "TIKTOK", contentType: "STORY", count: 1, notes: "" }])).rejects.toThrow(/platformda yok/);
    await updateContentPlan(brand, c.id, [
      { platform: "INSTAGRAM", contentType: "REELS", count: 1, notes: "ürünü kullanırken" },
      { platform: "INSTAGRAM", contentType: "STORY", count: 3, notes: "" },
    ]);
    await expect(saveDraftBrief(brand, c.id, { text: "kısa", dos: [], donts: [], hashtags: [], mentions: [], disclosureRequired: true })).rejects.toThrow(/10 karakter/);
    expect(await saveDraftBrief(brand, c.id, { text: "Yeni sezonu doğal ışıkta tanıtın.", dos: ["Ürünü göster"], donts: [], hashtags: ["#reklam"], mentions: ["@marka"], disclosureRequired: true })).toBe(1);
    // Toplu seçim: gizli (vitrinde olmayan) ve bilinmeyen kimlikler atılır.
    const hidden = await prisma.influencer.findFirstOrThrow({ where: { name: "Gizli" } });
    expect(await updateShortlist(brand, c.id, [...infIds, hidden.id, "yok"])).toBe(3);
    const st = await draftStatus(c.id);
    expect(st.ready).toBe(true);
    expect(Number(st.campaign.budgetKurus)).toBe(0);
    expect(Number(st.campaign.brandTotalFeeKurus)).toBe(25_000_000);
    expect(st.campaign.targetCountries).toEqual(["TR", "DE"]);
    const admins = await prisma.notification.count({ where: { userId: admin.userId } });
    expect((await submitDraft(brand, c.id)).first).toBe(true);
    expect(await prisma.notification.count({ where: { userId: admin.userId } })).toBe(admins + 1);
    expect((await prisma.campaign.findUniqueOrThrow({ where: { id: c.id } })).submittedAt).not.toBeNull();
    // Ajans influencer bütçesini girebilir.
    await updateSchedule(admin, c.id, { startsAt: new Date("2026-12-01"), endsAt: new Date("2026-12-31"), brandTotalFeeKurus: 25_000_000, budgetKurus: 20_000_000 });
    expect(Number((await prisma.campaign.findUniqueOrThrow({ where: { id: c.id } })).budgetKurus)).toBe(20_000_000);
  });

  it("yayına alınmış kampanyayı marka değiştiremez, ajans değiştirebilir", async () => {
    const c = await createDraft(brand, { name: "Aktif kampanya", objective: "video" });
    await prisma.campaign.update({ where: { id: c.id }, data: { status: "AKTIF" } });
    await expect(assertCanEditDraft(brand, c.id)).rejects.toThrow(/ajans/i);
    await expect(assertCanEditDraft(admin, c.id)).resolves.toBeTruthy();
  });

  it("içerik planı takvime yayılır: story tek iş (kare = adet), diğerleri adet kadar, aralıklı", () => {
    const plan = parseContentPlan([
      { platform: "INSTAGRAM", contentType: "REELS", count: 2, notes: "" },
      { platform: "INSTAGRAM", contentType: "STORY", count: 3, notes: "" },
    ]);
    const s = expandPlanSchedule(plan, { startDay: "2026-12-30", time: "19:00", spacingDays: 2 });
    expect(s.map((x) => `${x.contentType}:${x.frameCount}:${x.day}`)).toEqual(["REELS:1:2026-12-30", "REELS:1:2027-01-01", "STORY:3:2027-01-03"]);
    expect(parseContentPlan("bozuk")).toEqual([]);
  });
});
