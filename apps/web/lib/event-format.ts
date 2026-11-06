import { AGENCY_TZ } from "./time";

/**
 * Etkinlik/kupon kartları için tarih parçaları (Luma tarzı tarih rozeti).
 * Sunucu ve istemcide ortak; yalnız Intl kullanır.
 */
const cache = new Map<string, Intl.DateTimeFormat>();
function f(key: string, opts: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  let x = cache.get(key);
  if (!x) {
    x = new Intl.DateTimeFormat("tr-TR", { timeZone: AGENCY_TZ, ...opts });
    cache.set(key, x);
  }
  return x;
}

/** "KAS" */
export function monthShort(d: Date): string {
  return f("mon", { month: "short" }).format(d).replace(".", "").toLocaleUpperCase("tr");
}
/** "12" */
export function dayNum(d: Date): string {
  return f("day", { day: "numeric" }).format(d);
}
/** "12 Kas" */
export function dayMonthShort(d: Date): string {
  return f("dms", { day: "numeric", month: "short" }).format(d);
}
/** "Çarşamba" */
export function weekdayLong(d: Date): string {
  return f("wd", { weekday: "long" }).format(d);
}
/** "19:00" */
export function timeShort(d: Date): string {
  return f("time", { hour: "2-digit", minute: "2-digit" }).format(d);
}
/** "12 Kasım 2026" */
export function dateLong(d: Date): string {
  return f("dl", { day: "numeric", month: "long", year: "numeric" }).format(d);
}
/** "Çarşamba, 12 Kasım · 19:00 – 23:00" (aynı gün) veya iki tarihli aralık. */
export function rangeLabel(start: Date, end?: Date | null): string {
  const head = `${weekdayLong(start)}, ${f("dm", { day: "numeric", month: "long" }).format(start)} · ${timeShort(start)}`;
  if (!end) return head;
  const sameDay = f("ymd", { year: "numeric", month: "2-digit", day: "2-digit" }).format(start) === f("ymd", { year: "numeric", month: "2-digit", day: "2-digit" }).format(end);
  return sameDay ? `${head} – ${timeShort(end)}` : `${head} – ${f("dm", { day: "numeric", month: "long" }).format(end)} ${timeShort(end)}`;
}

/** Yüzde (0-100), payda 0 ise 0. */
export function pctOf(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * 100) : 0;
}
