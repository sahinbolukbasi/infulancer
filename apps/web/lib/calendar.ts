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
