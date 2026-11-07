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
export type CreativePricing = { usdTry: number; markup: number; minTry: number; autoFx: boolean; fxUpdatedAt: string | null };

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
      const next = { ...cur, usdTry: Math.round(rate * 100) / 100, fxUpdatedAt: new Date().toISOString() };
      await setConfig("pricing.creative", next, true);
      return next;
    }
  } catch {
    /* ağ yoksa son bilinen kur kullanılır */
  }
  return cur;
}
