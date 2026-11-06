import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../src/db";
import { memoryStore } from "../src/channels/raw-store";
import { ensureStarterCredits, topUp } from "../src/creative/credits";
import { CreativeRejectedError, handleFalWebhook, submitCreative } from "../src/creative/fal";
import { assertNoRealPersonClone, RealPersonBlockedError } from "../src/creative/md2712";
import { ModelUnavailableError, resolveModel } from "../src/creative/registry";
import { makeTenant, resetDb } from "./helpers";

describe("creative üretimi", () => {
  let T: Awaited<ReturnType<typeof makeTenant>>;
  beforeAll(async () => {
    await resetDb();
    T = await makeTenant("Creative");
    await topUp(T.tenantId, 100);
  });

  // Kriter 12
  describe("K12 C2PA manifest + generated_assets model izi", () => {
    it("başarılı üretimde varlık C2PA manifest'iyle kaydedilir ve kredi webhook'ta tahsil edilir", async () => {
      const job = await submitCreative({ tenantId: T.tenantId, modelKey: "nano-banana-pro", prompt: "Pastel arka planda ruj ürün fotoğrafı", units: 2 });
      expect(job.status).toBe("IN_QUEUE");
      let acc = await prisma.creditAccount.findUniqueOrThrow({ where: { tenantId: T.tenantId } });
      expect(Number(acc.heldCredits)).toBe(6);
      expect(Number(acc.balanceCredits)).toBe(100);

      const r = await handleFalWebhook({ request_id: job.requestId!, status: "OK", payload: { images: [{ url: "https://fal.media/x.png" }] }, metrics: { inference_time: 2.5 } });
      expect(r.status).toBe("COMPLETED");
      const asset = await prisma.generatedAsset.findFirstOrThrow({ where: { jobId: job.id } });
      expect(asset).toMatchObject({ modelKey: "nano-banana-pro", modelId: "fal-ai/nano-banana-pro", isAiGenerated: true });
      expect(asset.c2paManifestId).toMatch(/^[0-9a-f-]{36}$/);
      expect(await memoryStore.has(`${asset.s3Key}.c2pa.json`)).toBe(true);
      acc = await prisma.creditAccount.findUniqueOrThrow({ where: { tenantId: T.tenantId } });
      expect(Number(acc.heldCredits)).toBe(0);
      expect(Number(acc.balanceCredits)).toBe(94);
    });

    it("webhook retry'ı ikinci varlık ve ikinci tahsilat üretmez", async () => {
      const job = await submitCreative({ tenantId: T.tenantId, modelKey: "nano-banana", prompt: "Kahve fincanı", units: 1 });
      const w = { request_id: job.requestId!, status: "OK" as const, payload: { images: [{ url: "https://fal.media/y.png" }] } };
      await handleFalWebhook(w);
      expect((await handleFalWebhook(w)).handled).toBe(false);
      expect(await prisma.generatedAsset.count({ where: { jobId: job.id } })).toBe(1);
    });

    it("ERROR durumunda hold serbest bırakılır, ücret alınmaz", async () => {
      const before = Number((await prisma.creditAccount.findUniqueOrThrow({ where: { tenantId: T.tenantId } })).balanceCredits);
      const job = await submitCreative({ tenantId: T.tenantId, modelKey: "nano-banana-2", prompt: "Gözlük", units: 1 });
      await handleFalWebhook({ request_id: job.requestId!, status: "ERROR", error: "runner failed" });
      const acc = await prisma.creditAccount.findUniqueOrThrow({ where: { tenantId: T.tenantId } });
      expect(Number(acc.balanceCredits)).toBe(before);
      expect(Number(acc.heldCredits)).toBe(0);
    });
  });

  // Kriter 13
  describe("K13 license_status != cleared model müşteri işinde çalışmaz", () => {
    it("pending/restricted model reddedilir, kredi bloke edilmez", async () => {
      await expect(resolveModel("gpt-image-2")).rejects.toBeInstanceOf(ModelUnavailableError);
      await expect(resolveModel("flux-schnell")).rejects.toThrow(/lisans/);
      await prisma.modelRegistry.update({ where: { key: "nano-banana" }, data: { licenseStatus: "restricted" } });
      const held = Number((await prisma.creditAccount.findUniqueOrThrow({ where: { tenantId: T.tenantId } })).heldCredits);
      await expect(submitCreative({ tenantId: T.tenantId, modelKey: "nano-banana", prompt: "x", units: 1 })).rejects.toBeInstanceOf(ModelUnavailableError);
      expect(Number((await prisma.creditAccount.findUniqueOrThrow({ where: { tenantId: T.tenantId } })).heldCredits)).toBe(held);
    });
    it("deprecated model replacement_key'e yönlenir", async () => {
      expect((await resolveModel("kling-2-1-pro")).key).toBe("kling-v2-5-turbo-pro");
    });
    it("deterministik olmayan modelde üst sınır uygulanır", async () => {
      await expect(submitCreative({ tenantId: T.tenantId, modelKey: "seedance-2", prompt: "video", units: 10_000 })).rejects.toBeInstanceOf(CreativeRejectedError);
    });
  });

  describe("md. 27/12 HARD-BLOCK", () => {
    it("face swap / ses klonlama / gerçek kişi adı / referans portre reddedilir", async () => {
      await expect(assertNoRealPersonClone({ prompt: "Influencer'ın yüzüyle ruj süren video" }, [])).rejects.toBeInstanceOf(RealPersonBlockedError);
      await expect(assertNoRealPersonClone({ prompt: "sesini klonla ve ürünü önersin" }, [])).rejects.toBeInstanceOf(RealPersonBlockedError);
      await expect(assertNoRealPersonClone({ prompt: "Zeynep Yıldız bu ruju kullanıyor" }, ["Zeynep Yıldız"])).rejects.toThrow(/md\. 27\/12/);
      await expect(assertNoRealPersonClone({ prompt: "ürün", referenceImageIsPortrait: true }, [])).rejects.toBeInstanceOf(RealPersonBlockedError);
      await expect(assertNoRealPersonClone({ prompt: "Pastel stüdyoda ruj ürün çekimi" }, ["Zeynep Yıldız"])).resolves.toBeUndefined();
    });
    it("reddedilen iş gerekçesiyle kaydedilir, kredi bloke edilmez", async () => {
      await prisma.influencer.create({ data: { name: "Kaan Arslan", category: "spor", iban: "TR1", ibanHolder: "K", taxStatus: "FATURA", canIssueInvoice: true } });
      await expect(submitCreative({ tenantId: T.tenantId, modelKey: "nano-banana-pro", prompt: "Kaan Arslan bu ayakkabıyı giyiyor", units: 1 })).rejects.toBeInstanceOf(CreativeRejectedError);
      const j = await prisma.creativeJob.findFirstOrThrow({ where: { tenantId: T.tenantId, status: "REJECTED" } });
      expect(j.rejectReason).toMatch(/27\/12/);
    });
  });
  describe("hoş geldin kredisi", () => {
    it("hesabı olmayan tenant'a bir kez başlangıç kredisi açar, mevcut bakiyeye dokunmaz", async () => {
      const tid = `inf_${Date.now()}`;
      await ensureStarterCredits(tid, 30);
      await ensureStarterCredits(tid, 30);
      const acc = await prisma.creditAccount.findUniqueOrThrow({ where: { tenantId: tid } });
      expect(Number(acc.balanceCredits)).toBe(30);
      const before = await prisma.creditAccount.findUniqueOrThrow({ where: { tenantId: T.tenantId } });
      await ensureStarterCredits(T.tenantId, 30);
      const after = await prisma.creditAccount.findUniqueOrThrow({ where: { tenantId: T.tenantId } });
      expect(Number(after.balanceCredits)).toBe(Number(before.balanceCredits));
    });
  });
});
