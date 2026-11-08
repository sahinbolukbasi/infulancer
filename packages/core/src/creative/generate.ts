import { DomainError } from "../domain/errors";
import { planGeneration, type Aspect } from "./adapters";
import { submitCreative } from "./fal";
import { resolveModel } from "./registry";
import { getOwnedUpload, presignCreativeGet } from "./uploads";

/**
 * Üretim (Üret sekmesi): istem + isteğe bağlı referans dosyalar.
 *  - Referans yoksa: seçilen modelin kendi gövdesi (adapters.planGeneration).
 *  - Görsel + referans görsel(ler): nano-banana-edit (en çok 4 referans; ürünü/kişiyi koruyarak yeni sahne).
 *  - Video + referans görsel: görselden video (Kling seçiliyse Kling i2v, diğerlerinde ekonomik Hailuo i2v).
 *  - Video referansı üretim modeline verilmez; videolar "brief ile düzenle" akışında düzenlenir.
 * Tutar seçilen akışın modeline göre sunucuda hesaplanır ve işlemi yapanın bakiyesinden düşer.
 */
export async function submitGeneration(input: {
  tenantId: string;
  modelKey: string;
  prompt: string;
  aspect: Aspect;
  seconds?: number;
  referenceUploadIds?: string[];
  portrait?: boolean;
}) {
  const model = await resolveModel(input.modelKey);
  const refIds = [...new Set(input.referenceUploadIds ?? [])].slice(0, 4);
  if (refIds.length === 0) {
    const plan = planGeneration({ modelKey: model.key, kind: model.kind, prompt: input.prompt, aspect: input.aspect, seconds: input.seconds });
    return submitCreative({ tenantId: input.tenantId, modelKey: model.key, prompt: input.prompt, units: plan.units, falInput: plan.falInput, referenceImageIsPortrait: !!input.portrait });
  }
  const uploads = await Promise.all(refIds.map((id) => getOwnedUpload(input.tenantId, id)));
  if (uploads.some((u) => u.kind !== "image")) throw new DomainError("DOGRULAMA", "Referans olarak yalnız görsel kullanılabilir. Videonuzu Stüdyo'da “Brief ile AI düzenle” ile düzenleyin.");
  const urls = await Promise.all(uploads.map((u) => presignCreativeGet(u.s3Key)));
  if (model.kind === "image") {
    return submitCreative({
      tenantId: input.tenantId,
      modelKey: "nano-banana-edit",
      prompt: input.prompt,
      units: 1,
      falInput: { prompt: input.prompt, image_urls: urls, num_images: 1, output_format: "png" },
      // Referansta kişi varsa gerçek kişi koruması uygulanır (md. 27/12).
      referenceImageIsPortrait: !!input.portrait,
      inputUploadId: uploads[0]!.id,
    });
  }
  if (model.kind === "video") {
    const kling = model.key.startsWith("kling");
    const key = kling ? "kling-v2-5-i2v" : "hailuo-02-fast-i2v";
    const allowed = kling ? [5, 10] : [6, 10];
    const secs = allowed.includes(input.seconds ?? 0) ? input.seconds! : allowed[0]!;
    return submitCreative({
      tenantId: input.tenantId,
      modelKey: key,
      prompt: input.prompt,
      units: secs,
      falInput: kling ? { prompt: input.prompt, image_url: urls[0], duration: String(secs) } : { prompt: input.prompt, image_url: urls[0], duration: String(secs), prompt_optimizer: true },
      referenceImageIsPortrait: !!input.portrait,
      inputUploadId: uploads[0]!.id,
    });
  }
  throw new DomainError("DOGRULAMA", "Seslendirmede referans dosya kullanılmaz.");
}
