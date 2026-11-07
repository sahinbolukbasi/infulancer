import { createHash, generateKeyPairSync, sign } from "node:crypto";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../src/db";
import { jobChargeTry, unitPriceTry } from "../src/creative/pricing";
import { audioUnits, planGeneration } from "../src/creative/adapters";
import { _resetJwksCache, verifyFalWebhook } from "../src/creative/fal-webhook-verify";
import { ensureStarterCredits, placeHold, topUp } from "../src/creative/credits";
import { handleFalWebhook, reconcileStaleJobs, setFalClient, submitCreative } from "../src/creative/fal";
import { seedModelRegistry } from "../src/creative/registry";
import { makeTenant, resetDb } from "./helpers";

describe("K36 Creative fiyatlandırma ve tahsilat doğruluğu", () => {
  let tenantId: string;
  beforeAll(async () => {
    await resetDb();
    await seedModelRegistry();
    tenantId = (await makeTenant("Fiyat")).tenantId;
  });
  afterEach(() => setFalClient(undefined));

  it("birim TL = USD × kur × markup; iş tutarı yukarı yuvarlanır, en az minTry", () => {
    expect(unitPriceTry(0.003, { usdTry: 50, markup: 3 })).toBe(0.45);
    expect(unitPriceTry(0.07, { usdTry: 50, markup: 3 })).toBe(10.5);
    expect(jobChargeTry(0.45, 1, 2)).toBe(2); // minimum ücret
    expect(jobChargeTry(10.5, 5, 2)).toBe(53); // 52,5 → 53
    expect(jobChargeTry(3, 2, 2)).toBe(6); // kayan nokta hatası 7'ye yuvarlamaz
  });

  it("süre ve oran modele gider; geçersiz süre reddedilir; ses birimi metinden hesaplanır", () => {
    const k = planGeneration({ modelKey: "kling-v2-5-turbo-pro", kind: "video", prompt: "x", aspect: "9:16", seconds: 10 });
    expect(k.units).toBe(10);
    expect(k.falInput).toMatchObject({ duration: "10", aspect_ratio: "9:16" });
    expect(() => planGeneration({ modelKey: "kling-v2-5-turbo-pro", kind: "video", prompt: "x", aspect: "9:16", seconds: 7 })).toThrow(/5 veya 10/);
    expect(planGeneration({ modelKey: "kling-v3-pro", kind: "video", prompt: "x", aspect: "16:9", seconds: 5 }).falInput).toMatchObject({ generate_audio: false });
    expect(planGeneration({ modelKey: "flux-schnell", kind: "image", prompt: "x", aspect: "9:16" }).falInput).toMatchObject({ image_size: "portrait_16_9" });
    expect(audioUnits("a".repeat(1000))).toBe(1);
    expect(audioUnits("a".repeat(1001))).toBe(2);
    expect(planGeneration({ modelKey: "elevenlabs-turbo-2-5", kind: "audio", prompt: "a".repeat(2500), aspect: "1:1" }).units).toBe(3);
    expect(() => planGeneration({ modelKey: "yok", kind: "image", prompt: "x", aspect: "1:1" })).toThrow();
  });

  it("fal webhook imzası: doğru imza geçer; gövde, zaman veya imza bozuksa reddedilir", async () => {
    const { publicKey, privateKey } = generateKeyPairSync("ed25519");
    const x = (publicKey.export({ format: "jwk" }) as { x: string }).x;
    const fetcher = (async () => new Response(JSON.stringify({ keys: [{ kty: "OKP", crv: "Ed25519", x }] }))) as typeof fetch;
    const body = new TextEncoder().encode(JSON.stringify({ request_id: "r1", status: "OK" }));
    const ts = String(Math.floor(Date.now() / 1000));
    const msg = `r1\nu1\n${ts}\n${createHash("sha256").update(body).digest("hex")}`;
    const signature = sign(null, Buffer.from(msg), privateKey).toString("hex");
    const h = { requestId: "r1", userId: "u1", timestamp: ts, signature };
    _resetJwksCache();
    expect(await verifyFalWebhook(h, body, { fetcher })).toBe(true);
    expect(await verifyFalWebhook(h, new TextEncoder().encode("{}"), { fetcher })).toBe(false);
    expect(await verifyFalWebhook(h, body, { fetcher, now: Date.now() + 10 * 60 * 1000 })).toBe(false);
    expect(await verifyFalWebhook({ ...h, signature: "00".repeat(64) }, body, { fetcher })).toBe(false);
    expect(await verifyFalWebhook({ ...h, signature: null }, body, { fetcher })).toBe(false);
    _resetJwksCache();
  });

  it("başlangıç bakiyesi tek sefer; yükleme ve tahsilat deftere işlenir, bakiye doğru düşer", async () => {
    const t = (await makeTenant("Defter")).tenantId;
    await ensureStarterCredits(t, 250);
    await ensureStarterCredits(t, 250);
    await topUp(t, 100, "test yükleme");
    let n = 0;
    setFalClient({
      async submit() {
        return { requestId: `req-ledger-${++n}` };
      },
      async download() {
        return { bytes: new Uint8Array([1, 2, 3]), mime: "image/png" };
      },
    });
    const job = await submitCreative({ tenantId: t, modelKey: "kling-v2-5-turbo-pro", prompt: "deniz kenarı", units: 5 });
    const model = await prisma.modelRegistry.findUniqueOrThrow({ where: { key: job.modelKey } });
    const expected = Math.max(2, Math.ceil(Number(model.creditsPerUnit) * 5 - 1e-9));
    let acc = await prisma.creditAccount.findUniqueOrThrow({ where: { tenantId: t } });
    expect(Number(acc.heldCredits)).toBe(expected);
    await handleFalWebhook({ request_id: job.requestId!, status: "OK", payload: { video: { url: "https://x/v.mp4" } } });
    await handleFalWebhook({ request_id: job.requestId!, status: "OK", payload: { video: { url: "https://x/v.mp4" } } }); // tekrar: ikinci tahsilat yok
    acc = await prisma.creditAccount.findUniqueOrThrow({ where: { tenantId: t } });
    expect(Number(acc.heldCredits)).toBe(0);
    expect(Number(acc.balanceCredits)).toBe(350 - expected);
    const rows = await prisma.creditLedger.findMany({ where: { tenantId: t }, orderBy: { createdAt: "asc" } });
    expect(rows.map((r) => r.kind)).toEqual(["STARTER", "TOPUP", "CHARGE"]);
    expect(rows.map((r) => Number(r.amount))).toEqual([250, 100, -expected]);
    expect(Number(rows[2]!.balanceAfter)).toBe(350 - expected);
    // Başarısız üretim: blokesi çözülür, deftere tahsilat düşmez.
    const failed = await submitCreative({ tenantId: t, modelKey: "flux-schnell", prompt: "kahve", units: 1 });
    await handleFalWebhook({ request_id: failed.requestId!, status: "ERROR", error: "x" });
    acc = await prisma.creditAccount.findUniqueOrThrow({ where: { tenantId: t } });
    expect(Number(acc.balanceCredits)).toBe(350 - expected);
    expect(Number(acc.heldCredits)).toBe(0);
    expect(await prisma.creditLedger.count({ where: { tenantId: t, kind: "CHARGE" } })).toBe(1);
  });

  it("uzlaştırma: webhook gelmeyen işi fal'dan sonuçlandırır, sahipsiz blokeleri çözer", async () => {
    const t = (await makeTenant("Uzlaştırma")).tenantId;
    await topUp(t, 500);
    setFalClient({
      async submit() {
        return { requestId: "req-reconcile" };
      },
      async download() {
        return { bytes: new Uint8Array([1]), mime: "image/png" };
      },
      async status() {
        return { status: "COMPLETED" };
      },
      async result() {
        return { images: [{ url: "https://x/i.png" }] };
      },
    });
    const job = await submitCreative({ tenantId: t, modelKey: "flux-schnell", prompt: "çiçek", units: 1 });
    const old = new Date(Date.now() - 3600 * 1000);
    await prisma.creativeJob.update({ where: { id: job.id }, data: { submittedAt: old } });
    // Gönderilemeden kalmış iş + hiçbir işe bağlanmamış eski bloke.
    const orphanHold = await placeHold(t, 40);
    await prisma.creativeJob.create({ data: { tenantId: t, modelKey: "flux-schnell", modelId: "-", prompt: "p", promptHash: "h", units: 1, status: "HELD", creditHoldId: orphanHold.id, createdAt: old } });
    const lostHold = await placeHold(t, 30);
    await prisma.creditHold.update({ where: { id: lostHold.id }, data: { createdAt: new Date(Date.now() - 7 * 3600 * 1000) } });
    const r = await reconcileStaleJobs();
    expect(r.settled).toBeGreaterThanOrEqual(3);
    expect((await prisma.creativeJob.findUniqueOrThrow({ where: { id: job.id } })).status).toBe("COMPLETED");
    const acc = await prisma.creditAccount.findUniqueOrThrow({ where: { tenantId: t } });
    expect(Number(acc.heldCredits)).toBe(0);
    expect(Number(acc.balanceCredits)).toBe(498); // yalnız tamamlanan iş (en az 2 TL) tahsil edildi
  });
});
