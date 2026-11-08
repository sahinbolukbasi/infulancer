import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../src/db";
import { computeBalances, maturityDate, recordEarning } from "../src/domain/ledger";
import { closeEndedCampaigns } from "../src/campaigns/auto-close";
import { makeTenant, resetDb } from "./helpers";

const DAY = 86_400_000;

describe("K38 hakediş: kampanya bitince otomatik çekilebilir", () => {
  let brandId: string;
  beforeAll(async () => {
    await resetDb();
    brandId = (await makeTenant("Ödeme Marka")).tenantId;
  });

  async function setup(endsAt: Date, status: "AKTIF" | "KAPANDI" | "IPTAL" = "AKTIF") {
    const inf = await prisma.influencer.create({ data: { name: `Inf ${Math.random()}`, category: "moda", iban: "TR1", ibanHolder: "X", taxStatus: "FATURA", canIssueInvoice: true } });
    const user = await prisma.user.create({ data: { email: `i${Date.now()}${Math.random()}@ex.com`, name: "I", role: "INFLUENCER", influencerId: inf.id, passwordHash: "x" } });
    const c = await prisma.campaign.create({
      data: { brandId, name: "Ödeme testi", slug: `odeme-${Date.now()}-${Math.round(Math.random() * 1e6)}`, budgetKurus: 0, brandTotalFeeKurus: 0, startsAt: new Date(endsAt.getTime() - 10 * DAY), endsAt, targets: [], status, closedAt: status === "KAPANDI" ? endsAt : null },
    });
    const a = await prisma.assignment.create({ data: { campaignId: c.id, influencerId: inf.id, feeKurus: 100_000, commissionKurus: 0, contractStatus: "KABUL" } });
    const d = await prisma.deliverable.create({
      data: { assignmentId: a.id, platform: "INSTAGRAM", contentType: "REELS", plannedAt: new Date(endsAt.getTime() - 5 * DAY), approvalDeadline: new Date(endsAt.getTime() - 6 * DAY), disclosureRequired: true, status: "TAMAMLANDI" },
    });
    await prisma.$transaction((tx) => recordEarning(tx, d.id));
    return { inf, user, c };
  }

  it("marka tahsilatı beklenmez; bitiş tarihi geçince çekilebilir, öncesinde hakedilen", async () => {
    const now = new Date();
    const live = await setup(new Date(now.getTime() + 3 * DAY));
    expect(await computeBalances(live.inf.id, now)).toMatchObject({ hakedilen: 100_000, cekilebilir: 0 });
    const ended = await setup(new Date(now.getTime() - DAY));
    expect(await computeBalances(ended.inf.id, now)).toMatchObject({ hakedilen: 0, cekilebilir: 100_000 });
    const cancelled = await setup(new Date(now.getTime() - DAY), "IPTAL");
    expect((await computeBalances(cancelled.inf.id, now)).cekilebilir).toBe(0);
    expect(maturityDate({ status: "KAPANDI", closedAt: new Date(0), endsAt: new Date(0) }, 2)?.getTime()).toBe(2 * DAY);
  });

  it("biten aktif kampanyayı otomatik kapatır ve influencer'a bildirir (bir kez)", async () => {
    const ended = await setup(new Date(Date.now() - 2 * DAY));
    expect(await closeEndedCampaigns()).toBeGreaterThanOrEqual(1);
    const c = await prisma.campaign.findUniqueOrThrow({ where: { id: ended.c.id } });
    expect(c.status).toBe("KAPANDI");
    expect(c.closedAt?.getTime()).toBe(ended.c.endsAt.getTime());
    expect(await prisma.notification.count({ where: { userId: ended.user.id, title: "Kampanya tamamlandı" } })).toBe(1);
    await closeEndedCampaigns();
    expect(await prisma.notification.count({ where: { userId: ended.user.id, title: "Kampanya tamamlandı" } })).toBe(1);
    expect((await computeBalances(ended.inf.id)).cekilebilir).toBe(100_000);
  });
});
