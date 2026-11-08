import { getConfig, setConfig } from "../config/store";

/**
 * Creative fiyatlandırması — TL, gerçek maliyetten türetilir (elle tablo YOK).
 *
 *   birim TL   = sağlayıcı USD birim fiyatı × USD/TRY × markup         (model kaydında saklanır)
 *   iş tutarı  = max(minTry, yukarı yuvarla(birim TL × birim adedi))    (bakiyeden düşen tutar)
 *
 * Sistemde "kredi" = 1 TL. USD/TRY her başlangıçta güncellenir (autoFx); markup ve en düşük
 * ücret `pricing.creative` ayarındadır. Böylece kur değişince fiyatlar kendiliğinden doğru kalır
 * ve hiçbir model maliyetinin altında satılmaz.
 */
export type CreativePricing = { usdTry: number; markup: number; minTry: number; autoFx: boolean; fxUpdatedAt: string | null; fx?: Record<string, number> };

/** 1 USD karşılığı (open.er-api.com yoksa son bilinen). Hesap kendi para biriminde fiyatlanır; gösterimde çevrim yapılmaz. */
const FX_FALLBACK: Record<string, number> = { TRY: 50.18, EUR: 0.86, CHF: 0.8, GBP: 0.75, USD: 1 };
const ceilCents = (n: number) => Math.ceil(n * 100 - 1e-9) / 100;
/** TL birim fiyatından hesabın para birimine oran (USD üzerinden; ör. EUR = fx.EUR / fx.TRY). */
export function rateFromTry(p: Pick<CreativePricing, "usdTry" | "fx">, currency: string): number {
  if (currency === "TRY") return 1;
  const usd = p.fx?.[currency] ?? FX_FALLBACK[currency];
  if (!usd) return 1;
  return usd / p.usdTry;
}
/**
 * Bir işin hesabın para biriminde bakiyeden düşecek tutarı. TRY: tam TL, en az minTry.
 * Diğer: kuruş/cent'e yukarı yuvarlanır, en az (minTry'nin karşılığı).
 */
export function chargeIn(creditsPerUnitTry: number, units: number, p: Pick<CreativePricing, "usdTry" | "fx" | "minTry">, currency: string): number {
  if (currency === "TRY") return jobChargeTry(creditsPerUnitTry, units, p.minTry);
  const r = rateFromTry(p, currency);
  return Math.max(ceilCents(p.minTry * r), ceilCents(creditsPerUnitTry * r * units));
}
/** Hoş geldin bakiyesi hesabın para biriminde (TRY tutarının karşılığı, yuvarlanmış). */
export function starterIn(starterTry: number, p: Pick<CreativePricing, "usdTry" | "fx">, currency: string): number {
  if (currency === "TRY") return starterTry;
  return Math.max(1, Math.round(starterTry * rateFromTry(p, currency)));
}

export async function creativePricing(): Promise<CreativePricing> {
  return getConfig("pricing.creative");
}

/** Birim TL fiyatı (3 hane hassasiyet; yuvarlama iş toplamında yapılır). */
export function unitPriceTry(unitPriceUsd: number, p: Pick<CreativePricing, "usdTry" | "markup">): number {
  return Math.round(unitPriceUsd * p.usdTry * p.markup * 1000) / 1000;
}

/** Bir işin bakiyeden düşecek tutarı (tam TL, en az minTry). */
export function jobChargeTry(creditsPerUnit: number, units: number, minTry: number): number {
  return Math.max(minTry, Math.ceil(creditsPerUnit * units - 1e-9));
}

/** USD/TRY kurunu açık bir kaynaktan çeker; başarısızsa mevcut değer kalır. */
export async function refreshFx(fetcher: typeof fetch = fetch): Promise<CreativePricing> {
  const cur = await creativePricing();
  if (!cur.autoFx) return cur;
  try {
    const res = await fetcher("https://open.er-api.com/v6/latest/USD", { signal: AbortSignal.timeout(8000) });
    const j = (await res.json()) as { result?: string; rates?: Record<string, number> };
    const rate = j.rates?.TRY;
    // Akıl sağlığı kontrolü: bozuk/aşırı veri fiyatları bozmasın.
    if (j.result === "success" && typeof rate === "number" && rate > 1 && rate < 1000 && Math.abs(rate - cur.usdTry) / cur.usdTry < 0.5) {
      const fx: Record<string, number> = { USD: 1, TRY: Math.round(rate * 100) / 100 };
      for (const c of ["EUR", "CHF", "GBP"]) {
        const v = j.rates?.[c];
        const old = cur.fx?.[c] ?? FX_FALLBACK[c]!;
        if (typeof v === "number" && v > 0 && Math.abs(v - old) / old < 0.5) fx[c] = Math.round(v * 10000) / 10000;
        else fx[c] = old;
      }
      const next = { ...cur, usdTry: fx.TRY!, fx, fxUpdatedAt: new Date().toISOString() };
      await setConfig("pricing.creative", next, true);
      return next;
    }
  } catch {
    /* ağ yoksa son bilinen kur kullanılır */
  }
  return cur;
}
