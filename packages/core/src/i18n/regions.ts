/**
 * Bölgeler: ülke → dil, para birimi, yerel biçim ve saat dilimi.
 * Tutarlar her zaman kaydın kendi para biriminde gösterilir; kur çevrimi YAPILMAZ.
 *  - Kampanya: hedef ülkelerin para birimi (aynı kampanyadaki ülkeler aynı para birimini kullanır).
 *  - Influencer: kayıtlı ülkesinin para birimi (hakediş ve ödeme bu birimde).
 *  - Creative hesabı: hesabın ülkesinin para birimi.
 */
export const LOCALES = ["tr", "en", "de", "fr"] as const;
export type Locale = (typeof LOCALES)[number];
export const LOCALE_LABEL: Record<Locale, string> = { tr: "Türkçe", en: "English", de: "Deutsch", fr: "Français" };

export const CURRENCIES = ["TRY", "EUR", "CHF", "GBP", "USD"] as const;
export type Currency = (typeof CURRENCIES)[number];

export type Region = { code: string; name: string; nativeName: string; locale: Locale; intl: string; currency: Currency; timezone: string };
export const REGIONS: Region[] = [
  { code: "TR", name: "Türkiye", nativeName: "Türkiye", locale: "tr", intl: "tr-TR", currency: "TRY", timezone: "Europe/Istanbul" },
  { code: "DE", name: "Almanya", nativeName: "Deutschland", locale: "de", intl: "de-DE", currency: "EUR", timezone: "Europe/Berlin" },
  { code: "AT", name: "Avusturya", nativeName: "Österreich", locale: "de", intl: "de-AT", currency: "EUR", timezone: "Europe/Vienna" },
  { code: "CH", name: "İsviçre", nativeName: "Schweiz", locale: "de", intl: "de-CH", currency: "CHF", timezone: "Europe/Zurich" },
  { code: "FR", name: "Fransa", nativeName: "France", locale: "fr", intl: "fr-FR", currency: "EUR", timezone: "Europe/Paris" },
  { code: "BE", name: "Belçika", nativeName: "Belgique", locale: "fr", intl: "fr-BE", currency: "EUR", timezone: "Europe/Brussels" },
  { code: "NL", name: "Hollanda", nativeName: "Nederland", locale: "en", intl: "nl-NL", currency: "EUR", timezone: "Europe/Amsterdam" },
  { code: "GB", name: "Birleşik Krallık", nativeName: "United Kingdom", locale: "en", intl: "en-GB", currency: "GBP", timezone: "Europe/London" },
  { code: "US", name: "ABD", nativeName: "United States", locale: "en", intl: "en-US", currency: "USD", timezone: "America/New_York" },
];
export const DEFAULT_REGION = REGIONS[0]!;

export function regionOf(code: string | null | undefined): Region {
  return REGIONS.find((r) => r.code === (code ?? "").toUpperCase()) ?? DEFAULT_REGION;
}
export function isRegion(code: unknown): code is string {
  return typeof code === "string" && REGIONS.some((r) => r.code === code.toUpperCase());
}
export function isLocale(v: unknown): v is Locale {
  return typeof v === "string" && (LOCALES as readonly string[]).includes(v);
}
export function currencyOf(country: string | null | undefined): Currency {
  return regionOf(country).currency;
}
/** Ülke adı (Türkçe arayüz için) — dil seçimine göre yerel ad da verilebilir. */
export function countryLabel(code: string, locale: Locale = "tr"): string {
  const r = REGIONS.find((x) => x.code === code);
  if (!r) return code;
  if (locale === "tr") return r.name;
  try {
    return new Intl.DisplayNames([locale], { type: "region" }).of(code) ?? r.nativeName;
  } catch {
    return r.nativeName;
  }
}

/** Kampanya para birimi: hedef ülkelerin ortak para birimi; farklıysa hata (ayrı kampanya açılmalı). */
export function campaignCurrency(targetCountries: string[], fallbackCountry: string): { currency: Currency; mixed: boolean } {
  const set = new Set((targetCountries.length ? targetCountries : [fallbackCountry]).map((c) => currencyOf(c)));
  const [first] = [...set];
  return { currency: first ?? currencyOf(fallbackCountry), mixed: set.size > 1 };
}

/** Para biçimi (kur çevrimi yok): küçük birim (kuruş/cent) → yerel biçim. */
export function formatMinor(minor: number | bigint, currency: string = "TRY", intl?: string): string {
  const n = Number(minor) / 100;
  const loc = intl ?? REGIONS.find((r) => r.currency === currency)?.intl ?? "tr-TR";
  return new Intl.NumberFormat(loc, { style: "currency", currency, maximumFractionDigits: n % 1 === 0 ? 0 : 2 }).format(n);
}
/** Ana birimde tutar (Creative bakiyesi gibi) → yerel biçim. */
export function formatMajor(amount: number, currency: string = "TRY", intl?: string): string {
  const loc = intl ?? REGIONS.find((r) => r.currency === currency)?.intl ?? "tr-TR";
  return new Intl.NumberFormat(loc, { style: "currency", currency, minimumFractionDigits: amount < 10 && amount % 1 !== 0 ? 2 : 0, maximumFractionDigits: 2 }).format(amount);
}

/**
 * Dil + ülke algılama (giriş öncesi): önce Cloudflare/CloudFront ülke başlığı, sonra tarayıcı dili.
 * Desteklenmeyen ülke → dil tarayıcıdan, ülke Türkiye.
 */
export function detectRegion(input: { ipCountry?: string | null; acceptLanguage?: string | null }): { country: string; locale: Locale } {
  const ip = (input.ipCountry ?? "").toUpperCase();
  const langs = (input.acceptLanguage ?? "")
    .split(",")
    .map((p) => p.split(";")[0]!.trim())
    .filter(Boolean);
  const langLocale = langs.map((l) => l.slice(0, 2).toLowerCase()).find((l) => isLocale(l)) as Locale | undefined;
  const langCountry = langs.map((l) => l.split("-")[1]?.toUpperCase()).find((c) => c && isRegion(c));
  if (isRegion(ip)) {
    const r = regionOf(ip);
    // Ülkenin dili; kullanıcı tarayıcısı desteklenen başka bir dildeyse onu tercih et (ör. Almanya'da Türkçe tarayıcı).
    return { country: r.code, locale: langLocale ?? r.locale };
  }
  if (langCountry) return { country: langCountry, locale: langLocale ?? regionOf(langCountry).locale };
  if (langLocale) {
    const byLang = REGIONS.find((r) => r.locale === langLocale) ?? DEFAULT_REGION;
    return { country: byLang.code, locale: langLocale };
  }
  return { country: DEFAULT_REGION.code, locale: DEFAULT_REGION.locale };
}
