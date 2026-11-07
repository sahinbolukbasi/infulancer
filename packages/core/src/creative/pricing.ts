/**
 * Creative üretim fiyatları — TÜRK LİRASI (TL) cinsinden, birim başına.
 *
 * Sistem içinde "kredi" birimi 1 TL'ye eşittir: creditsPerUnit = buradaki TL fiyatı.
 * Detaylı/ağır içerik (video, yüksek kalite görsel) daha pahalıdır. Her tek üretim
 * en çok ~5000 TL olacak şekilde birim fiyat ve maxUnits birlikte ayarlanmıştır.
 *
 * Model kaydı (registry) bu tabloyu esas alır; bir model burada yoksa 0 kabul edilmez,
 * seed sırasında uyarı amaçlı makul bir varsayılan kullanılır.
 */
export const MODEL_PRICE_TRY: Record<string, number> = {
  // Görsel (adet başına)
  "nano-banana": 15, // ekonomik
  "nano-banana-2": 20,
  "nano-banana-pro": 40, // en yüksek kalite
  "ideogram-4": 25, // yazılı afiş
  "recraft-v4-pro": 30, // illüstrasyon/vektör
  "gpt-image-2": 45,
  "flux-schnell": 10, // megapiksel ama pratikte hızlı/ucuz
  "z-image-turbo": 12,
  "nova-canvas": 20,
  "titan-image-g1-v2": 12,

  // Video (saniye başına) — 10 sn tavan ile en çok ~2000-5000 TL
  "minimax-h3-turbo": 150, // 10 sn = 1500
  "minimax-h3-i2v": 200,
  "minimax-h3-ref2video": 250,
  "kling-v2-5-turbo-pro": 300, // 10 sn = 3000
  "kling-v3-pro": 500, // sinematik; 10 sn = 5000 (tavan)
  "kling-2-1-pro": 300,
  "seedance-2": 10, // 1k token başına; maxUnits ile sınırlı
  "nova-reel": 180,

  // Seslendirme (1000 karakter başına)
  "elevenlabs-turbo-2-5": 20,
  "elevenlabs-multilingual-v2": 35, // en doğal
  "minimax-speech-2-8-turbo": 18,

  // Düzenleme / tryon (adet)
  "flux-kontext-pro": 25,
  "fashn-tryon-1-6": 30,
  "bria-tryon": 20,
  "stability-fast-upscale": 15,
  "stability-outpaint": 20,
  "stability-remove-bg": 15,
  "stability-conservative-upscale": 60,
  "stability-creative-upscale": 90,
  "flux-lora-fast-training": 400, // eğitim (run)

  // Stüdyo AI düzenlemeleri (yüklenen görsel üzerinde). Ham maliyet: $0.04 / $0.018 / ~$0.005 / $0.07 sn.
  "nano-banana-edit": 15, // komutla düzenle
  "bria-bg-remove": 8, // arka plan kaldır
  "esrgan-upscale": 5, // 2x netleştir
  "kling-v2-5-i2v": 300, // görselden video (sn); 5 sn = 1500 TL
};

/** Model için TL birim fiyatı (tabloda yoksa makul varsayılan). */
export function priceTry(key: string, kind: string): number {
  if (MODEL_PRICE_TRY[key] != null) return MODEL_PRICE_TRY[key];
  // Tabloda olmayan model: türüne göre güvenli varsayılan.
  if (kind === "video") return 250;
  if (kind === "audio") return 25;
  return 25;
}
