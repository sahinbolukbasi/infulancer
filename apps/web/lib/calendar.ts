import type { ContentType, DeliverableStatus, Platform } from "@infulancer/core/db";
import { statusOrder } from "@infulancer/core/domain/deliverable-status";
import { contentTypeLabels, deliverableStatusLabels, platformLabels } from "@infulancer/core/domain/labels";
import type { CalendarCard, CalendarRow } from "@/components/calendar/week-calendar";
import { addDays, AGENCY_TZ, isDay, localDay, localTime, mondayOf, tzShort } from "./time";

/** Teslim gecikmiş mi: onay son tarihi geçti ve henüz onaylanmadı, ya da paylaşım zamanı geçti ve yayınlanmadı. */
export function isOverdue(
  d: { status: DeliverableStatus; plannedAt: Date; approvalDeadline: Date },
  now: Date = new Date(),
): boolean {
  if (d.status === "IPTAL" || d.status === "TASLAK") return false;
  const order = statusOrder[d.status];
  return (d.approvalDeadline < now && order < statusOrder.ONAYLANDI) || (d.plannedAt < now && order < statusOrder.YAYINLANDI);
}

/** ?hafta=YYYY-MM-DD → haftanın pazartesisi ve 7 gün. */
export function resolveWeek(param: string | string[] | undefined, now: Date = new Date()) {
  const raw = Array.isArray(param) ? param[0] : param;
  const today = localDay(now, AGENCY_TZ);
  const monday = mondayOf(raw && isDay(raw) ? raw : today);
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  return { monday, days, today, prev: addDays(monday, -7), next: addDays(monday, 7) };
}

/** Saat dilimi farkları için ±1 gün pay bırakılmış UTC sorgu aralığı. */
export function weekQueryRange(days: string[]): { gte: Date; lt: Date } {
  const first = days[0]!;
  const last = days[days.length - 1]!;
  return {
    gte: new Date(`${addDays(first, -1)}T00:00:00Z`),
    lt: new Date(`${addDays(last, 2)}T00:00:00Z`),
  };
}

export type CalendarSource = {
  id: string;
  platform: Platform;
  contentType: ContentType;
  status: DeliverableStatus;
  plannedAt: Date;
  approvalDeadline: Date;
  contractViolation: boolean;
  campaignName: string;
  influencer: { id: string; name: string; audienceTimezone: string };
};

export function toCalendarCard(d: CalendarSource, href: string, now: Date = new Date()): CalendarCard {
  const tz = d.influencer.audienceTimezone;
  return {
    id: d.id,
    day: localDay(d.plannedAt, tz),
    time: localTime(d.plannedAt, tz),
    platform: d.platform,
    platformLabel: platformLabels[d.platform],
    contentLabel: contentTypeLabels[d.contentType],
    status: d.status,
    statusLabel: deliverableStatusLabels[d.status],
    campaignName: d.campaignName,
    href,
    locked: d.status === "IPTAL" || statusOrder[d.status] >= statusOrder.YAYINLANDI,
    overdue: isOverdue(d, now),
    violation: d.contractViolation,
  };
}

/** Haftaya düşen işleri influencer satırlarına dağıtır (gün, kitlenin saat diliminde). */
export function buildCalendarRows(days: string[], items: CalendarSource[], hrefFor: (id: string) => string): CalendarRow[] {
  const set = new Set(days);
  const rows = new Map<string, CalendarRow>();
  const now = new Date();
  for (const d of items) {
    const card = toCalendarCard(d, hrefFor(d.id), now);
    if (!set.has(card.day)) continue;
    const tz = d.influencer.audienceTimezone;
    let row = rows.get(d.influencer.id);
    if (!row) {
      row = {
        id: d.influencer.id,
        name: d.influencer.name,
        tz,
        tzLabel: tz === AGENCY_TZ ? undefined : `${tz} (${tzShort(tz)})`,
        cards: [],
      };
      rows.set(d.influencer.id, row);
    }
    row.cards.push(card);
  }
  return [...rows.values()].sort((a, b) => a.name.localeCompare(b.name, "tr"));
}

export type CalendarView = "gun" | "hafta" | "ay" | "yil";
export const CALENDAR_VIEWS: { id: CalendarView; label: string }[] = [
  { id: "gun", label: "Gün" },
  { id: "hafta", label: "Hafta" },
  { id: "ay", label: "Ay" },
  { id: "yil", label: "Yıl" },
];
const MONTHS = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
export const monthName = (m: number) => MONTHS[m - 1]!;
const pad2 = (n: number) => String(n).padStart(2, "0");
function shiftMonth(day: string, n: number): string {
  const [y, m] = day.split("-").map(Number) as [number, number];
  const t = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${t.getUTCFullYear()}-${pad2(t.getUTCMonth() + 1)}-01`;
}
/**
 * Görünüm + tarih → gösterilecek günler, sorgu aralığı, önceki/sonraki/bugün bağlantı tarihleri ve başlık.
 * Ay görünümü takvim ızgarası için pazartesiden başlayan tam haftaları içerir.
 */
export function resolvePeriod(viewRaw: string | undefined, dateRaw: string | undefined, now: Date = new Date()) {
  const view: CalendarView = (["gun", "hafta", "ay", "yil"] as const).find((v) => v === viewRaw) ?? "hafta";
  const today = localDay(now, AGENCY_TZ);
  const anchor = dateRaw && isDay(dateRaw) ? dateRaw : today;
  const [y, m] = anchor.split("-").map(Number) as [number, number];
  let days: string[];
  let prev: string;
  let next: string;
  let title: string;
  if (view === "gun") {
    days = [anchor];
    prev = addDays(anchor, -1);
    next = addDays(anchor, 1);
    title = anchor;
  } else if (view === "hafta") {
    const mon = mondayOf(anchor);
    days = Array.from({ length: 7 }, (_, i) => addDays(mon, i));
    prev = addDays(mon, -7);
    next = addDays(mon, 7);
    title = `${days[0]} – ${days[6]}`;
  } else if (view === "ay") {
    const first = `${y}-${pad2(m)}-01`;
    const start = mondayOf(first);
    const lastOfMonth = addDays(shiftMonth(first, 1), -1);
    const end = addDays(mondayOf(lastOfMonth), 6);
    days = [];
    for (let d = start; d <= end; d = addDays(d, 1)) days.push(d);
    prev = shiftMonth(first, -1);
    next = shiftMonth(first, 1);
    title = `${monthName(m)} ${y}`;
  } else {
    const first = `${y}-01-01`;
    days = [];
    for (let d = first; d <= `${y}-12-31`; d = addDays(d, 1)) days.push(d);
    prev = `${y - 1}-01-01`;
    next = `${y + 1}-01-01`;
    title = String(y);
  }
  return { view, anchor, today, days, prev, next, title, year: y, month: m };
}
