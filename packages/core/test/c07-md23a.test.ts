import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../src/db";
import { assertCampaignCanGoLive, CampaignGateError, checkDisclosure } from "../src/compliance/disclosure";
import { makeTenant, resetDb } from "./helpers";

// Kriter 7: Etiketsiz (md. 23/A uyumsuz) deliverable ile kampanya canlıya alınamaz.
describe("K7 md. 23/A reklam açıklaması", () => {
  const base = { platform: "INSTAGRAM" as const, advertiser: "Lumi Kozmetik", paidPartnershipToggle: true };

  it("'Reklam' + marka ilk unsur ise uyumlu", () => {
    expect(checkDisclosure({ ...base, caption: "Reklam | Lumi Kozmetik — yeni ruj serisini denedim #güzellik" }).compliant).toBe(true);
    expect(checkDisclosure({ ...base, caption: "Tanıtım: Lumi Kozmetik iş birliğiyle..." }).compliant).toBe(true);
  });

  it("hashtag tek başına yetmez", () => {
    const r = checkDisclosure({ ...base, caption: "Yeni rujum çok güzel @lumi #reklam #işbirliği" });
    expect(r.compliant).toBe(false);
    expect(r.issues.map((i) => i.code)).toContain("HASHTAG_YETMEZ");
  });

  it("'Reklam' sona gizlenmişse ilk unsur değildir", () => {
    const r = checkDisclosure({ ...base, caption: `Harika bir gün ${"çok güzel ".repeat(20)} Reklam Lumi Kozmetik` });
    expect(r.issues.map((i) => i.code)).toContain("ILK_UNSUR_DEGIL");
  });

  it("story serisi kare başına kontrol edilir", () => {
    const r = checkDisclosure({ ...base, caption: "", isStory: true, frameTexts: ["Reklam - Lumi Kozmetik", "Bugün denedim", "Reklam - Lumi Kozmetik"] });
    expect(r.compliant).toBe(false);
    expect(r.issues.some((i) => i.frame === 2)).toBe(true);
    expect(r.issues.some((i) => i.frame === 1 || i.frame === 3)).toBe(false);
  });

  it("platform checklist: Instagram ücretli ortaklık, TikTok ticari içerik, sesli içerikte sözlü açılış", () => {
    expect(checkDisclosure({ ...base, paidPartnershipToggle: false, caption: "Reklam Lumi Kozmetik" }).issues.map((i) => i.code)).toContain("IG_UCRETLI_ORTAKLIK");
    expect(checkDisclosure({ platform: "TIKTOK", advertiser: "Lumi Kozmetik", caption: "Reklam Lumi Kozmetik" }).issues.map((i) => i.code)).toContain("TT_TICARI_ICERIK");
    expect(checkDisclosure({ ...base, caption: "Reklam Lumi Kozmetik", hasAudio: true }).issues.map((i) => i.code)).toContain("SOZLU_YOK");
    expect(checkDisclosure({ platform: "YOUTUBE", advertiser: "Lumi Kozmetik", caption: "Reklam Lumi Kozmetik" }).unverifiedPlatform).toBe(true);
  });

  describe("kampanya canlıya alma kapısı", () => {
    let campaignId: string;
    let deliverableId: string;
    beforeAll(async () => {
      await resetDb();
      const T = await makeTenant("Lumi Kozmetik");
      const inf = await prisma.influencer.create({ data: { name: "Test Inf", category: "güzellik", iban: "TR000000000000000000000001", ibanHolder: "Test", taxStatus: "FATURA", canIssueInvoice: true } });
      const c = await prisma.campaign.create({ data: { brandId: T.tenantId, name: "Bahar", slug: `bahar-${Date.now()}`, budgetKurus: 1, brandTotalFeeKurus: 1, startsAt: new Date(), endsAt: new Date(Date.now() + 86_400_000), targets: [] } });
      const a = await prisma.assignment.create({ data: { campaignId: c.id, influencerId: inf.id, feeKurus: 1, commissionKurus: 0, contractStatus: "KABUL" } });
      const d = await prisma.deliverable.create({
        data: { assignmentId: a.id, platform: "INSTAGRAM", contentType: "REELS", plannedAt: new Date(), approvalDeadline: new Date(), disclosureRequired: true, caption: "Çok sevdim #reklam", paidPartnershipToggle: true, usageRightsDays: 90, usageRightsChannel: "ORGANIK", usageRightsGeo: ["TR"] },
      });
      campaignId = c.id;
      deliverableId = d.id;
    });

    it("etiketsiz içerik varken BLOK", async () => {
      await expect(assertCampaignCanGoLive(campaignId)).rejects.toBeInstanceOf(CampaignGateError);
    });
    it("kullanım hakkı tanımsızsa BLOK", async () => {
      await prisma.deliverable.update({ where: { id: deliverableId }, data: { caption: "Reklam | Lumi Kozmetik", usageRightsDays: null } });
      const e = await assertCampaignCanGoLive(campaignId).catch((x) => x);
      expect(e).toBeInstanceOf(CampaignGateError);
      expect(JSON.stringify(e.details)).toContain("Kullanım hakkı");
    });
    it("uyumlu hale gelince geçer ve kare bazlı kontrol kaydı tutulur", async () => {
      await prisma.deliverable.update({ where: { id: deliverableId }, data: { usageRightsDays: 90 } });
      await expect(assertCampaignCanGoLive(campaignId)).resolves.toBeUndefined();
      expect((await prisma.disclosureCheck.findFirstOrThrow({ where: { deliverableId } })).compliant).toBe(true);
    });
  });
});
