import { createHash } from "node:crypto";
import { chargeIn, creativePricing } from "./pricing";
import { tenantCurrency } from "./tenant";
import { prisma } from "../db";
import { envStr } from "../env";
import { objectStore } from "../channels/raw-store";
import { embedC2pa } from "./c2pa";
import { chargeHold, placeHold, releaseHold } from "./credits";
import { assertNoRealPersonClone } from "./md2712";
import { resolveModel } from "./registry";

/**
 * fal queue entegrasyonu.
 * submit: md. 27/12 kontrolü → model çözümle (lisans/deprecation) → kredi HOLD → queue.fal.run (webhook_url ile)
 * webhook: request_id DEDUPE → çıktıyı S3'e indir → C2PA göm → generated_assets → krediyi TAHSİL ET.
 * Webhook statüsü "OK" | "ERROR" (kuyruk durumlarından farklı sözlük). İptal edilen in-progress istek yine
 * tamamlanabilir → faturalama idempotent. Status/result URL'inde yalnız owner+app path (tam path 405 döner).
 */
export interface FalClient {
  submit(appPath: string, input: Record<string, unknown>, webhookUrl: string): Promise<{ requestId: string }>;
  /** Queue durumu (webhook kaçarsa uzlaştırma için). */
  status?(appPath: string, requestId: string): Promise<{ status: string; error?: string | null }>;
  result?(appPath: string, requestId: string): Promise<FalWebhook["payload"]>;
  download(url: string): Promise<{ bytes: Uint8Array; mime: string }>;
}

export function ownerAppPath(modelId: string): string {
  // <owner>/<app>/<alt yol> → status/result için yalnız <owner>/<app>
  return modelId.split("/").slice(0, 2).join("/");
}

let n = 0;
export const mockFal: FalClient = {
  async submit() {
    return { requestId: `req_mock_${Date.now()}_${++n}` };
  },
  async download() {
    return { bytes: new TextEncoder().encode("mock-image-bytes"), mime: "image/png" };
  },
};

export function httpFal(): FalClient {
  const key = envStr("FAL_KEY", "");
  return {
    async submit(appPath, input, webhookUrl) {
      const res = await fetch(`https://queue.fal.run/${appPath}?fal_webhook=${encodeURIComponent(webhookUrl)}`, {
        method: "POST",
        headers: { authorization: `Key ${key}`, "content-type": "application/json" },
        body: JSON.stringify(input),
        signal: AbortSignal.timeout(20_000),
      });
      if (!res.ok) throw new Error(`fal submit HTTP ${res.status}`);
      const j = (await res.json()) as { request_id: string };
      return { requestId: j.request_id };
    },
    async download(url) {
      const res = await fetch(url, { signal: AbortSignal.timeout(120_000) });
      if (!res.ok) throw new Error(`fal çıktısı indirilemedi: HTTP ${res.status}`);
      return { bytes: new Uint8Array(await res.arrayBuffer()), mime: res.headers.get("content-type") ?? "image/png" };
    },
    // Queue URL'leri yalnız sahip/uygulama (ilk iki segment) ile kurulur, uç yol eklenmez.
    async status(appPath, requestId) {
      const res = await fetch(`https://queue.fal.run/${queueApp(appPath)}/requests/${requestId}/status`, { headers: { authorization: `Key ${key}` }, signal: AbortSignal.timeout(15_000) });
      if (!res.ok) throw new Error(`fal status HTTP ${res.status}`);
      const j = (await res.json()) as { status: string; error?: string | null };
      return { status: j.status, error: j.error ?? null };
    },
    async result(appPath, requestId) {
      const res = await fetch(`https://queue.fal.run/${queueApp(appPath)}/requests/${requestId}`, { headers: { authorization: `Key ${key}` }, signal: AbortSignal.timeout(20_000) });
      if (!res.ok) throw new Error(`fal result HTTP ${res.status}`);
      return (await res.json()) as FalWebhook["payload"];
    },
  };
}

/** Model kimliğinin ilk iki parçası (sahip/uygulama): queue durum/sonuç yolu uç yolu içermez. */
export function queueApp(modelId: string): string {
  return modelId.split("/").slice(0, 2).join("/");
}
let override: FalClient | undefined;
export function fal(): FalClient {
  return override ?? (envStr("FAL_MODE", "mock") === "http" ? httpFal() : mockFal);
}
export function setFalClient(c: FalClient | undefined) {
  override = c;
}

export class CreativeRejectedError extends Error {}

/**
 * Üretim/düzenleme işini fal kuyruğuna gönderir. `falInput` verilirse modele bu gövde gider
 * (düzenleme modelleri kaynak görsel URL'si ister; bazıları prompt'u ayrıca ücretlendirir),
 * verilmezse yalnız { prompt }.
 */
export async function submitCreative(input: {
  tenantId: string;
  campaignId?: string;
  modelKey: string;
  prompt: string;
  units: number;
  referenceImageIsPortrait?: boolean;
  falInput?: Record<string, unknown>;
  inputUploadId?: string | null;
}) {
  const promptHash = createHash("sha256").update(input.prompt).digest("hex");
  try {
    await assertNoRealPersonClone({ prompt: input.prompt, referenceImageIsPortrait: input.referenceImageIsPortrait });
  } catch (e) {
    await prisma.creativeJob.create({
      data: { tenantId: input.tenantId, campaignId: input.campaignId, modelKey: input.modelKey, modelId: "-", prompt: input.prompt, promptHash, units: input.units, status: "REJECTED", rejectReason: (e as Error).message },
    });
    throw new CreativeRejectedError((e as Error).message);
  }
  const model = await resolveModel(input.modelKey);
  // Deterministik olmayan modellerde (Seedance, token bazlı) süre/çözünürlük tavanı.
  if (model.maxUnits != null && input.units > model.maxUnits) {
    throw new CreativeRejectedError(`${model.key} için üst sınır ${model.maxUnits} ${model.unit}.`);
  }
  // Bakiyeden düşecek tutar: tam TL, en az minTry (pricing.ts). Hold bu tutarla açılır, başarıda aynısı tahsil edilir.
  // Hesabın kendi para biriminde (TRY, EUR…): model fiyatı TL'den USD kuru üzerinden hesaplanır.
  const pricing = await creativePricing();
  const credits = chargeIn(Number(model.creditsPerUnit), input.units, pricing, await tenantCurrency(input.tenantId));
  const hold = await placeHold(input.tenantId, credits);
  const job = await prisma.creativeJob.create({
    data: { tenantId: input.tenantId, campaignId: input.campaignId, modelKey: model.key, modelId: model.modelId, prompt: input.prompt, promptHash, units: input.units, creditHoldId: hold.id, inputUploadId: input.inputUploadId ?? null, status: "HELD" },
  });
  try {
    const webhookUrl = `${envStr("APP_URL", "http://localhost:3000")}/api/webhooks/fal`;
    const { requestId } = await fal().submit(model.modelId, input.falInput ?? { prompt: input.prompt }, webhookUrl);
    return prisma.creativeJob.update({ where: { id: job.id }, data: { requestId, status: "IN_QUEUE", submittedAt: new Date() } });
  } catch (e) {
    await releaseHold(hold.id);
    await prisma.creativeJob.update({ where: { id: job.id }, data: { status: "FAILED", rejectReason: String((e as Error).message) } });
    throw e;
  }
}

export type FalWebhook = { request_id: string; status: "OK" | "ERROR"; payload?: { images?: { url: string }[]; image?: { url: string }; video?: { url: string }; audio?: { url: string } }; metrics?: { inference_time?: number }; error?: string };

/** fal webhook işleyicisi — idempotent. */
export async function handleFalWebhook(w: FalWebhook) {
  const job = await prisma.creativeJob.findUnique({ where: { requestId: w.request_id } });
  if (!job) return { handled: false, reason: "bilinmeyen request_id" };
  // DEDUPE: yalnız tamamlanmamış iş bir kez işlenir.
  const claim = await prisma.creativeJob.updateMany({ where: { id: job.id, status: { in: ["IN_QUEUE", "IN_PROGRESS", "CANCELLED"] } }, data: { status: "IN_PROGRESS" } });
  if (claim.count !== 1) return { handled: false, reason: "zaten işlendi" };

  if (w.status !== "OK") {
    if (job.creditHoldId) await releaseHold(job.creditHoldId);
    await prisma.creativeJob.update({ where: { id: job.id }, data: { status: "FAILED", rejectReason: w.error ?? "fal ERROR", completedAt: new Date() } });
    return { handled: true, status: "FAILED" as const };
  }
  const url = w.payload?.images?.[0]?.url ?? w.payload?.image?.url ?? w.payload?.video?.url ?? w.payload?.audio?.url;
  let out: { bytes: Uint8Array; mime: string };
  try {
    if (!url) throw new Error("fal çıktısında dosya yok");
    out = await fal().download(url);
  } catch (e) {
    // Çıktı alınamadı: kullanıcı ödemez (bloke serbest), iş başarısız. fal tarafı ayrıca incelenir.
    if (job.creditHoldId) await releaseHold(job.creditHoldId);
    await prisma.creativeJob.update({ where: { id: job.id }, data: { status: "FAILED", rejectReason: `Çıktı alınamadı: ${(e as Error).message}`.slice(0, 300), completedAt: new Date() } });
    return { handled: true, status: "FAILED" as const };
  }
  const c2pa = embedC2pa({ assetBytes: out.bytes, mime: out.mime, modelKey: job.modelKey, modelId: job.modelId, tenantId: job.tenantId, promptHash: job.promptHash });
  const key = `generated/${job.tenantId}/${job.id}`;
  await objectStore().put(key, c2pa.signedBytes, out.mime);
  await objectStore().put(`${key}.c2pa.json`, c2pa.sidecarJson, "application/json");
  const asset = await prisma.$transaction(async (tx) => {
    const a = await tx.generatedAsset.create({
      data: { tenantId: job.tenantId, campaignId: job.campaignId, jobId: job.id, modelKey: job.modelKey, modelId: job.modelId, promptHash: job.promptHash, s3Key: key, c2paManifestId: c2pa.manifestId, isAiGenerated: true },
    });
    if (job.creditHoldId) await chargeHold(job.creditHoldId, tx);
    await tx.creativeJob.update({ where: { id: job.id }, data: { status: "COMPLETED", completedAt: new Date(), inferenceMs: w.metrics?.inference_time != null ? Math.round(w.metrics.inference_time * 1000) : null } });
    return a;
  });
  // Çok adımlı düzenleme: kalan adım varsa çıktı bir sonraki adımın girdisi olur.
  if (job.pipeline) {
    const { continuePipeline } = await import("./edit");
    await continuePipeline(job.id, asset.id).catch((e) => console.error("[creative] zincir", job.id, (e as Error).message));
  }
  return { handled: true, status: "COMPLETED" as const, assetId: asset.id };
}


/**
 * Uzlaştırma: webhook'u gelmeyen işleri fal queue'dan sorgular ve sonuçlandırır; böylece
 * bakiye bloke kalmaz. Ayrıca fal'a hiç gönderilememiş (HELD) eski işlerin blokesi çözülür.
 * Creative sayfası açılırken ve zamanlanmış görevle çağrılır; aynı anda tek çalışma.
 */
let reconciling = false;
export async function reconcileStaleJobs(opts: { olderThanMs?: number; giveUpAfterMs?: number } = {}): Promise<{ checked: number; settled: number }> {
  if (reconciling) return { checked: 0, settled: 0 };
  reconciling = true;
  let checked = 0;
  let settled = 0;
  try {
    const older = new Date(Date.now() - (opts.olderThanMs ?? 2 * 60 * 1000));
    const giveUp = new Date(Date.now() - (opts.giveUpAfterMs ?? 6 * 3600 * 1000));
    // fal'a gönderilmeden kalmış işler (gönderim sırasında süreç çöktü): blokeyi çöz.
    const orphans = await prisma.creativeJob.findMany({ where: { status: "HELD", createdAt: { lt: older } }, take: 50 });
    for (const j of orphans) {
      if (j.creditHoldId) await releaseHold(j.creditHoldId);
      await prisma.creativeJob.update({ where: { id: j.id }, data: { status: "FAILED", rejectReason: "Gönderim tamamlanamadı; ücret alınmadı.", completedAt: new Date() } });
      settled++;
    }
    // İşe hiç bağlanamamış eski blokeler (hold açıldı, iş kaydı yazılamadan süreç düştü).
    const staleHolds = await prisma.creditHold.findMany({ where: { status: "held", createdAt: { lt: giveUp } }, select: { id: true }, take: 50 });
    for (const h of staleHolds) {
      const linked = await prisma.creativeJob.findFirst({ where: { creditHoldId: h.id }, select: { id: true } });
      if (!linked && (await releaseHold(h.id))) settled++;
    }
    const client = fal();
    if (!client.status || !client.result) return { checked, settled };
    const stale = await prisma.creativeJob.findMany({ where: { status: { in: ["IN_QUEUE", "IN_PROGRESS"] }, requestId: { not: null }, submittedAt: { lt: older } }, orderBy: { submittedAt: "asc" }, take: 20 });
    for (const j of stale) {
      checked++;
      try {
        const st = await client.status(j.modelId, j.requestId!);
        if (st.status === "COMPLETED") {
          if (st.error) await handleFalWebhook({ request_id: j.requestId!, status: "ERROR", error: st.error });
          else await handleFalWebhook({ request_id: j.requestId!, status: "OK", payload: await client.result(j.modelId, j.requestId!) });
          settled++;
        } else if (j.submittedAt && j.submittedAt < giveUp) {
          await handleFalWebhook({ request_id: j.requestId!, status: "ERROR", error: "Zaman aşımı (6 saat); ücret alınmadı." });
          settled++;
        }
      } catch (e) {
        console.error("[fal] uzlaştırma", j.id, (e as Error).message);
      }
    }
  } finally {
    reconciling = false;
  }
  return { checked, settled };
}
