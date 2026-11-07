import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../src/db";
import { buildFfmpegArgs, videoOpsSchema } from "../src/creative/video-edit";
import { getOwnedUpload, kindOfMime, presignCreativeUpload } from "../src/creative/uploads";
import { submitImageEdit } from "../src/creative/edit";
import { topUp } from "../src/creative/credits";
import { seedModelRegistry } from "../src/creative/registry";
import { makeTenant, resetDb } from "./helpers";

describe("K35 Creative stüdyo: yükleme ve düzenleme", () => {
  let tenantId: string;
  let otherTenant: string;
  beforeAll(async () => {
    await resetDb();
    await seedModelRegistry();
    tenantId = (await makeTenant("Stüdyo")).tenantId;
    otherTenant = (await makeTenant("Başka")).tenantId;
  });

  it("dosya türlerini ayırt eder, desteklenmeyeni ve büyük dosyayı reddeder", async () => {
    expect(kindOfMime("image/png")).toBe("image");
    expect(kindOfMime("video/mp4")).toBe("video");
    expect(kindOfMime("application/pdf")).toBeNull();
    await expect(presignCreativeUpload(tenantId, "application/pdf", 100)).rejects.toThrow(/JPEG/);
    await expect(presignCreativeUpload(tenantId, "image/png", 20 * 1024 * 1024)).rejects.toThrow(/15 MB/);
    await expect(presignCreativeUpload(tenantId, "video/mp4", 200 * 1024 * 1024)).rejects.toThrow(/100 MB/);
    const ok = await presignCreativeUpload(tenantId, "video/mp4", 5 * 1024 * 1024);
    expect(ok.key).toMatch(new RegExp(`^uploads/${tenantId}/[a-f0-9-]{36}\\.mp4$`));
  });

  it("başka tenant'ın dosyasına erişilemez", async () => {
    const u = await prisma.creativeUpload.create({ data: { tenantId: otherTenant, kind: "image", mime: "image/png", sizeBytes: 10, s3Key: `uploads/${otherTenant}/x.png` } });
    await expect(getOwnedUpload(tenantId, u.id)).rejects.toThrow(/bulunamadı/i);
    expect((await getOwnedUpload(otherTenant, u.id)).id).toBe(u.id);
  });

  it("ffmpeg argümanları: kırpma, 9:16 kadraj, 2x hız, ses kapalı, 60 sn tavanı", () => {
    const ops = videoOpsSchema.parse({ trimStart: 2, trimEnd: 200, aspect: "9:16", speed: 2, mute: true });
    const args = buildFfmpegArgs("in.mp4", "out.mp4", ops, 300);
    expect(args.slice(args.indexOf("-ss"), args.indexOf("-ss") + 4)).toEqual(["-ss", "2", "-to", "62"]); // 60 sn tavanı
    const vf = args[args.indexOf("-vf") + 1]!;
    expect(vf).toContain("crop=");
    expect(vf).toContain("setpts=PTS/2");
    expect(args).toContain("-an");
    expect(args).not.toContain("atempo=2");
    expect(() => buildFfmpegArgs("in.mp4", "out.mp4", videoOpsSchema.parse({ trimStart: 10, trimEnd: 5 }), 30)).toThrow(/Bitiş/);
  });

  it("AI düzenleme: komut zorunlu, video dosyasında görsel düzenleme reddedilir, bakiye düşer", async () => {
    await topUp(tenantId, 100);
    const img = await prisma.creativeUpload.create({ data: { tenantId, kind: "image", mime: "image/png", sizeBytes: 10, s3Key: `uploads/${tenantId}/a.png`, name: "ürün" } });
    const vid = await prisma.creativeUpload.create({ data: { tenantId, kind: "video", mime: "video/mp4", sizeBytes: 10, s3Key: `uploads/${tenantId}/a.mp4` } });
    await expect(submitImageEdit({ tenantId, uploadId: img.id, action: "prompt-duzenle", prompt: "x" })).rejects.toThrow(/komut/);
    await expect(submitImageEdit({ tenantId, uploadId: vid.id, action: "netlestir" })).rejects.toThrow(/görsel/);
    await expect(submitImageEdit({ tenantId, uploadId: img.id, action: "yok" })).rejects.toThrow(/Geçersiz/);
    const job = await submitImageEdit({ tenantId, uploadId: img.id, action: "arka-plan-kaldir" });
    expect(job.modelKey).toBe("bria-bg-remove");
    expect(job.inputUploadId).toBe(img.id);
    const held = await prisma.creditAccount.findUniqueOrThrow({ where: { tenantId } });
    expect(Number(held.heldCredits)).toBe(3); // 0,018 $ × 50,18 × 3 = 2,71 → 3 TL bloke
  });

  it("gerçek kişi koruması yalnız üretken düzenlemede uygulanır", async () => {
    const img = await prisma.creativeUpload.create({ data: { tenantId, kind: "image", mime: "image/png", sizeBytes: 10, s3Key: `uploads/${tenantId}/b.png` } });
    await expect(submitImageEdit({ tenantId, uploadId: img.id, action: "prompt-duzenle", prompt: "arka planı plaj yap", portrait: true })).rejects.toThrow();
    const ok = await submitImageEdit({ tenantId, uploadId: img.id, action: "netlestir", portrait: true });
    expect(ok.modelKey).toBe("esrgan-upscale");
  });
});
