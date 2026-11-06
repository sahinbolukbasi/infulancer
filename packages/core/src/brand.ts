/**
 * Platform marka kimliği. Tek kaynak: ad ve iletişim bilgisi buradan okunur.
 *
 * İstemci bileşenleri de bunu kullandığından burada dosya sistemi (env.ts/node:fs)
 * import edilmez; yalnız istemci-güvenli process.env okunur. Varsayılanlar üretim değeridir.
 * Override için NEXT_PUBLIC_* (istemciye de geçer) veya düz env (yalnız sunucu) kullanılır.
 */
function readEnv(...keys: string[]): string | undefined {
  // process.env bundler tarafından derleme anında satır içine alınabilir; güvenli erişim.
  const env = typeof process !== "undefined" ? process.env : undefined;
  if (!env) return undefined;
  for (const k of keys) {
    const v = env[k];
    if (v && v.trim()) return v.trim();
  }
  return undefined;
}

export const BRAND_NAME = readEnv("NEXT_PUBLIC_BRAND_NAME", "BRAND_NAME") ?? "Nordvow";
/** Yardım, bilgi ve destek talepleri için iletişim e-postası. */
export const SUPPORT_EMAIL = readEnv("NEXT_PUBLIC_SUPPORT_EMAIL", "SUPPORT_EMAIL") ?? "info@nordvow.com";
/** Yasal ünvan (sözleşme, KVKK metinleri vb.). */
export const LEGAL_NAME = readEnv("LEGAL_NAME") ?? "Nordvow Teknoloji ve Danışmanlık A.Ş.";
