/**
 * Creative: model anahtarlarını kullanıcı dostu ad/açıklama/birim etiketine çevirir.
 * Sunucu ve istemci bileşenleri ortak kullanır ("use client" yok, sunucuya özel import yok).
 */
export type CreativeKind = "image" | "video" | "audio";
export const KIND_LABEL: Record<CreativeKind, string> = { image: "Görsel", video: "Video", audio: "Seslendirme" };

const MODEL_INFO: Record<string, { name: string; hint: string }> = {
  "flux-schnell": { name: "FLUX Schnell", hint: "En ekonomik, hızlı" },
  "recraft-v3": { name: "Recraft V3", hint: "Gerçekçi ve illüstrasyon" },
  "ideogram-v3": { name: "Ideogram V3", hint: "Yazılı afiş ve tipografi" },
  "ltxv-distilled": { name: "LTX Video", hint: "En ekonomik, 5 sn" },
  "hailuo-02-standard": { name: "Hailuo 02", hint: "Dengeli, 6/10 sn" },
  "hailuo-02-fast-i2v": { name: "Hailuo 02 Fast", hint: "Görselden video, ekonomik" },
  "nano-banana-2": { name: "Nano Banana 2", hint: "Hızlı ve dengeli" },
  "nano-banana-pro": { name: "Nano Banana Pro", hint: "En yüksek kalite" },
  "nano-banana": { name: "Nano Banana", hint: "Ekonomik" },
  "ideogram-4": { name: "Ideogram 4", hint: "Yazılı afiş ve tipografi" },
  "recraft-v4-pro": { name: "Recraft V4 Pro", hint: "İllüstrasyon ve vektör" },
  "nova-canvas": { name: "Nova Canvas", hint: "AWS Bedrock" },
  "titan-image-g1-v2": { name: "Titan Image", hint: "AWS Bedrock, ekonomik" },
  "minimax-h3-turbo": { name: "Hailuo 3 Turbo", hint: "Hızlı video" },
  "kling-v2-5-turbo-pro": { name: "Kling 2.5 Turbo Pro", hint: "Akıcı hareket" },
  "kling-v3-pro": { name: "Kling 3 Pro", hint: "Sinematik, 5–15 sn (sessiz)" },
  "seedance-2": { name: "Seedance 2", hint: "Uzun sahneler" },
  "nova-reel": { name: "Nova Reel", hint: "AWS Bedrock" },
  "elevenlabs-turbo-2-5": { name: "ElevenLabs Turbo", hint: "Hızlı seslendirme" },
  "elevenlabs-multilingual-v2": { name: "ElevenLabs Çok Dilli", hint: "En doğal Türkçe" },
  "minimax-speech-2-8-turbo": { name: "MiniMax Speech", hint: "Ekonomik ses" },
};
const UNIT_LABEL: Record<string, string> = { image: "adet", second: "saniye", "1k_chars": "× 1000 karakter", "1k_tokens": "× 1000 token", megapixel: "megapiksel" };

export function modelName(key: string): string {
  return MODEL_INFO[key]?.name ?? key.split("-").map((w) => (w ? w[0]!.toUpperCase() + w.slice(1) : w)).join(" ");
}
export function modelHint(key: string): string {
  return MODEL_INFO[key]?.hint ?? "";
}
export function unitLabel(unit: string): string {
  return UNIT_LABEL[unit] ?? unit;
}
export function asKind(kind: string): CreativeKind | null {
  return kind === "image" || kind === "video" || kind === "audio" ? kind : null;
}
/** Referans görsel gerektiren modeller (görselden videoya vb.) metin besteci için uygun değildir. */
export function needsReference(key: string): boolean {
  return /i2v|ref2video|image-to-video|tryon|upscale|outpaint|remove-bg/.test(key);
}
/** Kartlar için türe göre degrade (görsel önizlemesi yokken). */
export const KIND_TONE: Record<CreativeKind, string[]> = {
  image: ["from-rose-400 via-fuchsia-500 to-indigo-600", "from-amber-300 via-orange-400 to-rose-500", "from-emerald-300 via-teal-400 to-sky-600"],
  video: ["from-sky-400 via-indigo-500 to-violet-700", "from-fuchsia-500 via-purple-600 to-slate-900", "from-cyan-400 via-blue-600 to-indigo-900"],
  audio: ["from-lime-300 via-emerald-400 to-teal-600", "from-yellow-300 via-amber-400 to-orange-600", "from-violet-300 via-purple-400 to-fuchsia-600"],
};
export function toneFor(kind: CreativeKind, seed: string): string {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const list = KIND_TONE[kind];
  return list[h % list.length]!;
}
export const fmtCredits = (n: number) => new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 2 }).format(n);
/** TL para biçimi (1 kredi = 1 TL). Üretim maliyeti ve bakiye bu birimle gösterilir. */
const fmtTry = (n: number) => `${new Intl.NumberFormat("tr-TR", { maximumFractionDigits: Math.abs(n) < 10 && !Number.isInteger(n) ? 2 : 0 }).format(Math.abs(n) < 10 ? n : Math.round(n))} TL`;

const INTL: Record<string, string> = { TRY: "tr-TR", EUR: "de-DE", CHF: "de-CH", GBP: "en-GB", USD: "en-US" };
/** Para biçimi hesabın kendi para biriminde (çevrim yok). Varsayılan TL. */
export function fmtTl(n: number, currency = "TRY"): string {
  if (currency === "TRY") return fmtTry(n);
  return new Intl.NumberFormat(INTL[currency] ?? "en-GB", { style: "currency", currency, minimumFractionDigits: Math.abs(n) < 10 && n % 1 !== 0 ? 2 : 0, maximumFractionDigits: 2 }).format(n);
}
/** Sunucudaki pricing.chargeIn ile aynı: TRY tam TL, diğerleri cent'e yukarı yuvarlanır; en az min. */
export function chargeAmount(cpu: number, units: number, min: number, currency = "TRY"): number {
  const raw = cpu * units;
  const v = currency === "TRY" ? Math.ceil(raw - 1e-9) : Math.ceil(raw * 100 - 1e-9) / 100;
  return Math.max(min, v);
}
