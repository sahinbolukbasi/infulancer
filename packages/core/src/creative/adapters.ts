import { DomainError } from "../domain/errors";

/**
 * Model başına fal istek gövdesi ve faturalama birimi.
 *
 * Amaç: kullanıcının ödediği ile aldığı birebir aynı olsun.
 *  - Video süresi modele `duration` olarak GİDER ve yalnız modelin kabul ettiği değerler seçilebilir
 *    (ör. Kling 5/10 sn). Aksi halde model varsayılanı üretir, kullanıcı fazla öder.
 *  - Seslendirmede birim (1000 karakter) metinden SUNUCUDA hesaplanır; kullanıcı girmez.
 *  - Görselde 1 adet; en-boy oranı modele parametre olarak verilir (Story = 9:16).
 */
export type Aspect = "9:16" | "1:1" | "4:5" | "16:9";
type Spec = {
  /** Seçilebilir süreler (video); boşsa süre seçilmez. */
  durations?: number[];
  /** Desteklenen oranlar; yoksa model kendi oranında üretir. */
  aspects?: Aspect[];
  build: (p: { prompt: string; aspect: Aspect; seconds: number }) => Record<string, unknown>;
};

// fal "image_size" enum'u (FLUX, Recraft, Ideogram).
const SIZE: Record<Aspect, string> = { "9:16": "portrait_16_9", "1:1": "square_hd", "4:5": "portrait_4_3", "16:9": "landscape_16_9" };
const ALL: Aspect[] = ["9:16", "1:1", "4:5", "16:9"];
const VID: Aspect[] = ["9:16", "1:1", "16:9"];

const SPECS: Record<string, Spec> = {
  "flux-schnell": { aspects: ALL, build: ({ prompt, aspect }) => ({ prompt, image_size: SIZE[aspect], num_images: 1, num_inference_steps: 4, output_format: "jpeg" }) },
  "nano-banana": { aspects: ALL, build: ({ prompt, aspect }) => ({ prompt, aspect_ratio: aspect, num_images: 1, output_format: "png" }) },
  "nano-banana-2": { aspects: ALL, build: ({ prompt, aspect }) => ({ prompt, aspect_ratio: aspect, num_images: 1, resolution: "1K", output_format: "png" }) },
  "nano-banana-pro": { aspects: ALL, build: ({ prompt, aspect }) => ({ prompt, aspect_ratio: aspect, num_images: 1, resolution: "1K", output_format: "png" }) },
  "recraft-v3": { aspects: ALL, build: ({ prompt, aspect }) => ({ prompt, image_size: SIZE[aspect], style: "realistic_image" }) },
  "ideogram-v3": { aspects: ALL, build: ({ prompt, aspect }) => ({ prompt, image_size: SIZE[aspect], rendering_speed: "BALANCED", num_images: 1 }) },
  "ltxv-distilled": { durations: [5], aspects: VID, build: ({ prompt, aspect }) => ({ prompt, aspect_ratio: aspect, resolution: "720p", num_frames: 121, frame_rate: 24 }) },
  "hailuo-02-standard": { durations: [6, 10], build: ({ prompt, seconds }) => ({ prompt, duration: String(seconds), prompt_optimizer: true }) },
  "kling-v2-5-turbo-pro": { durations: [5, 10], aspects: VID, build: ({ prompt, aspect, seconds }) => ({ prompt, aspect_ratio: aspect, duration: String(seconds) }) },
  // Ses kapalı: fal sesli üretimi %50 daha pahalı fiyatlar ($0.168/sn); fiyatımız sessize göre.
  "kling-v3-pro": { durations: [5, 10, 15], aspects: VID, build: ({ prompt, aspect, seconds }) => ({ prompt, aspect_ratio: aspect, duration: String(seconds), generate_audio: false }) },
  "elevenlabs-turbo-2-5": { build: ({ prompt }) => ({ text: prompt, language_code: "tr" }) },
  "elevenlabs-multilingual-v2": { build: ({ prompt }) => ({ text: prompt }) },
  // MiniMax varsayılanı "hex" döndürür; dosya URL'i için "url" şart.
  "minimax-speech-2-8-turbo": { build: ({ prompt }) => ({ prompt, language_boost: "Turkish", output_format: "url" }) },
};

export function modelSpec(key: string): Spec | null {
  return SPECS[key] ?? null;
}
export function allowedDurations(key: string): number[] | null {
  return SPECS[key]?.durations ?? null;
}
export function supportedAspects(key: string): Aspect[] | null {
  return SPECS[key]?.aspects ?? null;
}

/** Seslendirmede faturalanan birim: 1000 karakter dilimi (yukarı yuvarlanır). */
export function audioUnits(text: string): number {
  return Math.max(1, Math.ceil(text.trim().length / 1000));
}

/**
 * Üretim isteğini modele uygun gövdeye ve faturalanacak birime çevirir.
 * Video süresi izin verilenlerden değilse reddedilir (ör. Kling 7 sn yok).
 */
export function planGeneration(input: { modelKey: string; kind: string; prompt: string; aspect: Aspect; seconds?: number }): { falInput: Record<string, unknown>; units: number } {
  const spec = SPECS[input.modelKey];
  if (!spec) throw new DomainError("DOGRULAMA", "Bu model stüdyoda kullanılamıyor.");
  if (input.kind === "audio") return { falInput: spec.build({ prompt: input.prompt, aspect: input.aspect, seconds: 0 }), units: audioUnits(input.prompt) };
  if (input.kind === "video") {
    const allowed = spec.durations ?? [5];
    const seconds = input.seconds ?? allowed[0]!;
    if (!allowed.includes(seconds)) throw new DomainError("DOGRULAMA", `Bu model için süre ${allowed.join(" veya ")} sn olabilir.`);
    const aspect = spec.aspects?.includes(input.aspect) ? input.aspect : (spec.aspects?.[0] ?? input.aspect);
    return { falInput: spec.build({ prompt: input.prompt, aspect, seconds }), units: seconds };
  }
  const aspect = spec.aspects?.includes(input.aspect) ? input.aspect : "1:1";
  return { falInput: spec.build({ prompt: input.prompt, aspect, seconds: 0 }), units: 1 };
}
