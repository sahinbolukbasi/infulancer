import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../src/db";
import { MutationRateLimiter, requestBudgetChange, runBudgetBatch } from "../src/ads/budget-optimizer";
import { hourlyQuota, ScoreTracker } from "../src/ads/quota";
import { resetDb } from "./helpers";

// Kriter 11: Ad set bütçesi bir saatte 4'ten fazla değiştirilemez; 5. istek sonraki saate ötelenir.
describe("K11 reklam yazma limitleri", () => {
  beforeAll(resetDb);
  const t0 = new Date("2026-11-03T10:05:00Z");
  const at = (s: number) => new Date(t0.getTime() + s * 1000);

  it("saatte 4 değişiklik uygulanır, 5. sonraki saate ötelenir", async () => {
    const applied: number[] = [];
    const apply = async (_id: string, b: number) => void applied.push(b);
    const results = [];
    for (let i = 0; i < 5; i++) results.push(await requestBudgetChange({ tenantId: "t", adSetId: "AS1", newBudgetMinor: 1000 + i, now: at(i * 60) }, apply));
    expect(results.slice(0, 4).every((r) => r.status === "applied")).toBe(true);
    expect(results[4]!.status).toBe("deferred");
    // Kayan 1 saatlik pencere: en eski değişiklik 10:05 → hak 11:05'te açılır → saatlik batch 12:00
    expect(results[4]!.scheduledFor.toISOString()).toBe("2026-11-03T12:00:00.000Z");
    expect(applied).toEqual([1000, 1001, 1002, 1003]);
  });

  it("aynı nesne 30 sn içinde ikinci kez düzenlenmez (4841018), kuyruğa alınır", async () => {
    const r1 = await requestBudgetChange({ tenantId: "t", adSetId: "AS2", newBudgetMinor: 1, now: at(0) });
    const r2 = await requestBudgetChange({ tenantId: "t", adSetId: "AS2", newBudgetMinor: 2, now: at(10) });
    expect(r1.status).toBe("applied");
    expect(r2.status).toBe("deferred");
    expect(r2.scheduledFor.getTime()).toBe(at(30).getTime());
  });

  it("saatlik batch ötelenmiş değişikliği vadesinde uygular", async () => {
    const applied: number[] = [];
    const r = await runBudgetBatch(new Date("2026-11-03T12:00:00Z"), async (_id, b) => void applied.push(b));
    expect(applied).toContain(1004);
    expect(r.applied).toBeGreaterThanOrEqual(1);
    expect(await prisma.adBudgetChange.count({ where: { adSetId: "AS1", status: "applied" } })).toBe(5);
  });

  it("mutation QPS sınırı (100/sn) bekletir", async () => {
    let now = 0;
    const waits: number[] = [];
    const lim = new MutationRateLimiter(100, () => now, async (ms) => {
      waits.push(ms);
      now += ms;
    });
    for (let i = 0; i < 101; i++) await lim.wait();
    expect(waits.length).toBe(1);
  });

  it("kota ve skor config'den hesaplanır (Dev max 60 → 300 sn blok)", async () => {
    expect((await hourlyQuota("development", 10)).adsManagement).toBe(300 + 40 * 10);
    expect((await hourlyQuota("full", 10)).adsInsights).toBe(190_000 + 4000);
    const s = new ScoreTracker({ maxScore: 60, blockSeconds: 300, decaySeconds: 300, readPoints: 1, writePoints: 3 }, () => 0);
    for (let i = 0; i < 20; i++) expect(s.record("write").allowed).toBe(true);
    expect(s.record("read")).toMatchObject({ allowed: false, blockedForSec: 300 });
  });
});
