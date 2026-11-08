import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../src/db";
import { orderSteps, pipelineCost, submitEditPipeline } from "../src/creative/edit";
import { planFromKeywords } from "../src/creative/video-brief";
import { buildFfmpegArgs, videoOpsSchema } from "../src/creative/video-edit";
import { submitGeneration } from "../src/creative/generate";
import { topUp } from "../src/creative/credits";
import { setFalClient } from "../src/creative/fal";
import { AGENCY_TENANT } from "../src/creative/tenant";
import { makeTenant, resetDb } from "./helpers";

describe("K39 Creative v2: çoklu AI düzenleme, referanslı üretim, brief ile video", () => {
  let tenantId: string;
  let other: string;
  beforeAll(async () => {
    await resetDb();
    tenantId = (await makeTenant("Stüdyo v2")).tenantId;
    other = (await makeTenant("Diğer")).tenantId;
    let n = 0;
    setFalClient({ async submit() { return { requestId: `req-v2-${++n}` }; }, async download() { return { bytes: new Uint8Array([1]), mime: "image/png" }; } });
  });

  it("düzenlemeler sabit sıraya dizilir; tek video adımı; tekrarlar atılır", () => {
    const s = orderSteps([
      { action: "netlestir", prompt: null },
      { action: "videoya-cevir-ekonomik", prompt: "dönsün" },
      { action: "prompt-duzenle", prompt: "arka plan pembe" },
      { action: "netlestir", prompt: null },
    ]);
    expect(s.map((x) => x.action)).toEqual(["prompt-duzenle", "netlestir", "videoya-cevir-ekonomik"]);
    expect(() => orderSteps([{ action: "videoya-cevir", prompt: "a" }, { action: "videoya-cevir-ekonomik", prompt: "b" }])).toThrow(/bir video/);
    expect(() => orderSteps([])).toThrow(/En az bir/);
  });

  it("zincir: toplam tutar baştan kontrol edilir, ilk adım gönderilir, kalanlar sıraya yazılır", async () => {
    const up = await prisma.creativeUpload.create({ data: { tenantId, kind: "image", mime: "image/png", sizeBytes: 10, s3Key: `uploads/${tenantId}/a.png` } });
    const steps = [
      { action: "arka-plan-kaldir" as const, prompt: null },
      { action: "netlestir" as const, prompt: null },
    ];
    const total = await pipelineCost(steps);
    await expect(submitEditPipeline({ tenantId, uploadId: up.id, steps })).rejects.toThrow(/toplamı/);
    await topUp(tenantId, total);
    const job = await submitEditPipeline({ tenantId, uploadId: up.id, steps });
    expect(job.modelKey).toBe("bria-bg-remove");
    const saved = await prisma.creativeJob.findUniqueOrThrow({ where: { id: job.id } });
    expect((saved.pipeline as { action: string }[]).map((p) => p.action)).toEqual(["netlestir"]);
    // Başka hesabın dosyası düzenlenemez.
    await expect(submitEditPipeline({ tenantId: other, uploadId: up.id, steps })).rejects.toThrow(/bulunamadı/i);
  });

  it("referanslı üretim: görselde nano-banana-edit, videoda i2v; video referansı reddedilir", async () => {
    await topUp(tenantId, 500);
    const img = await prisma.creativeUpload.create({ data: { tenantId, kind: "image", mime: "image/png", sizeBytes: 10, s3Key: `uploads/${tenantId}/r.png` } });
    const vid = await prisma.creativeUpload.create({ data: { tenantId, kind: "video", mime: "video/mp4", sizeBytes: 10, s3Key: `uploads/${tenantId}/v.mp4` } });
    const a = await submitGeneration({ tenantId, modelKey: "nano-banana", prompt: "ürünü sahilde göster", aspect: "1:1", referenceUploadIds: [img.id] });
    expect(a.modelKey).toBe("nano-banana-edit");
    const b = await submitGeneration({ tenantId, modelKey: "kling-v2-5-turbo-pro", prompt: "ürün yavaşça dönsün", aspect: "9:16", seconds: 10, referenceUploadIds: [img.id] });
    expect(b.modelKey).toBe("kling-v2-5-i2v");
    expect(Number(b.units)).toBe(10);
    const c = await submitGeneration({ tenantId, modelKey: "ltxv-distilled", prompt: "ürün yavaşça dönsün", aspect: "9:16", referenceUploadIds: [img.id] });
    expect(c.modelKey).toBe("hailuo-02-fast-i2v");
    await expect(submitGeneration({ tenantId, modelKey: "nano-banana", prompt: "videodan görsel", aspect: "1:1", referenceUploadIds: [vid.id] })).rejects.toThrow(/yalnız görsel/);
  });

  it("ajans hesabı ayrıdır: bakiyesi yoksa üretemez, marka bakiyesi etkilenmez", async () => {
    const before = await prisma.creditAccount.findUniqueOrThrow({ where: { tenantId } });
    await expect(submitGeneration({ tenantId: AGENCY_TENANT, modelKey: "flux-schnell", prompt: "kahve fincanı stüdyo", aspect: "1:1" })).rejects.toThrow(/yetersiz/i);
    await topUp(AGENCY_TENANT, 50);
    const j = await submitGeneration({ tenantId: AGENCY_TENANT, modelKey: "flux-schnell", prompt: "kahve fincanı stüdyo", aspect: "1:1" });
    expect(j.tenantId).toBe(AGENCY_TENANT);
    const after = await prisma.creditAccount.findUniqueOrThrow({ where: { tenantId } });
    expect(Number(after.heldCredits)).toBe(Number(before.heldCredits));
  });

  it("brief → video düzenleme planı (kural çözümleyici)", () => {
    const p = planFromKeywords("İlk 15 saniyeyi story formatında, canlı renklerle, hızlı ve sessiz yap; yumuşak geçiş", 40);
    expect(p.ops).toMatchObject({ aspect: "9:16", trimStart: 0, trimEnd: 15, speed: 1.5, mute: true, look: "canli", fade: true });
    expect(planFromKeywords("son 10 saniye yatay siyah beyaz", 30).ops).toMatchObject({ aspect: "16:9", trimStart: 20, trimEnd: 30, look: "siyah-beyaz" });
    expect(planFromKeywords("kare format 2x", null).ops).toMatchObject({ aspect: "1:1", speed: 2 });
  });

  it("ffmpeg: renk görünümü ve geçiş filtreleri", () => {
    const args = buildFfmpegArgs("in.mp4", "out.mp4", videoOpsSchema.parse({ trimStart: 0, trimEnd: 10, look: "siyah-beyaz", fade: true }), 30);
    const vf = args[args.indexOf("-vf") + 1]!;
    expect(vf).toContain("hue=s=0");
    expect(vf).toContain("fade=t=in:st=0:d=0.5");
    expect(vf).toContain("fade=t=out:st=9.50:d=0.5");
  });
});
