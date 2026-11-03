import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../src/db";
import { KvkkGateError, setTenantMode, signStandardContract, uploadFilingReceipt } from "../src/compliance/kvkk";
import { recordEarning } from "../src/domain/ledger";
import { requestPayout } from "../src/domain/payouts";
import { taxGateForPayout, unlockOtherStatus, upsertTaxProfile } from "../src/domain/tax-profile";
import { makeTenant, resetDb } from "./helpers";

describe("vergi ve KVKK kapıları", () => {
  beforeAll(resetDb);

  // Kriter 14
  describe("K14 20/B creator'a designated_iban dışına ödeme yapılamaz", () => {
    const designated = "TR330006100519786457841326";
    let influencerId: string;
    beforeAll(async () => {
      const inf = await prisma.influencer.create({ data: { name: "Yirmi Be", category: "moda", iban: "TR110006100519786457841300", ibanHolder: "Yirmi Be", taxStatus: "FATURA", canIssueInvoice: false } });
      influencerId = inf.id;
      await upsertTaxProfile(inf.id, { status: "istisna_20b", designatedIban: designated, istisnaBelgesiS3Key: "tax/20b.pdf" });
    });

    it("servis kontrolü farklı IBAN'ı reddeder, belirlenmiş IBAN'ı kabul eder", async () => {
      expect((await taxGateForPayout(influencerId, "TR110006100519786457841300")).ok).toBe(false);
      expect((await taxGateForPayout(influencerId, "TR33 0006 1005 1978 6457 8413 26")).ok).toBe(true);
    });

    it("DB trigger: farklı IBAN'la ödeme talebi yazılamaz (servis atlansa bile)", async () => {
      await expect(prisma.payoutRequest.create({ data: { influencerId, amountKurus: 100000, ibanSnapshot: "TR110006100519786457841300", ibanHolderSnapshot: "Y" } })).rejects.toThrow(/20\/B/);
      const ok = await prisma.payoutRequest.create({ data: { influencerId, amountKurus: 100000, ibanSnapshot: designated, ibanHolderSnapshot: "Y" } });
      await expect(prisma.payoutRequest.update({ where: { id: ok.id }, data: { ibanSnapshot: "TR110006100519786457841300" } })).rejects.toThrow(/20\/B/);
    });

    it("'diger' statüsü admin + mali müşavir görüşü olmadan kilitli", async () => {
      const inf = await prisma.influencer.create({ data: { name: "Fatura Yok", category: "moda", iban: "TR440006100519786457841399", ibanHolder: "F", taxStatus: "STOPAJLI", canIssueInvoice: false } });
      await upsertTaxProfile(inf.id, { status: "diger" });
      expect((await taxGateForPayout(inf.id, inf.iban)).ok).toBe(false);
      const admin = await prisma.user.create({ data: { email: "adm-tax@ex.com", name: "A", role: "ADMIN", passwordHash: "x" } });
      await unlockOtherStatus(inf.id, admin.id, "tax/musavir-gorusu.pdf");
      expect((await taxGateForPayout(inf.id, inf.iban)).ok).toBe(true);
    });

    it("requestPayout yolu vergi kapısından geçer", async () => {
      const inf = await prisma.influencer.create({ data: { name: "Profilsiz", category: "moda", iban: "TR550006100519786457841311", ibanHolder: "P", taxStatus: "FATURA", canIssueInvoice: true } });
      const u = await prisma.user.create({ data: { email: "inf-tax@ex.com", name: "P", role: "INFLUENCER", influencerId: inf.id, passwordHash: "x" } });
      const brand = (await makeTenant("Vergi Marka")).tenantId;
      const c = await prisma.campaign.create({ data: { brandId: brand, name: "C", slug: `c-${Date.now()}`, budgetKurus: 1, brandTotalFeeKurus: 1, startsAt: new Date(Date.now() - 864e5 * 30), endsAt: new Date(), targets: [] } });
      const a = await prisma.assignment.create({ data: { campaignId: c.id, influencerId: inf.id, feeKurus: 500000, commissionKurus: 0, contractStatus: "KABUL" } });
      const d = await prisma.deliverable.create({ data: { assignmentId: a.id, platform: "INSTAGRAM", contentType: "REELS", plannedAt: new Date(Date.now() - 864e5 * 20), approvalDeadline: new Date(), disclosureRequired: true, status: "TAMAMLANDI" } });
      await prisma.$transaction((tx) => recordEarning(tx, { deliverableId: d.id }, new Date(Date.now() - 864e5 * 20)) as never).catch(() => undefined);
      const actor = { userId: u.id, role: "INFLUENCER" as const, influencerId: inf.id, brandId: null, name: "P", email: u.email };
      const err = await requestPayout(actor as never, 60000).catch((e) => e);
      expect(String(err?.message ?? "")).toMatch(/Vergi profili|Çekilebilir/);
    });
  });

  // Kriter 15
  describe("K15 KVKK makbuzu olmadan production yok", () => {
    it("makbuz yüklenmeden production BLOK, iki aktarımın makbuzu ile geçer", async () => {
      const T = await makeTenant("KVKK");
      await expect(setTenantMode(T.tenantId, "production")).rejects.toBeInstanceOf(KvkkGateError);
      const { dueAt } = await signStandardContract(T.tenantId, new Date("2026-11-06T10:00:00+03:00"));
      expect(dueAt.toISOString()).toBe("2026-11-13T21:00:00.000Z"); // 5 iş günü
      await uploadFilingReceipt(T.tenantId, "aws_eu_central_1", "kvkk/aws.pdf");
      await expect(setTenantMode(T.tenantId, "production")).rejects.toThrow(/Meta/);
      await uploadFilingReceipt(T.tenantId, "meta_cloud_api", "kvkk/meta.pdf");
      expect((await setTenantMode(T.tenantId, "production")).mode).toBe("production");
    });
  });
});
