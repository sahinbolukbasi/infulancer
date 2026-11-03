import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../src/db";
import { setJobEnabled, agentOverview } from "../src/agents/catalog";
import { runJob } from "../src/agents/runner";
import { backfillLegacyCategories, categoryTree, setInfluencerCategories } from "../src/domain/categories";
import { parseFilters, searchInfluencerIds } from "../src/domain/influencer-search";
import { syncInfluencer, syncSourceLabels } from "../src/social/sync";
import { resetDb } from "./helpers";

async function inf(name: string, category: string, accounts: { platform: "INSTAGRAM" | "TIKTOK" | "YOUTUBE"; handle: string; followers: number; er: number; women?: number; city?: string }[]) {
  return prisma.influencer.create({
    data: {
      name,
      category,
      iban: "TR000000000000000000000000",
      ibanHolder: name,
      taxStatus: "FATURA",
      canIssueInvoice: true,
      socialAccounts: {
        create: accounts.map((a) => ({
          platform: a.platform,
          handle: a.handle,
          followers: a.followers,
          engagementRate: a.er,
          demographics: { gender: { kadin: a.women ?? 0.5 }, ageGroups: { "18-24": 0.4 }, topCities: [{ city: a.city ?? "İstanbul", share: 0.4 }] },
        })),
      },
    },
  });
}

describe("UX çekirdeği: kategori, arama, senkron, agent merkezi", () => {
  let ayse: { id: string };
  let mert: { id: string };
  beforeAll(async () => {
    await resetDb();
    ayse = await inf("Ayşe Güzel", "kozmetik", [{ platform: "INSTAGRAM", handle: "ayse.guzel", followers: 250_000, er: 0.05, women: 0.8, city: "İzmir" }]);
    mert = await inf("Mert Koşu", "spor", [{ platform: "TIKTOK", handle: "mert.kosu", followers: 40_000, er: 0.02, women: 0.3 }]);
    await backfillLegacyCategories();
  });

  it("varsayılan kategori ağacı ana/alt yapıda ve eski metin kategoriler eşanlamlılarla bağlanır", async () => {
    const tree = await categoryTree();
    const guzellik = tree.find((t) => t.slug === "guzellik");
    expect(guzellik?.children.map((c) => c.slug)).toContain("makyaj");
    const links = await prisma.influencerCategory.findMany({ where: { influencerId: ayse.id }, include: { category: true } });
    expect(links[0]?.category.slug).toBe("guzellik");
  });

  it("çoklu kategori atanır, ana kategori geriye uyumlu alana yazılır", async () => {
    const cats = await prisma.category.findMany({ where: { slug: { in: ["makyaj", "cilt-bakimi"] } } });
    await prisma.$transaction((tx) => setInfluencerCategories(tx, ayse.id, cats.map((c) => c.id), cats.find((c) => c.slug === "makyaj")!.id));
    expect((await prisma.influencer.findUniqueOrThrow({ where: { id: ayse.id } })).category).toBe("güzellik");
    expect(await prisma.influencerCategory.count({ where: { influencerId: ayse.id } })).toBe(2);
  });

  it("filtreler: ana kategori alt kategorileri kapsar; platform, takipçi, ER, kitle", async () => {
    const guz = await prisma.category.findUniqueOrThrow({ where: { slug: "guzellik" } });
    expect(await searchInfluencerIds(parseFilters({ kategori: guz.id }))).toEqual([ayse.id]);
    expect(await searchInfluencerIds(parseFilters({ platform: "TIKTOK" }))).toEqual([mert.id]);
    expect(await searchInfluencerIds(parseFilters({ minTakipci: "100000" }))).toEqual([ayse.id]);
    expect(await searchInfluencerIds(parseFilters({ minEr: "3" }))).toEqual([ayse.id]);
    expect(await searchInfluencerIds(parseFilters({ minKadin: "70" }))).toEqual([ayse.id]);
    expect(await searchInfluencerIds(parseFilters({ sehir: "İzmir" }))).toEqual([ayse.id]);
    expect((await searchInfluencerIds(parseFilters({ q: "@mert" }))).sort()).toEqual([mert.id]);
    expect(parseFilters({ minTakipci: "abc", platform: "XX" })).toMatchObject({ minFollowers: undefined, platform: undefined });
  });

  it("sosyal senkron (demo veri) takipçiyi günceller, snapshot yazar; bulunamayan hesapta hata hesaba düşer", async () => {
    const r = await syncInfluencer(ayse.id);
    expect(r[0]!.ok).toBe(true);
    const acc = await prisma.socialAccount.findFirstOrThrow({ where: { influencerId: ayse.id } });
    expect(acc.syncSource).toBe("mock");
    expect(syncSourceLabels[acc.syncSource]).toMatch(/Demo/);
    expect(acc.lastSyncedAt).not.toBeNull();
    expect(await prisma.socialAccountSnapshot.count({ where: { socialAccountId: acc.id } })).toBe(1);
    const bad = await inf("Yok Hesap", "moda", [{ platform: "INSTAGRAM", handle: "hesap.yok", followers: 1, er: 0.01 }]);
    const r2 = await syncInfluencer(bad.id);
    expect(r2[0]!.ok).toBe(false);
    expect((await prisma.socialAccount.findFirstOrThrow({ where: { influencerId: bad.id } })).syncError).toMatch(/bulunamadı/);
  });

  it("agent kapatılınca zamanlanmış çalıştırma atlanır, elle çalıştırma çalışır; zorunlu agent kapatılamaz", async () => {
    await setJobEnabled("target-projection", false);
    expect((await runJob("target-projection")).disabled).toBe(true);
    expect((await runJob("target-projection", "manual")).disabled).toBe(false);
    await expect(setJobEnabled("iys-register", false)).rejects.toThrow(/kapatılamaz/);
    const ov = await agentOverview();
    const tp = ov.find((a) => a.job === "target-projection")!;
    expect(tp.enabled).toBe(false);
    expect(tp.lastRun?.trigger).toBe("manual");
    await setJobEnabled("target-projection", true);
  });
});

describe("kampanya kurulum sihirbazı", () => {
  it("adımlar veriden hesaplanır; story kare metni ve kullanım hakkı eksikse yayın kapalı", async () => {
    const { campaignSetup } = await import("../src/domain/campaign-setup");
    const { makeTenant } = await import("./helpers");
    const T = await makeTenant("Sihirbaz Marka");
    const c = await prisma.campaign.create({ data: { brandId: T.tenantId, name: "Sihirbaz", slug: `sihirbaz-${Date.now()}`, budgetKurus: 1, brandTotalFeeKurus: 1, startsAt: new Date(), endsAt: new Date(Date.now() + 864e5), targets: [{ kpi: "reach", target: 1000, weight: 1, windowDays: 7 }] } });
    let s = (await campaignSetup(c.id))!;
    expect(s.steps.find((x) => x.key === "influencerlar")!.done).toBe(false);
    expect(s.readyToActivate).toBe(false);
    const i = await prisma.influencer.create({ data: { name: "Story Kişi", category: "moda", iban: "TR1", ibanHolder: "S", taxStatus: "FATURA", canIssueInvoice: true } });
    const a = await prisma.assignment.create({ data: { campaignId: c.id, influencerId: i.id, feeKurus: 1, commissionKurus: 0, contractStatus: "KABUL" } });
    const d = await prisma.deliverable.create({ data: { assignmentId: a.id, platform: "INSTAGRAM", contentType: "STORY", plannedAt: new Date(), approvalDeadline: new Date(), disclosureRequired: true, frameCount: 2, frameTexts: ["Reklam | Sihirbaz Marka"], paidPartnershipToggle: true } });
    await prisma.campaignBrief.create({ data: { campaignId: c.id, version: 1, text: "b", dos: [], donts: [], hashtags: [], mentions: [], requiredPhrases: [], bannedPhrases: [], disclosureRequired: true, createdById: T.user.id } });
    s = (await campaignSetup(c.id))!;
    const icerik = s.steps.find((x) => x.key === "icerik")!;
    expect(icerik.done).toBe(false);
    expect(icerik.issues.join(" ")).toMatch(/kullanım hakkı|kare metinleri/);
    expect(s.readyToActivate).toBe(false);
    await prisma.deliverable.update({ where: { id: d.id }, data: { frameTexts: ["Reklam | Sihirbaz Marka", "Reklam | Sihirbaz Marka — kod BAHAR"], usageRightsDays: 90, usageRightsChannel: "ORGANIK", usageRightsGeo: ["TR"] } });
    s = (await campaignSetup(c.id))!;
    expect(s.steps.filter((x) => x.key !== "yayin").every((x) => x.done)).toBe(true);
    expect(s.readyToActivate).toBe(true);
  });
});

describe("senkron güvenliği", () => {
  it("SOCIAL_SYNC_MODE=off iken elle girilen değerler değişmez", async () => {
    const prev = process.env.SOCIAL_SYNC_MODE;
    process.env.SOCIAL_SYNC_MODE = "off";
    try {
      const i = await inf("Elle Giriş", "moda", [{ platform: "INSTAGRAM", handle: "elle.giris", followers: 12345, er: 0.04 }]);
      const r = await syncInfluencer(i.id);
      expect(r[0]!.ok).toBe(false);
      expect(r[0]!.message).toMatch(/kapalı/);
      const acc = await prisma.socialAccount.findFirstOrThrow({ where: { influencerId: i.id } });
      expect(acc.followers).toBe(12345);
      expect(acc.lastSyncedAt).toBeNull();
      const { syncStaleAccounts } = await import("../src/social/sync");
      expect(await syncStaleAccounts()).toEqual({ checked: 0, ok: 0 });
    } finally {
      process.env.SOCIAL_SYNC_MODE = prev;
    }
  });
});
