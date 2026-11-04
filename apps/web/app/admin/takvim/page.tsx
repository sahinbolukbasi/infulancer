import type { Metadata } from "next";
import Link from "next/link";
import { prisma, type Platform } from "@infulancer/core/db";
import { platformLabels } from "@infulancer/core/domain/labels";
import { WeekCalendar } from "@/components/calendar/week-calendar";
import { ChevronLeftIcon, ChevronRightIcon } from "@/components/icons";
import { PlatformIcon } from "@/components/platform-icon";
import { buttonClass } from "@/components/ui/form";
import { PageHeader } from "@/components/ui/layout";
import { requireActor } from "@/lib/auth-guard";
import { buildCalendarRows, CALENDAR_VIEWS, resolvePeriod, weekQueryRange, type CalendarView } from "@/lib/calendar";
import { DayView, MonthView, YearView } from "@/components/calendar/period-views";
import { cn } from "@/lib/cn";
import { fmtDayLabel } from "@/lib/time";

export const metadata: Metadata = { title: "Takvim" };

const PLATFORMS: Platform[] = ["INSTAGRAM", "TIKTOK", "YOUTUBE"];

function parsePlatforms(raw: string | string[] | undefined): Platform[] {
  const v = (Array.isArray(raw) ? raw.join(",") : (raw ?? "")).split(",");
  const picked = PLATFORMS.filter((p) => v.includes(p));
  return picked.length ? picked : PLATFORMS;
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ hafta?: string | string[]; tarih?: string | string[]; gorunum?: string | string[]; platform?: string | string[] }>;
}) {
  await requireActor("ADMIN");
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const per = resolvePeriod(one(sp.gorunum), one(sp.tarih) ?? one(sp.hafta));
  const platforms = parsePlatforms(sp.platform);
  const all = platforms.length === PLATFORMS.length;
  const items = await prisma.deliverable.findMany({
    where: {
      plannedAt: weekQueryRange(per.days),
      platform: { in: platforms },
      status: { not: "IPTAL" },
      assignment: { contractStatus: { not: "RED" } },
    },
    orderBy: { plannedAt: "asc" },
    select: {
      id: true,
      platform: true,
      contentType: true,
      status: true,
      plannedAt: true,
      approvalDeadline: true,
      contractViolation: true,
      assignment: {
        select: {
          campaign: { select: { name: true } },
          influencer: { select: { id: true, name: true, audienceTimezone: true } },
        },
      },
    },
  });
  const rows = buildCalendarRows(
    per.days,
    items.map((d) => ({ ...d, campaignName: d.assignment.campaign.name, influencer: d.assignment.influencer })),
    (id) => `/admin/teslimler/${id}`,
  );
  const total = rows.reduce((s, r) => s + r.cards.length, 0);
  const href = (tarih: string, view: CalendarView = per.view, pl: Platform[] = platforms) => {
    const q = new URLSearchParams({ gorunum: view, tarih });
    if (pl.length && pl.length < PLATFORMS.length) q.set("platform", pl.join(","));
    return `/admin/takvim?${q.toString()}`;
  };
  const toggle = (p: Platform) => {
    if (all) return [p];
    const next = platforms.includes(p) ? platforms.filter((x) => x !== p) : [...platforms, p];
    return next.length ? next : PLATFORMS;
  };
  const title =
    per.view === "gun" ? fmtDayLabel(per.anchor) : per.view === "hafta" ? `${fmtDayLabel(per.days[0]!)} – ${fmtDayLabel(per.days[6]!)}` : per.title;
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Takvim" description={`${total} paylaşım planlı. Haftalık görünümde kartı sürükleyerek tarih değiştirin.`} />
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <nav aria-label="Görünüm" className="inline-flex rounded-full border border-line bg-glass p-1">
            {CALENDAR_VIEWS.map((v) => (
              <Link
                key={v.id}
                href={href(per.anchor, v.id)}
                aria-current={per.view === v.id ? "page" : undefined}
                className={cn("rounded-full px-4 py-1.5 text-[13px] transition-standard", per.view === v.id ? "bg-fg font-medium text-bg" : "text-fg-muted hover:text-fg")}
              >
                {v.label}
              </Link>
            ))}
          </nav>
          <nav aria-label="Dönem" className="flex items-center gap-2">
            <Link href={href(per.prev)} className={buttonClass("secondary", "sm")} aria-label="Önceki">
              <ChevronLeftIcon size={16} />
            </Link>
            <span className="min-w-40 text-center text-sm font-medium tabular-nums">{title}</span>
            <Link href={href(per.next)} className={buttonClass("secondary", "sm")} aria-label="Sonraki">
              <ChevronRightIcon size={16} />
            </Link>
            <Link href={href(per.today)} className={buttonClass("ghost", "sm")}>
              Bugün
            </Link>
          </nav>
        </div>
        <div role="group" aria-label="Platform filtresi" className="flex flex-wrap gap-2">
          {PLATFORMS.map((p) => {
            const on = all || platforms.includes(p);
            return (
              <Link
                key={p}
                href={href(per.anchor, per.view, toggle(p))}
                aria-current={on && !all ? "true" : undefined}
                className={cn(
                  "inline-flex h-8 items-center gap-2 rounded-full border px-3 text-[13px] transition-standard",
                  on && !all ? "border-neon-pink text-fg" : on ? "border-line-strong text-fg" : "border-line text-fg-passive hover:text-fg",
                )}
              >
                <PlatformIcon platform={p} size={14} />
                {platformLabels[p]}
              </Link>
            );
          })}
        </div>
      </div>
      {per.view === "hafta" ? (
        <WeekCalendar days={per.days} rows={rows} today={per.today} editable emptyText="Bu hafta planlanmış paylaşım yok." />
      ) : per.view === "gun" ? (
        <DayView rows={rows} emptyText="Bu gün planlanmış paylaşım yok." />
      ) : per.view === "ay" ? (
        <MonthView days={per.days} rows={rows} month={per.month} today={per.today} dayHref={(d) => href(d, "gun")} />
      ) : (
        <YearView year={per.year} rows={rows} today={per.today} dayHref={(d) => href(d, "gun")} monthHref={(m) => href(`${per.year}-${pad(m)}-01`, "ay")} />
      )}
    </div>
  );
}
