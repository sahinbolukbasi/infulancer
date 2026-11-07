import { prisma } from "../db";
import { creativePricing, refreshFx, unitPriceTry } from "./pricing";
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
      await notifyAdmins("Deprecated model kullanımı", `${key} kullanım dışı; iş ${m.replacementKey} modeline yönlendirildi.`, "/creative");
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
  /** Fiyat ve model kimliği fal/Bedrock model sayfasından doğrulandı mı (7 Kas 2026). */
  priceVerified?: boolean;
};
/**
 * Model kaydı tohumu. Fiyatlar sağlayıcının KENDİ model sayfasından (fal.ai/models/<id>/llms.txt)
 * 7 Kas 2026'da teyit edildi. TL fiyat burada yazılmaz: pricing.ts formülüyle (USD × kur × markup)
 * her başlangıçta hesaplanır. Kimliği doğrulanamayan eski kayıtlar deprecated + doğru karşılığa yönlenir.
 */
export const MODEL_SEEDS: Seed[] = [
  // --- Görsel (adet) ---
  { key: "flux-schnell", provider: "fal", modelId: "fal-ai/flux/schnell", kind: "image", unit: "image", unitPriceUsd: 0.003, licenseStatus: "cleared", priceVerified: true }, // Apache-2.0, ≤1 MP
  { key: "nano-banana", provider: "fal", modelId: "fal-ai/nano-banana", kind: "image", unit: "image", unitPriceUsd: 0.0398, licenseStatus: "cleared", priceVerified: true },
  { key: "recraft-v3", provider: "fal", modelId: "fal-ai/recraft/v3/text-to-image", kind: "image", unit: "image", unitPriceUsd: 0.04, licenseStatus: "cleared", priceVerified: true },
  { key: "ideogram-v3", provider: "fal", modelId: "fal-ai/ideogram/v3", kind: "image", unit: "image", unitPriceUsd: 0.06, licenseStatus: "cleared", priceVerified: true }, // BALANCED
  { key: "nano-banana-2", provider: "fal", modelId: "fal-ai/nano-banana-2", kind: "image", unit: "image", unitPriceUsd: 0.08, licenseStatus: "cleared", priceVerified: true }, // 1K
  { key: "nano-banana-pro", provider: "fal", modelId: "fal-ai/nano-banana-pro", kind: "image", unit: "image", unitPriceUsd: 0.15, licenseStatus: "cleared", priceVerified: true }, // 1K
  { key: "z-image-turbo", provider: "fal", modelId: "fal-ai/z-image/turbo", kind: "image", unit: "image", unitPriceUsd: 0.005, licenseStatus: "pending", featureFlag: "creative.researchModels", priceVerified: true },
  { key: "gpt-image-2", provider: "fal", modelId: "fal-ai/gpt-image-2", kind: "image", unit: "image", unitPriceUsd: 1, licenseStatus: "pending" },
  // Eski/doğrulanamayan kimlikler → doğru karşılığa yönlenir
  { key: "ideogram-4", provider: "fal", modelId: "fal-ai/ideogram/v3", kind: "image", unit: "image", unitPriceUsd: 0.06, status: "deprecated", replacementKey: "ideogram-v3", licenseStatus: "cleared" },
  { key: "recraft-v4-pro", provider: "fal", modelId: "fal-ai/recraft/v3/text-to-image", kind: "image", unit: "image", unitPriceUsd: 0.04, status: "deprecated", replacementKey: "recraft-v3", licenseStatus: "cleared" },

  // --- Video (saniye) ---
  { key: "ltxv-distilled", provider: "fal", modelId: "fal-ai/ltxv-13b-098-distilled", kind: "video", unit: "second", unitPriceUsd: 0.02, licenseStatus: "cleared", maxUnits: 5, priceVerified: true }, // en ekonomik, 9:16 destekli
  { key: "hailuo-02-standard", provider: "fal", modelId: "fal-ai/minimax/hailuo-02/standard/text-to-video", kind: "video", unit: "second", unitPriceUsd: 0.045, licenseStatus: "cleared", maxUnits: 10, priceVerified: true },
  { key: "kling-v2-5-turbo-pro", provider: "fal", modelId: "fal-ai/kling-video/v2.5-turbo/pro/text-to-video", kind: "video", unit: "second", unitPriceUsd: 0.07, licenseStatus: "cleared", maxUnits: 10, priceVerified: true },
  { key: "kling-v3-pro", provider: "fal", modelId: "fal-ai/kling-video/v3/pro/text-to-video", kind: "video", unit: "second", unitPriceUsd: 0.112, licenseStatus: "cleared", maxUnits: 15, priceVerified: true }, // ses kapalı
  { key: "minimax-h3-turbo", provider: "fal", modelId: "fal-ai/minimax/hailuo-02/standard/text-to-video", kind: "video", unit: "second", unitPriceUsd: 0.045, status: "deprecated", replacementKey: "hailuo-02-standard", licenseStatus: "cleared" },
  { key: "minimax-h3-ref2video", provider: "fal", modelId: "fal-ai/minimax/hailuo-02/standard/text-to-video", kind: "video", unit: "second", unitPriceUsd: 0.045, status: "deprecated", replacementKey: "hailuo-02-standard", licenseStatus: "cleared" },
  { key: "seedance-2", provider: "fal", modelId: "fal-ai/ltxv-13b-098-distilled", kind: "video", unit: "second", unitPriceUsd: 0.02, status: "deprecated", replacementKey: "ltxv-distilled", licenseStatus: "cleared" },
  { key: "kling-2-1-pro", provider: "fal", modelId: "fal-ai/kling-video/v2.5-turbo/pro/text-to-video", kind: "video", unit: "second", unitPriceUsd: 0.07, status: "deprecated", replacementKey: "kling-v2-5-turbo-pro", licenseStatus: "cleared" },
  // Görselden video (stüdyo)
  { key: "hailuo-02-fast-i2v", provider: "fal", modelId: "fal-ai/minimax/hailuo-02-fast/image-to-video", kind: "video", unit: "second", unitPriceUsd: 0.017, licenseStatus: "cleared", maxUnits: 10, priceVerified: true }, // 512p, ekonomik
  { key: "kling-v2-5-i2v", provider: "fal", modelId: "fal-ai/kling-video/v2.5-turbo/pro/image-to-video", kind: "video", unit: "second", unitPriceUsd: 0.07, licenseStatus: "cleared", maxUnits: 10, priceVerified: true },
  { key: "minimax-h3-i2v", provider: "fal", modelId: "fal-ai/minimax/hailuo-02-fast/image-to-video", kind: "video", unit: "second", unitPriceUsd: 0.017, status: "deprecated", replacementKey: "hailuo-02-fast-i2v", licenseStatus: "cleared" },

  // --- Seslendirme (1000 karakter) ---
  { key: "elevenlabs-turbo-2-5", provider: "fal", modelId: "fal-ai/elevenlabs/tts/turbo-v2.5", kind: "audio", unit: "1k_chars", unitPriceUsd: 0.05, licenseStatus: "cleared", priceVerified: true },
  { key: "minimax-speech-2-8-turbo", provider: "fal", modelId: "fal-ai/minimax/speech-2.8-turbo", kind: "audio", unit: "1k_chars", unitPriceUsd: 0.06, licenseStatus: "cleared", priceVerified: true },
  { key: "elevenlabs-multilingual-v2", provider: "fal", modelId: "fal-ai/elevenlabs/tts/multilingual-v2", kind: "audio", unit: "1k_chars", unitPriceUsd: 0.1, licenseStatus: "cleared", priceVerified: true },

  // --- Stüdyo düzenleme (adet) ---
  { key: "esrgan-upscale", provider: "fal", modelId: "fal-ai/esrgan", kind: "edit", unit: "image", unitPriceUsd: 0.005, licenseStatus: "cleared" }, // işlem süresi bazlı (~$0.00111/sn); tahmini
  { key: "bria-bg-remove", provider: "fal", modelId: "fal-ai/bria/background/remove", kind: "edit", unit: "image", unitPriceUsd: 0.018, licenseStatus: "cleared", priceVerified: true },
  { key: "nano-banana-edit", provider: "fal", modelId: "fal-ai/nano-banana/edit", kind: "edit", unit: "image", unitPriceUsd: 0.0398, licenseStatus: "cleared", priceVerified: true },
  { key: "flux-kontext-pro", provider: "fal", modelId: "fal-ai/flux-pro/kontext", kind: "edit", unit: "image", unitPriceUsd: 0.04, licenseStatus: "pending", featureFlag: "creative.flux", priceVerified: true },
  { key: "flux-lora-fast-training", provider: "fal", modelId: "fal-ai/flux-lora-fast-training", kind: "training", unit: "run", unitPriceUsd: 2, licenseStatus: "pending", featureFlag: "creative.flux" },
  { key: "fashn-tryon-1-6", provider: "fal", modelId: "fal-ai/fashn/tryon/v1.6", kind: "tryon", unit: "image", unitPriceUsd: 0.075, licenseStatus: "pending", priceVerified: true },
  { key: "bria-tryon", provider: "fal", modelId: "bria/fibo-edit-1.5/virtual-try-on", kind: "tryon", unit: "image", unitPriceUsd: 0.04, licenseStatus: "pending" },

  // --- Amazon Bedrock ---
  { key: "stability-fast-upscale", provider: "bedrock", modelId: "stability.stable-fast-upscale-v1:0", kind: "edit", unit: "image", unitPriceUsd: 0.03, licenseStatus: "cleared" },
  { key: "stability-outpaint", provider: "bedrock", modelId: "stability.stable-outpaint-v1:0", kind: "edit", unit: "image", unitPriceUsd: 0.06, licenseStatus: "cleared" },
  { key: "stability-remove-bg", provider: "bedrock", modelId: "stability.stable-image-remove-background-v1:0", kind: "edit", unit: "image", unitPriceUsd: 0.07, licenseStatus: "cleared" },
  { key: "stability-conservative-upscale", provider: "bedrock", modelId: "stability.stable-conservative-upscale-v1:0", kind: "edit", unit: "image", unitPriceUsd: 0.4, licenseStatus: "cleared" },
  { key: "stability-creative-upscale", provider: "bedrock", modelId: "stability.stable-creative-upscale-v1:0", kind: "edit", unit: "image", unitPriceUsd: 0.6, licenseStatus: "cleared" },
  { key: "nova-canvas", provider: "bedrock", modelId: "amazon.nova-canvas-v1:0", kind: "image", unit: "image", unitPriceUsd: 0.04, licenseStatus: "cleared", featureFlag: "creative.bedrockImage" },
  { key: "titan-image-g1-v2", provider: "bedrock", modelId: "amazon.titan-image-generator-v2:0", kind: "image", unit: "image", unitPriceUsd: 0.01, licenseStatus: "cleared", featureFlag: "creative.bedrockImage" },
  { key: "nova-reel", provider: "bedrock", modelId: "amazon.nova-reel-v1:1", kind: "video", unit: "second", unitPriceUsd: 0.08, licenseStatus: "cleared", maxUnits: 120, featureFlag: "creative.bedrockVideo" },
];
export async function seedModelRegistry() {
  // Kur güncel olsun; ağ yoksa son bilinen kur (pricing.creative) kullanılır.
  const pricing = process.env.NODE_ENV === "test" ? await creativePricing() : await refreshFx();
  for (const s of MODEL_SEEDS) {
    const data = {
      provider: s.provider,
      modelId: s.modelId,
      kind: s.kind,
      unit: s.unit,
      unitPriceUsd: s.unitPriceUsd,
      // TL birim fiyat = USD × kur × markup (1 kredi = 1 TL).
      creditsPerUnit: unitPriceTry(s.unitPriceUsd, pricing),
      priceVerified: s.priceVerified ?? false,
      deterministic: s.deterministic ?? true,
      maxUnits: s.maxUnits ?? null,
      status: s.status ?? "active",
      deprecatedAt: s.status === "deprecated" ? new Date("2026-09-01") : null,
      replacementKey: s.replacementKey ?? null,
      licenseStatus: s.licenseStatus ?? "pending",
      featureFlag: s.featureFlag ?? null,
    };
    await prisma.modelRegistry.upsert({
      where: { key: s.key },
      create: { key: s.key, ...data },
      update: { provider: data.provider, modelId: data.modelId, kind: data.kind, unit: data.unit, unitPriceUsd: data.unitPriceUsd, creditsPerUnit: data.creditsPerUnit, priceVerified: data.priceVerified, maxUnits: data.maxUnits, status: data.status, replacementKey: data.replacementKey, licenseStatus: data.licenseStatus, featureFlag: data.featureFlag },
    });
  }
}
