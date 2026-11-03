import { getConfig } from "../config/store";
import type { HalfDay } from "../config/defaults";

/**
 * Türk iş günü takvimi (Europe/Istanbul, UTC+3, yaz saati yok). Hafta sonu ve resmî tatiller
 * iş günü sayılmaz; arife yarım günlerinde kesim saatinden sonraki olaylar ertesi iş gününe
 * kayar. Tatil listesi config'den (calendar.tr.*) gelir — 72 saatlik sayaç DEĞİLDİR.
 */
const TR_OFFSET_MS = 3 * 60 * 60 * 1000;

export type Calendar = { holidays: Set<string>; halfDays: Map<string, string> };

export async function loadCalendar(): Promise<Calendar> {
  const [holidays, halfDays] = await Promise.all([getConfig("calendar.tr.holidays"), getConfig("calendar.tr.halfDays")]);
  return makeCalendar(holidays, halfDays);
}

export function makeCalendar(holidays: string[], halfDays: HalfDay[] = []): Calendar {
  return { holidays: new Set(holidays), halfDays: new Map(halfDays.map((h) => [h.date, h.until])) };
}

function trDay(d: Date): { day: string; minutes: number } {
  const local = new Date(d.getTime() + TR_OFFSET_MS);
  return { day: local.toISOString().slice(0, 10), minutes: local.getUTCHours() * 60 + local.getUTCMinutes() };
}

function nextDay(day: string): string {
  return new Date(new Date(`${day}T12:00:00Z`).getTime() + 86_400_000).toISOString().slice(0, 10);
}

/** TR gece yarısı (gün başı) UTC olarak. */
function trStartOf(day: string): Date {
  return new Date(new Date(`${day}T00:00:00Z`).getTime() - TR_OFFSET_MS);
}

export function isBusinessDay(day: string, cal: Calendar): boolean {
  const wd = new Date(`${day}T12:00:00Z`).getUTCDay();
  return wd !== 0 && wd !== 6 && !cal.holidays.has(day);
}

/**
 * Son tarih: olay anından sonraki n. iş gününün bitişi (TR saatiyle 23:59:59.999 → ertesi gün başı).
 * Olay günü sayılmaz (ör. Cuma olay + 3 iş günü → Çarşamba sonu).
 */
export function addBusinessDays(from: Date, n: number, cal: Calendar): Date {
  let { day } = trDay(from);
  let counted = 0;
  while (counted < n) {
    day = nextDay(day);
    if (isBusinessDay(day, cal)) counted++;
  }
  return trStartOf(nextDay(day));
}

/** Kuyruk yaşı n iş gününü geçti mi? */
export function isOlderThanBusinessDays(createdAt: Date, n: number, now: Date, cal: Calendar): boolean {
  return now.getTime() >= addBusinessDays(createdAt, n, cal).getTime();
}

/** Arife öğleden sonra veya iş günü dışı mı? (UI bilgilendirmesi için) */
export function isWithinBusinessHours(at: Date, cal: Calendar): boolean {
  const { day, minutes } = trDay(at);
  if (!isBusinessDay(day, cal)) return false;
  const half = cal.halfDays.get(day);
  if (!half) return true;
  const [h, m] = half.split(":").map(Number);
  return minutes < (h ?? 0) * 60 + (m ?? 0);
}
