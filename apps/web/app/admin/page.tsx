import type { Metadata } from "next";
import Link from "next/link";
import { prisma, type Severity } from "@infulancer/core/db";
import {
  agentCheckLabels,
  contentTypeLabels,
  formatKurus,
  platformLabels,
  reviewDecisionLabels,
  severityLabels,
  severityRank,
} from "@infulancer/core/domain/labels";
import { WeekCalendar } from "@/components/calendar/week-calendar";
import { AgentRunResolve } from "@/components/forms/small-forms";
import { Card, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ButtonLink } from "@/components/ui/form";
import { PageHeader, Stagger } from "@/components/ui/layout";
import { MetricCard } from "@/components/ui/metric-card";
import { ActionQueueItem } from "@/components/ui/status";
import { requireActor } from "@/lib/auth-guard";
import { buildCalendarRows, isOverdue, resolveWeek, weekQueryRange } from "@/lib/calendar";
import { fmtDateTime } from "@/lib/time";

export const metadata: Metadata = { title: "Genel bakış" };

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKS = 8;
const QUEUE_LIMIT = 25;

type QueueItem = {
  key: string;
  severity: Severity;
  title: string;
  meta: string;
  at: Date;
  href?: string;
  agentRunId?: string;
};

export default async function AdminHomePage() {
  await requireActor("ADMIN");
  const now = new Date();
  const since = new Date(now.getTime() - WEEKS * 7 * DAY_MS);
  const week = resolveWeek(undefined, now);
  const liveAssignment = { contractStatus: { not: "RED" as const } };

  const deliverableSelect = {
    id: true,
    platform: true,
    contentType: true,
    status: true,
    plannedAt: true,
    approvalDeadline: true,
    publishedAt: true,
    contractViolation: true,
    assignment: { select: { campaign: { select: { name: true } }, influencer: { select: { id: true, name: true, audienceTimezone: true } } } },
  } as const;

  const [campaigns, openDeliverables, recentPlanned, draftChanges, payouts, runs, reviews, weekItems] = await Promise.all([
    prisma.campaign.findMany({ where: { status: { in: ["AKTIF", "KAPANDI"] } }, select: { status: true, startsAt: true, endsAt: true, closedAt: true } }),
    // Gecikme/onay adayları: henüz yayınlanmamış tüm işler.
    prisma.deliverable.findMany({
      where: {
        status: { in: ["ATANDI", "BRIEF_GONDERILDI", "ICERIK_YUKLENDI", "REVIZYON", "ONAYLANDI"] },
        assignment: { ...liveAssignment, campaign: { status: { not: "IPTAL" } } },
      },
      select: deliverableSelect,
    }),
    prisma.deliverable.findMany({
      where: { plannedAt: { gte: since, lt: now }, status: { not: "IPTAL" }, assignment: liveAssignment },
      select: { plannedAt: true, publishedAt: true },
    }),
    prisma.deliverableStatusChange.findMany({ where: { to: "ICERIK_YUKLENDI", at: { gte: since } }, select: { at: true } }),
    prisma.payoutRequest.findMany({
      where: { status: { not: "REDDEDILDI" } },
      select: { id: true, status: true, amountKurus: true, createdAt: true, approvedAt: true, sentAt: true, influencer: { select: { name: true } } },
    }),
    prisma.agentRun.findMany({ where: { status: "ACIK" }, orderBy: { createdAt: "asc" }, take: 100 }),
    prisma.deliverableReview.findMany({
      where: { createdAt: { gte: new Date(now.getTime() - 14 * DAY_MS) }, deliverable: { status: "ICERIK_YUKLENDI" } },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        decision: true,
        note: true,
        createdAt: true,
        deliverableId: true,
        brandUser: { select: { name: true } },
        deliverable: { select: { assignment: { select: { influencer: { select: { name: true } } } } } },
      },
    }),
    prisma.deliverable.findMany({
      where: { plannedAt: weekQueryRange(week.days), status: { not: "IPTAL" }, assignment: liveAssignment },
      select: deliverableSelect,
    }),
  ]);

  // ── KPI'lar ──
  const activeCount = campaigns.filter((c) => c.status === "AKTIF").length;
  const pending = openDeliverables.filter((d) => d.status === "ICERIK_YUKLENDI");
  const overdue = openDeliverables.filter((d) => isOverdue(d, now));
  const payableStatuses = new Set(["ONAYLANDI", "ODEME_LISTESINDE"]);
  const payable = payouts.filter((p) => payableStatuses.has(p.status)).reduce((s, p) => s + p.amountKurus, 0);

  // ── Son 8 haftanın eğrileri (haftalık uç noktalar) ──
  const ends = Array.from({ length: WEEKS }, (_, i) => new Date(now.getTime() - (WEEKS - 1 - i) * 7 * DAY_MS));
  const sparkActive = ends.map((end) => {
    const start = end.getTime() - 7 * DAY_MS;
    return campaigns.filter((c) => c.startsAt <= end && (c.closedAt ?? c.endsAt).getTime() >= start).length;
  });
  const sparkPending = ends.map((end) => draftChanges.filter((c) => c.at <= end && c.at.getTime() > end.getTime() - 7 * DAY_MS).length);
  const sparkOverdue = ends.map(
    (end) =>
      recentPlanned.filter(
        (d) =>
          d.plannedAt <= end &&
          d.plannedAt.getTime() > end.getTime() - 7 * DAY_MS &&
          (!d.publishedAt || d.publishedAt.getTime() > d.plannedAt.getTime() + 30 * 60_000),
      ).length,
  );
  const sparkPayable = ends.map((end) =>
    payouts
      .filter((p) => (p.approvedAt ?? p.createdAt) <= end && p.status !== "TALEP_EDILDI" && (!p.sentAt || p.sentAt > end))
      .reduce((s, p) => s + p.amountKurus, 0),
  );

  // ── Aksiyon kuyruğu ──
  const label = (d: (typeof openDeliverables)[number]) =>
    `${d.assignment.influencer.name} · ${platformLabels[d.platform]} ${contentTypeLabels[d.contentType]}`;
  const queue: QueueItem[] = [];
  for (const d of pending) {
    const late = d.approvalDeadline < now;
    queue.push({
      key: `draft:${d.id}`,
      severity: late ? "UYARI" : "BILGI",
      title: `${late ? "Onay gecikti" : "Onay bekleyen taslak"}: ${label(d)}`,
      meta: `${d.assignment.campaign.name} · onay son tarihi ${fmtDateTime(d.approvalDeadline)}`,
      at: d.approvalDeadline,
      href: `/admin/teslimler/${d.id}`,
    });
  }
  for (const d of overdue) {
    if (d.status === "ICERIK_YUKLENDI") continue; // Taslak olarak zaten listede.
    const missedPublish = d.plannedAt < now;
    queue.push({
      key: `late:${d.id}`,
      severity: missedPublish ? "KRITIK" : "UYARI",
      title: `${missedPublish ? "Yayın gecikti" : "İçerik gecikti"}: ${label(d)}`,
      meta: `${d.assignment.campaign.name} · ${missedPublish ? `paylaşım ${fmtDateTime(d.plannedAt)}` : `onay son tarihi ${fmtDateTime(d.approvalDeadline)}`}`,
      at: missedPublish ? d.plannedAt : d.approvalDeadline,
      href: `/admin/teslimler/${d.id}`,
    });
  }
  for (const r of runs) {
    queue.push({
      key: `run:${r.id}`,
      severity: r.severity,
      title: r.summary,
      meta: `Agent · ${agentCheckLabels[r.checkType]} · ${fmtDateTime(r.createdAt)}`,
      at: r.createdAt,
      href: r.targetType === "Deliverable" ? `/admin/teslimler/${r.targetId}` : r.targetType === "Campaign" ? `/admin/kampanyalar/${r.targetId}` : undefined,
      agentRunId: r.id,
    });
  }
  for (const p of payouts.filter((x) => x.status === "TALEP_EDILDI")) {
    queue.push({
      key: `payout:${p.id}`,
      severity: "BILGI",
      title: `Çekim talebi: ${p.influencer.name} · ${formatKurus(p.amountKurus)}`,
      meta: `Talep ${fmtDateTime(p.createdAt)}`,
      at: p.createdAt,
      href: "/admin/finans",
    });
  }
  const seenReview = new Set<string>();
  for (const r of reviews) {
    if (seenReview.has(r.deliverableId)) continue;
    seenReview.add(r.deliverableId);
    queue.push({
      key: `review:${r.id}`,
      severity: r.decision === "REVIZYON" ? "UYARI" : "BILGI",
      title: `Marka incelemesi (${reviewDecisionLabels[r.decision]}): ${r.deliverable.assignment.influencer.name}`,
      meta: `${r.brandUser.name} · ${r.note}`,
      at: r.createdAt,
      href: `/admin/teslimler/${r.deliverableId}`,
    });
  }
  queue.sort((a, b) => severityRank[b.severity] - severityRank[a.severity] || a.at.getTime() - b.at.getTime());

  const rows = buildCalendarRows(
    week.days,
    weekItems.map((d) => ({ ...d, campaignName: d.assignment.campaign.name, influencer: d.assignment.influencer })),
    (id) => `/admin/teslimler/${id}`,
  );

  return (
    <Stagger className="flex flex-col gap-8">
      <PageHeader title="Genel bakış" description="Aktif kampanyalar, onay bekleyen içerikler, gecikmeler ve agent uyarıları." />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Aktif kampanya" value={activeCount} sparkline={sparkActive} hint="Son 8 hafta" />
        <MetricCard label="Bekleyen onay" value={pending.length} sparkline={sparkPending} hint="Yüklenen taslak / hafta" />
        <MetricCard label="Geciken teslim" value={overdue.length} sparkline={sparkOverdue} hint="Geç yayın / hafta" />
        <MetricCard label="Ödenecek tutar" value={payable} format="currency-kurus" sparkline={sparkPayable} hint="Onaylı + ödeme listesinde" />
      </div>
      <Card interactive={false} className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4">
          <CardTitle>Aksiyon kuyruğu</CardTitle>
          <span className="text-[13px] text-fg-passive tabular-nums">
            {queue.length > QUEUE_LIMIT ? `${QUEUE_LIMIT} / ${queue.length}` : queue.length} öğe
          </span>
        </div>
        {queue.length === 0 ? (
          <EmptyState message="Bekleyen aksiyon yok. Yeni taslaklar ve agent uyarıları burada toplanır." />
        ) : (
          <ul className="flex flex-col gap-3">
            {queue.slice(0, QUEUE_LIMIT).map((q) => (
              <ActionQueueItem
                key={q.key}
                severity={q.severity}
                severityLabel={severityLabels[q.severity]}
                title={q.href ? <Link href={q.href} className="hover:underline">{q.title}</Link> : q.title}
                meta={`${severityLabels[q.severity]} · ${q.meta}`}
                actions={
                  q.agentRunId ? (
                    <AgentRunResolve id={q.agentRunId} />
                  ) : q.href ? (
                    <ButtonLink href={q.href} variant="secondary" size="sm">
                      İncele
                    </ButtonLink>
                  ) : undefined
                }
              />
            ))}
          </ul>
        )}
        {runs.length > 0 ? (
          <Link href="/admin/agent" className="text-[13px] text-fg-muted hover:text-fg">
            Tüm agent bulguları →
          </Link>
        ) : null}
      </Card>
      <Card interactive={false} className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4">
          <CardTitle>Bu hafta</CardTitle>
          <ButtonLink href="/admin/takvim" variant="secondary" size="sm">
            Takvimi aç
          </ButtonLink>
        </div>
        <WeekCalendar days={week.days} rows={rows} today={week.today} />
      </Card>
    </Stagger>
  );
}
