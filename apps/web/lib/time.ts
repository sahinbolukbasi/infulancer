/**
 * Saat dilimi yardımcıları (tarih kütüphanesi yok; yalnız Intl).
 * plannedAt UTC saklanır; influencer kitlesinin IANA saat diliminde gösterilir/girilir.
 * Sunucu ve istemcide ortak kullanılır.
 */

export const AGENCY_TZ = "Europe/Istanbul";

const partsCache = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(tz: string): Intl.DateTimeFormat {
  let f = partsCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    partsCache.set(tz, f);
  }
  return f;
}

type ZonedParts = { year: number; month: number; day: number; hour: number; minute: number; second: number };

export function zonedParts(date: Date, tz: string): ZonedParts {
  const out: Record<string, number> = {};
  for (const p of partsFormatter(tz).formatToParts(date)) {
    if (p.type !== "literal") out[p.type] = Number(p.value);
  }
  return {
    year: out.year ?? 1970,
    month: out.month ?? 1,
    day: out.day ?? 1,
    hour: out.hour ?? 0,
    minute: out.minute ?? 0,
    second: out.second ?? 0,
  };
}

/** tz'nin verilen andaki UTC farkı (ms). */
export function tzOffsetMs(date: Date, tz: string): number {
  const p = zonedParts(date, tz);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** "YYYY-MM-DD" (tz'deki yerel gün). */
export function localDay(date: Date, tz: string): string {
  const p = zonedParts(date, tz);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

/** "HH:mm" (tz'deki yerel saat). */
export function localTime(date: Date, tz: string): string {
  const p = zonedParts(date, tz);
  return `${pad(p.hour)}:${pad(p.minute)}`;
}

/** datetime-local input değeri: "YYYY-MM-DDTHH:mm". */
export function toLocalInput(date: Date, tz: string): string {
  return `${localDay(date, tz)}T${localTime(date, tz)}`;
}

const DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function isDay(v: string): boolean {
  const m = DAY_RE.exec(v);
  if (!m) return false;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.getUTCDate() === Number(m[3]) && d.getUTCMonth() === Number(m[2]) - 1;
}

export function isTime(v: string): boolean {
  return TIME_RE.test(v);
}

/** tz'deki yerel gün + saati UTC Date'e çevirir (DST geçişlerinde ikinci tur düzeltme). */
export function zonedToUtc(day: string, time: string, tz: string): Date {
  const [y, m, d] = day.split("-").map(Number) as [number, number, number];
  const [hh, mm] = time.split(":").map(Number) as [number, number];
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  const off1 = tzOffsetMs(new Date(guess), tz);
  let result = guess - off1;
  const off2 = tzOffsetMs(new Date(result), tz);
  if (off2 !== off1) result = guess - off2;
  return new Date(result);
}

/** "YYYY-MM-DDTHH:mm" → {day, time} ya da null. */
export function parseLocalInput(v: string): { day: string; time: string } | null {
  const [day, time] = v.split("T");
  if (!day || !time || !isDay(day) || !isTime(time.slice(0, 5))) return null;
  return { day, time: time.slice(0, 5) };
}

export function addDays(day: string, n: number): string {
  const [y, m, d] = day.split("-").map(Number) as [number, number, number];
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

/** Verilen günün haftasının pazartesisi. */
export function mondayOf(day: string): string {
  const [y, m, d] = day.split("-").map(Number) as [number, number, number];
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = pazar
  return addDays(day, dow === 0 ? -6 : 1 - dow);
}

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export function timeZones(): string[] {
  try {
    return Intl.supportedValuesOf("timeZone");
  } catch {
    return [AGENCY_TZ, "UTC"];
  }
}

const fmtCache = new Map<string, Intl.DateTimeFormat>();
function trFormatter(key: string, opts: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  let f = fmtCache.get(key);
  if (!f) {
    f = new Intl.DateTimeFormat("tr-TR", opts);
    fmtCache.set(key, f);
  }
  return f;
}

export function fmtDateTime(date: Date, tz: string = AGENCY_TZ): string {
  return trFormatter(`dt:${tz}`, { timeZone: tz, dateStyle: "medium", timeStyle: "short" }).format(date);
}

export function fmtDate(date: Date, tz: string = AGENCY_TZ): string {
  return trFormatter(`d:${tz}`, { timeZone: tz, dateStyle: "medium" }).format(date);
}

/** "Pzt 12 Kas" */
export function fmtDayLabel(day: string): string {
  const [y, m, d] = day.split("-").map(Number) as [number, number, number];
  return trFormatter("daylabel", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" }).format(
    new Date(Date.UTC(y, m - 1, d)),
  );
}

/** "GMT+3" gibi kısa saat dilimi adı. */
export function tzShort(tz: string, at: Date = new Date()): string {
  const part = trFormatter(`tzn:${tz}`, { timeZone: tz, timeZoneName: "short" })
    .formatToParts(at)
    .find((p) => p.type === "timeZoneName");
  return part?.value ?? tz;
}
