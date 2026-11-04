import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../src/db";
import { ensureCampaignTrackers, evaluateTracker, runTracker, trackerSettings } from "../src/agents/trackers";
import { resetDb } from "./helpers";

describe("takip agent'ları", () => {
  let campaignId = "";
  let adminId = "";
  beforeAll(async () => {
    await resetDb();
    adminId = (await prisma.user.create({ data: { email: "adm-trk@ex.com", name: "Admin", role: "ADMIN", passwordHash: "x" } })).id;
    const brand = await prisma.brand.create({ data: { name: "Trk Marka", taxOffice: "X", taxNumber: "1234567890", contactName: "A", contactEmail: "a@ex.com", contactPhone: "+90", category: "moda" } });
    const inf = await prisma.influencer.create({ data: { name: "Trk Inf", category: "moda", iban: "TR00", ibanHolder: "Trk", taxStatus: "FATURA", canIssueInvoice: false } });
    const now = Date.now();
    const c = await prisma.campaign.create({
      data: { brandId: brand.id, name: "Trk Kampanya", slug: `trk-${now}`, budgetKurus: 1000, brandTotalFeeKurus: 2000, startsAt: new Date(now - 10 * 864e5), endsAt: new Date(now + 10 * 864e5), targets: [], status: "AKTIF" },
    });
    campaignId = c.id;
    const a = await prisma.assignment.create({ data: { campaignId, influencerId: inf.id, feeKurus: 1000, commissionKurus: 0, contractStatus: "KABUL" } });
    // Gecikmiş story: 2 kare, ikincisinde etiket yok
    await prisma.deliverable.create({
      data: { assignmentId: a.id, platform: "INSTAGRAM", contentType: "STORY", plannedAt: new Date(now - 5 * 3600e3), approvalDeadline: new Date(now - 8 * 3600e3), status: "ONAYLANDI", disclosureRequired: true, frameCount: 2, frameTexts: ["Yeni ürün #reklam", "Linke tıkla"] },
    });
  });

  it("varsayılan eşikler doğrulanır, geçersiz değerler varsayılana döner", () => {
    expect(trackerSettings("campaign", { metricAfterHours: 12 }).metricAfterHours).toBe(12);
    expect(trackerSettings("campaign", { metricAfterHours: -5 }).metricAfterHours).toBe(48);
  });
  it("kampanya ile story takipçileri bir kez oluşturulur", async () => {
    expect(await ensureCampaignTrackers(campaignId, "Trk Kampanya", adminId)).toBe(2);
    expect(await ensureCampaignTrackers(campaignId, "Trk Kampanya", adminId)).toBe(0);
  });
  it("kampanya takibi gecikmeyi, story takibi eksik reklam etiketini bulur", async () => {
    const camp = await evaluateTracker({ template: "campaign", targetId: campaignId, settings: {} });
    expect(camp.some((f) => f.key.startsWith("late:") && f.severity === "KRITIK")).toBe(true);
    const story = await evaluateTracker({ template: "story", targetId: campaignId, settings: {} });
    const disc = story.find((f) => f.key.startsWith("disc:"));
    expect(disc?.detail).toContain("Kare 2");
  });
  it("yalnız yeni bulgular için bildirim gönderilir", async () => {
    const t = await prisma.trackerAgent.findFirstOrThrow({ where: { targetId: campaignId, template: "story" } });
    const first = await runTracker(t.id);
    expect(first.fresh).toBeGreaterThan(0);
    const n1 = await prisma.notification.count({ where: { userId: adminId } });
    const second = await runTracker(t.id);
    expect(second.fresh).toBe(0);
    expect(await prisma.notification.count({ where: { userId: adminId } })).toBe(n1);
  });
});
