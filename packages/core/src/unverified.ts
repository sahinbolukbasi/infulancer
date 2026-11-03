/**
 * Doğrulanmamış rakamlar (Türkiye Meta oranları, TikTok rate limitleri, App Review süresi, fiyat
 * referansları) UI'da kesin bilgi gibi gösterilmez. Tüm bu değerler bu yardımcıdan geçer.
 */
export const UNVERIFIED_LABEL = "doğrulanmadı";

export type Labeled = { text: string; verified: boolean; badge: string | null };

export function labelValue(text: string, verified: boolean): Labeled {
  return { text, verified, badge: verified ? null : UNVERIFIED_LABEL };
}

export function withUnverified(text: string, verified: boolean): string {
  return verified ? text : `${text} (${UNVERIFIED_LABEL})`;
}

/** Kaynakta sayı verilmeyen/doğrulanamayan bilgiler — UI'da sabit metin olarak. */
export const UNVERIFIED_FACTS = {
  tiktokRateLimits: "TikTok Marketing/Content API hız limitleri resmî kaynaktan doğrulanamadı; adaptif sınırlama uygulanır.",
  appReviewDuration: "Meta/TikTok App Review süresi garanti değildir ve doğrulanmadı.",
  waThroughput: "WhatsApp numara başına mesaj/saniye kapasitesi doğrulanmadı; Meta'nın bildirdiği seviyeden öğrenilir.",
  igRateLimits: "Instagram/Messenger sayısal hız limitleri doğrulanmadı.",
  trRates: "Türkiye WhatsApp mesaj ücretleri Meta'nın kendi tarife kartından doğrulanmadı (BSP kartı referansı).",
} as const;
