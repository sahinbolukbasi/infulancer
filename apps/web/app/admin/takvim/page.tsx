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
import { buildCalendarRows, resolveWeek, weekQueryRange } from "@/lib/calendar";
import { cn } from "@/lib/cn";
import { fmtDayLabel } from "@/lib/time";

export const metadata: Metadata = { title: "Takvim" };

const PLATFORMS: Platform[] = ["INSTAGRAM", "TIKTOK", "YOUTUBE"];

function parsePlatforms(raw: string | string[] | undefined): Platform[] {
  const v = (Array.isArray(raw) ? raw.join(",") : (raw ?? "")).split(",");
  const picked = PLATFORMS.filter((p) => v.includes(p));
  return picked.length ? picked : PLATFORMS;
}

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ hafta?: string | string[]; platform?: string | string[] }> }) {
  await requireActor("ADMIN");
  const sp = await searchParams;
  const week = resolveWeek(sp.hafta);
  const platforms = parsePlatforms(sp.platform);
  const all = platforms.length === PLATFORMS.length;

  const items = await prisma.deliverable.findMany({
    where: {
      plannedAt: weekQueryRange(week.days),
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
    week.days,
    items.map((d) => ({ ...d, campaignName: d.assignment.campaign.name, influencer: d.assignment.influencer })),
    (id) => `/admin/teslimler/${id}`,
  );

  const href = (hafta: string, pl: Platform[]) => {
    const q = new URLSearchParams({ hafta });
    if (pl.length && pl.length < PLATFORMS.length) q.set("platform", pl.join(","));
    return `/admin/takvim?${q.toString()}`;
  };
  const toggle = (p: Platform) => {
    if (all) return [p];
    const next = platforms.includes(p) ? platforms.filter((x) => x !== p) : [...platforms, p];
    return next.length ? next : PLATFORMS;
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Takvim"
        description="Kartı aynı satırda başka güne sürükleyin (saat korunur) ya da saate tıklayıp değiştirin. Influencer'a bildirim gider."
      />
      <div className="flex flex-wrap items-center justify-between gap-4">
        <nav aria-label="Hafta" className="flex items-center gap-2">
          <Link href={href(week.prev, platforms)} className={buttonClass("secondary", "sm")} aria-label="Önceki hafta">
            <ChevronLeftIcon size={16} />
          </Link>
          <span className="min-w-44 text-center text-sm tabular-nums">
            {fmtDayLabel(week.days[0]!)} – {fmtDayLabel(week.days[6]!)}
          </span>
          <Link href={href(week.next, platforms)} className={buttonClass("secondary", "sm")} aria-label="Sonraki hafta">
            <ChevronRightIcon size={16} />
          </Link>
          <Link href={href(week.today, platforms)} className={buttonClass("ghost", "sm")}>
            Bu hafta
          </Link>
        </nav>
        <div role="group" aria-label="Platform filtresi" className="flex flex-wrap gap-2">
          {PLATFORMS.map((p) => {
            const on = all || platforms.includes(p);
            return (
              <Link
                key={p}
                href={href(week.monday, toggle(p))}
                aria-current={on && !all ? "true" : undefined}
                className={cn(
                  "inline-flex h-8 items-center gap-2 rounded-[8px] border px-3 text-[13px] transition-standard",
                  on && !all ? "border-fg text-fg" : on ? "border-border-strong text-fg" : "border-border text-fg-passive hover:text-fg",
                )}
              >
                <PlatformIcon platform={p} size={14} />
                {platformLabels[p]}
              </Link>
            );
          })}
        </div>
      </div>
      <WeekCalendar days={week.days} rows={rows} today={week.today} editable emptyText="Bu hafta, seçili platformlarda planlanmış paylaşım yok." />
    </div>
  );
}
