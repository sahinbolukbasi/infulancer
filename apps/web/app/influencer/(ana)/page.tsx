import type { Metadata } from "next";
import Link from "next/link";
import { toInfluencerAssignmentView } from "@infulancer/core/access/dto";
import { prisma } from "@infulancer/core/db";
import { contentTypeLabels, deliverableStatusLabels, platformLabels } from "@infulancer/core/domain/labels";
import { WeekAgenda, WeekCalendar } from "@/components/calendar/week-calendar";
import { ContractDecision } from "@/components/forms/small-forms";
import { PlatformIcon } from "@/components/platform-icon";
import { Card, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader, Stagger } from "@/components/ui/layout";
import { StatusDot } from "@/components/ui/status";
import { requireActor } from "@/lib/auth-guard";
import { buildCalendarRows, isOverdue, resolveWeek } from "@/lib/calendar";
import { deliverableTone } from "@/lib/status-tone";
import { fmtDate, fmtDateTime } from "@/lib/time";

export const metadata: Metadata = { title: "İşlerim" };

export default async function InfluencerHomePage() {
  const actor = await requireActor("INFLUENCER");
  const influencerId = actor.influencerId!;
  const [me, assignments] = await Promise.all([
    prisma.influencer.findUniqueOrThrow({ where: { id: influencerId }, select: { id: true, name: true, audienceTimezone: true } }),
    prisma.assignment.findMany({
      where: { influencerId },
      orderBy: { createdAt: "desc" },
      include: { campaign: { include: { brand: { select: { name: true } } } }, deliverables: { orderBy: { plannedAt: "asc" } } },
    }),
  ]);
  // Influencer ekranına veri yalnız DTO üzerinden (bütçe/komisyon yok).
  const views = assignments.map(toInfluencerAssignmentView);
  const tz = me.audienceTimezone;
  const now = new Date();
  const offers = views.filter((a) => a.contractStatus === "TEKLIF");
  const active = views.filter((a) => a.contractStatus === "KABUL");

  const week = resolveWeek(undefined, now);
  const sources = active.flatMap((a) =>
    a.deliverables.filter((d) => d.status !== "IPTAL").map((d) => ({ ...d, campaignName: a.campaign.name, influencer: me })),
  );
  const rows = buildCalendarRows(week.days, sources, (id) => `/influencer/isler/${id}`);
  const weekCards = rows.flatMap((r) => r.cards);

  return (
    <Stagger className="flex flex-col gap-6">
      <PageHeader title="İşlerim" description="Brief, dosyalar, yayın tarihleri ve metrik girişi." />

      {offers.length > 0 ? (
        <Card interactive={false} className="flex flex-col gap-4">
          <CardTitle>Bekleyen teklifler</CardTitle>
          <ul className="flex flex-col divide-y divide-border">
            {offers.map((o) => (
              <li key={o.id} className="flex flex-col gap-3 py-4 first:pt-0 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-col gap-1">
                  <span className="text-sm text-fg">{o.campaign.name}</span>
                  <span className="text-[13px] text-fg-muted">
                    {o.campaign.brandName} · {fmtDate(o.campaign.startsAt, tz)} – {fmtDate(o.campaign.endsAt, tz)} · {o.deliverables.length} iş
                    {o.exclusivityDays ? ` · ${o.exclusivityDays} gün münhasırlık` : ""}
                  </span>
                  {o.deliverables[0] ? (
                    <Link href={`/influencer/isler/${o.deliverables[0].id}`} className="text-[13px] text-fg-muted hover:text-fg">
                      Brief&apos;i gör →
                    </Link>
                  ) : null}
                </div>
                <ContractDecision assignmentId={o.id} />
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Card interactive={false} className="flex flex-col gap-4">
        <CardTitle>Bu hafta</CardTitle>
        <div className="md:hidden">
          <WeekAgenda days={week.days} cards={weekCards} today={week.today} />
        </div>
        <div className="hidden md:block">
          <WeekCalendar days={week.days} rows={rows} today={week.today} emptyText="Bu hafta paylaşımınız yok." />
        </div>
      </Card>

      <Card interactive={false} className="flex flex-col gap-4">
        <CardTitle>İşler</CardTitle>
        {active.length === 0 ? (
          <EmptyState message="Kabul ettiğiniz bir iş olduğunda brief ve teslim tarihleri burada listelenir." />
        ) : (
          <div className="flex flex-col gap-6">
            {active.map((a) => (
              <section key={a.id} className="flex flex-col gap-2" aria-label={a.campaign.name}>
                <h3 className="text-sm text-fg">
                  {a.campaign.name} <span className="text-fg-passive">· {a.campaign.brandName}</span>
                </h3>
                <ul className="flex flex-col gap-2">
                  {a.deliverables.map((d) => {
                    const late = isOverdue(d, now);
                    return (
                      <li key={d.id}>
                        <Link
                          href={`/influencer/isler/${d.id}`}
                          className="flex flex-wrap items-center justify-between gap-3 rounded-[8px] border border-border bg-surface px-4 py-3 transition-standard hover:border-border-strong"
                        >
                          <span className="flex items-center gap-2 text-sm">
                            <PlatformIcon platform={d.platform} size={16} title={platformLabels[d.platform]} />
                            {contentTypeLabels[d.contentType]}
                          </span>
                          <span className="text-[13px] tabular-nums text-fg-muted">{fmtDateTime(d.plannedAt, tz)}</span>
                          <StatusDot tone={deliverableTone(d.status, { overdue: late, violation: d.contractViolation })}>
                            {deliverableStatusLabels[d.status]}
                            {late ? " · gecikti" : ""}
                          </StatusDot>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        )}
      </Card>
    </Stagger>
  );
}
