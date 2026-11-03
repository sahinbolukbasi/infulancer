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
