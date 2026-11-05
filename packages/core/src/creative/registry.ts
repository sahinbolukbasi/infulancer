import { prisma } from "../db";
import { getConfig } from "../config/store";
import { notifyAdmins } from "../agents/common";

/**
 * Model kaydı: model ID'leri KODDA DEĞİL bu tabloda; ~12 aylık model ömrü varsayılır.
 * Deprecated modele gelen iş replacement_key'e yönlenir ve admin uyarılır.
 * license_status != 'cleared' olan model müşteri işinde ÇALIŞMAZ (FLUX lisans riski, fal'dan yazılı
 * teyit gelene kadar FLUX ve araştırma-kökenli modeller pending + feature flag kapalı).
 */
export class ModelUnavailableError extends Error {}

export async function resolveModel(key: string, depth = 0): Promise<NonNullable<Awaited<ReturnType<typeof prisma.modelRegistry.findUnique>>>> {
  const m = await prisma.modelRegistry.findUnique({ where: { key } });
  if (!m) throw new ModelUnavailableError(`Model kaydı bulunamadı: ${key}`);
  if (m.status !== "active") {
    if (m.replacementKey && depth < 3) {
      await notifyAdmins("Deprecated model kullanımı", `${key} kullanım dışı; iş ${m.replacementKey} modeline yönlendirildi.`, "/admin/creative");
      return resolveModel(m.replacementKey, depth + 1);
    }
    throw new ModelUnavailableError(`${key} kullanım dışı ve yerine geçecek model tanımlı değil.`);
  }
  if (m.licenseStatus !== "cleared") {
    throw new ModelUnavailableError(`${key} lisans durumu '${m.licenseStatus}': müşteri işinde kullanılamaz.`);
  }
  if (m.featureFlag) {
    const flags = await getConfig("features");
    if (!flags[m.featureFlag]) throw new ModelUnavailableError(`${key} özellik bayrağı (${m.featureFlag}) kapalı.`);
  }
  return m;
}

type Seed = {
  key: string; provider: string; modelId: string; kind: string; unit: string; unitPriceUsd: number;
  deterministic?: boolean; maxUnits?: number; status?: "active" | "deprecated"; replacementKey?: string;
  licenseStatus?: "cleared" | "pending" | "restricted"; featureFlag?: string;
};

/** 2 Kasım 2026 gözlemi — her fiyat kendi sayfasından TEYİT EDİLMELİ (priceVerified=false). */
export const MODEL_SEEDS: Seed[] = [
  { key: "nano-banana-2", provider: "fal", modelId: "fal-ai/nano-banana-2", kind: "image", unit: "image", unitPriceUsd: 0.08, licenseStatus: "cleared" },
  { key: "nano-banana-pro", provider: "fal", modelId: "fal-ai/nano-banana-pro", kind: "image", unit: "image", unitPriceUsd: 0.15, licenseStatus: "cleared" },
  { key: "nano-banana", provider: "fal", modelId: "fal-ai/nano-banana", kind: "image", unit: "image", unitPriceUsd: 0.0398, licenseStatus: "cleared" },
  { key: "ideogram-4", provider: "fal", modelId: "fal-ai/ideogram/v4", kind: "image", unit: "image", unitPriceUsd: 0.06, licenseStatus: "cleared" },
  { key: "recraft-v4-pro", provider: "fal", modelId: "fal-ai/recraft/v4/pro", kind: "image", unit: "image", unitPriceUsd: 0.08, licenseStatus: "cleared" },
  { key: "gpt-image-2", provider: "fal", modelId: "fal-ai/gpt-image-2", kind: "image", unit: "unit (tanımsız)", unitPriceUsd: 1, licenseStatus: "pending" },
  { key: "flux-schnell", provider: "fal", modelId: "fal-ai/flux/schnell", kind: "image", unit: "megapixel", unitPriceUsd: 0.003, licenseStatus: "pending", featureFlag: "creative.flux" },
  { key: "flux-kontext-pro", provider: "fal", modelId: "fal-ai/flux-pro/kontext", kind: "edit", unit: "image", unitPriceUsd: 0.04, licenseStatus: "pending", featureFlag: "creative.flux" },
  { key: "flux-lora-fast-training", provider: "fal", modelId: "fal-ai/flux-lora-fast-training", kind: "training", unit: "run", unitPriceUsd: 2, licenseStatus: "pending", featureFlag: "creative.flux" },
  { key: "z-image-turbo", provider: "fal", modelId: "fal-ai/z-image/turbo", kind: "image", unit: "megapixel", unitPriceUsd: 0.005, licenseStatus: "pending", featureFlag: "creative.researchModels" },
  { key: "minimax-h3-turbo", provider: "fal", modelId: "fal-ai/minimax/hailuo-3-max-turbo", kind: "video", unit: "second", unitPriceUsd: 0.015, licenseStatus: "cleared", maxUnits: 10 },
  { key: "minimax-h3-i2v", provider: "fal", modelId: "fal-ai/minimax/hailuo-3-max/image-to-video", kind: "video", unit: "second", unitPriceUsd: 0.03, licenseStatus: "cleared", maxUnits: 10 },
  { key: "minimax-h3-ref2video", provider: "fal", modelId: "fal-ai/minimax/hailuo-3-max/reference-to-video", kind: "video", unit: "second", unitPriceUsd: 0.05, licenseStatus: "cleared", maxUnits: 10 },
  { key: "kling-v2-5-turbo-pro", provider: "fal", modelId: "fal-ai/kling-video/v2.5-turbo/pro", kind: "video", unit: "second", unitPriceUsd: 0.07, licenseStatus: "cleared", maxUnits: 10 },
  { key: "kling-v3-pro", provider: "fal", modelId: "fal-ai/kling-video/v3/pro", kind: "video", unit: "second", unitPriceUsd: 0.14, licenseStatus: "cleared", maxUnits: 10 },
  { key: "kling-2-1-pro", provider: "fal", modelId: "fal-ai/kling-video/v2.1/pro", kind: "video", unit: "second", unitPriceUsd: 0.09, status: "deprecated", replacementKey: "kling-v2-5-turbo-pro", licenseStatus: "cleared" },
  { key: "seedance-2", provider: "fal", modelId: "fal-ai/bytedance/seedance/v2", kind: "video", unit: "1k_tokens", unitPriceUsd: 0.014, deterministic: false, maxUnits: 300, licenseStatus: "cleared" },
  { key: "elevenlabs-turbo-2-5", provider: "fal", modelId: "fal-ai/elevenlabs/tts/turbo-v2.5", kind: "audio", unit: "1k_chars", unitPriceUsd: 0.05, licenseStatus: "cleared" },
  { key: "elevenlabs-multilingual-v2", provider: "fal", modelId: "fal-ai/elevenlabs/tts/multilingual-v2", kind: "audio", unit: "1k_chars", unitPriceUsd: 0.1, licenseStatus: "cleared" },
  { key: "minimax-speech-2-8-turbo", provider: "fal", modelId: "fal-ai/minimax/speech-2.8-turbo", kind: "audio", unit: "1k_chars", unitPriceUsd: 0.06, licenseStatus: "cleared" },
  { key: "fashn-tryon-1-6", provider: "fal", modelId: "fal-ai/fashn/tryon/v1.6", kind: "tryon", unit: "image", unitPriceUsd: 0.075, licenseStatus: "pending" },
  { key: "bria-tryon", provider: "fal", modelId: "bria/fibo-edit-1.5/virtual-try-on", kind: "tryon", unit: "image", unitPriceUsd: 0.04, licenseStatus: "pending" },
  { key: "stability-fast-upscale", provider: "bedrock", modelId: "stability.stable-fast-upscale-v1:0", kind: "edit", unit: "image", unitPriceUsd: 0.03, licenseStatus: "cleared" },
  { key: "stability-outpaint", provider: "bedrock", modelId: "stability.stable-outpaint-v1:0", kind: "edit", unit: "image", unitPriceUsd: 0.06, licenseStatus: "cleared" },
  { key: "stability-remove-bg", provider: "bedrock", modelId: "stability.stable-image-remove-background-v1:0", kind: "edit", unit: "image", unitPriceUsd: 0.07, licenseStatus: "cleared" },
  { key: "stability-conservative-upscale", provider: "bedrock", modelId: "stability.stable-conservative-upscale-v1:0", kind: "edit", unit: "image", unitPriceUsd: 0.4, licenseStatus: "cleared" },
  { key: "stability-creative-upscale", provider: "bedrock", modelId: "stability.stable-creative-upscale-v1:0", kind: "edit", unit: "image", unitPriceUsd: 0.6, licenseStatus: "cleared" },
  // Amazon Bedrock üretim modelleri. Bölge/erişim açılana kadar featureFlag ile kapalı (erişim bekliyor).
  { key: "nova-canvas", provider: "bedrock", modelId: "amazon.nova-canvas-v1:0", kind: "image", unit: "image", unitPriceUsd: 0.04, licenseStatus: "cleared", featureFlag: "creative.bedrockImage" },
  { key: "titan-image-g1-v2", provider: "bedrock", modelId: "amazon.titan-image-generator-v2:0", kind: "image", unit: "image", unitPriceUsd: 0.01, licenseStatus: "cleared", featureFlag: "creative.bedrockImage" },
  { key: "nova-reel", provider: "bedrock", modelId: "amazon.nova-reel-v1:1", kind: "video", unit: "second", unitPriceUsd: 0.08, licenseStatus: "cleared", maxUnits: 120, featureFlag: "creative.bedrockVideo" },
];

export async function seedModelRegistry() {
  const { creditUsd } = await getConfig("pricing.markup");
  for (const s of MODEL_SEEDS) {
    const data = {
      provider: s.provider,
      modelId: s.modelId,
      kind: s.kind,
      unit: s.unit,
      unitPriceUsd: s.unitPriceUsd,
      creditsPerUnit: Math.ceil((s.unitPriceUsd / creditUsd) * 1000) / 1000,
      deterministic: s.deterministic ?? true,
      maxUnits: s.maxUnits ?? null,
      status: s.status ?? "active",
      deprecatedAt: s.status === "deprecated" ? new Date("2026-09-01") : null,
      replacementKey: s.replacementKey ?? null,
      licenseStatus: s.licenseStatus ?? "pending",
      featureFlag: s.featureFlag ?? null,
    };
    await prisma.modelRegistry.upsert({ where: { key: s.key }, create: { key: s.key, ...data }, update: {} });
  }
}
