import { createHash } from "node:crypto";
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
      const res = await fetch(url, { signal: AbortSignal.timeout(60_000) });
      return { bytes: new Uint8Array(await res.arrayBuffer()), mime: res.headers.get("content-type") ?? "image/png" };
    },
  };
}

let override: FalClient | undefined;
export function fal(): FalClient {
  return override ?? (envStr("FAL_MODE", "mock") === "http" ? httpFal() : mockFal);
}
export function setFalClient(c: FalClient | undefined) {
  override = c;
}

export class CreativeRejectedError extends Error {}

export async function submitCreative(input: { tenantId: string; campaignId?: string; modelKey: string; prompt: string; units: number; referenceImageIsPortrait?: boolean }) {
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
  const credits = Math.ceil(Number(model.creditsPerUnit) * input.units * 1000) / 1000;
  const hold = await placeHold(input.tenantId, credits);
  const job = await prisma.creativeJob.create({
    data: { tenantId: input.tenantId, campaignId: input.campaignId, modelKey: model.key, modelId: model.modelId, prompt: input.prompt, promptHash, units: input.units, creditHoldId: hold.id, status: "HELD" },
  });
  try {
    const webhookUrl = `${envStr("APP_URL", "http://localhost:3000")}/api/webhooks/fal`;
    const { requestId } = await fal().submit(model.modelId, { prompt: input.prompt }, webhookUrl);
    return prisma.creativeJob.update({ where: { id: job.id }, data: { requestId, status: "IN_QUEUE", submittedAt: new Date() } });
  } catch (e) {
    await releaseHold(hold.id);
    await prisma.creativeJob.update({ where: { id: job.id }, data: { status: "FAILED", rejectReason: String((e as Error).message) } });
    throw e;
  }
}

export type FalWebhook = { request_id: string; status: "OK" | "ERROR"; payload?: { images?: { url: string }[]; video?: { url: string }; audio?: { url: string } }; metrics?: { inference_time?: number }; error?: string };

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
  const url = w.payload?.images?.[0]?.url ?? w.payload?.video?.url ?? w.payload?.audio?.url;
  if (!url) throw new Error("fal çıktısında URL yok");
  const out = await fal().download(url);
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
  return { handled: true, status: "COMPLETED" as const, assetId: asset.id };
}
