import { getTT } from "@/lib/i18n/tt-server";
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
import { DashboardBoard, type BoardWidget } from "@/components/dashboard/dashboard-board";
import { CopilotHome } from "@/components/copilot/copilot-home";
import {
  BuildingIcon,
  CalendarIcon,
  FileIcon,
  MegaphoneIcon,
  SparkleIcon,
  UserIcon,
  UserPlusIcon,
  UsersIcon,
  WalletIcon,
  type IconProps,
} from "@/components/icons";
import { PlatformIcon } from "@/components/platform-icon";
import { StatusDot } from "@/components/ui/status";
import { Tooltip } from "@/components/ui/tooltip";
import { DASHBOARD_WIDGETS, loadDashboardLayout, normalizeLayout } from "@/lib/dashboard";
import { compact, pct } from "@/lib/format";
import { loadCampaignScores } from "@/lib/queries";
import { campaignStatusLabels } from "@infulancer/core/domain/labels";
import type { ComponentType, ReactNode } from "react";
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

const QUICK_LINKS: { href: string; label: string; icon: ComponentType<IconProps> }[] = [
  { href: "/admin/kampanyalar/yeni", label: "Yeni kampanya", icon: MegaphoneIcon },
  { href: "/admin/kampanyalar?durum=AKTIF", label: "Influencer ekle", icon: UserPlusIcon },
  { href: "/admin/influencerlar/yeni", label: "Yeni influencer", icon: UsersIcon },
  { href: "/admin/markalar/yeni", label: "Yeni marka", icon: BuildingIcon },
  { href: "/admin/davetler", label: "Davet / başvuru", icon: UserIcon },
  { href: "/admin/takvim", label: "Takvim", icon: CalendarIcon },
  { href: "/admin/finans", label: "Ödemeler", icon: WalletIcon },
  { href: "/admin/agent", label: "Agent merkezi", icon: SparkleIcon },
  { href: "/docs", label: "Dokümantasyon", icon: FileIcon },
];
export default async function AdminHomePage({ searchParams }: { searchParams: Promise<{ yetki?: string }> }) {
  const tt = await getTT();
  const { yetki } = await searchParams;
  const actor = await requireActor("ADMIN");
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

  const [layout, activeList, brandRows, topInfluencers, pendingApplications, unpaidClosed] = await Promise.all([
    loadDashboardLayout(actor.userId),
    prisma.campaign.findMany({
      where: { status: { in: ["AKTIF", "TASLAK"] } },
      orderBy: [{ status: "asc" }, { endsAt: "asc" }],
      take: 8,
      select: {
        id: true,
        name: true,
        status: true,
        startsAt: true,
        endsAt: true,
        brand: { select: { name: true } },
        _count: { select: { assignments: { where: { contractStatus: { not: "RED" } } } } },
      },
    }),
    prisma.brand.findMany({
      select: {
        id: true,
        name: true,
        campaigns: { where: { status: { not: "IPTAL" } }, select: { status: true, brandTotalFeeKurus: true, brandPaymentReceivedAt: true } },
      },
    }),
    prisma.socialAccount.findMany({
      orderBy: { followers: "desc" },
      take: 6,
      select: { platform: true, handle: true, followers: true, engagementRate: true, syncSource: true, influencer: { select: { id: true, name: true } } },
    }),
    prisma.signupApplication.count({ where: { status: "PENDING" } }),
    prisma.campaign.findMany({
      where: { status: "KAPANDI", brandPaymentReceivedAt: null },
      select: { id: true, name: true, brandTotalFeeKurus: true, brand: { select: { name: true } } },
      take: 5,
    }),
  ]);
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

  const scores = await loadCampaignScores(activeList.map((c) => c.id));
  const brandSummary = brandRows
    .map((b) => ({
      id: b.id,
      name: b.name,
      active: b.campaigns.filter((c) => c.status === "AKTIF").length,
      total: b.campaigns.length,
      fee: b.campaigns.reduce((s, c) => s + Number(c.brandTotalFeeKurus), 0),
      due: b.campaigns.filter((c) => c.status === "KAPANDI" && !c.brandPaymentReceivedAt).reduce((s, c) => s + Number(c.brandTotalFeeKurus), 0),
    }))
    .filter((b) => b.total > 0)
    .sort((a, b) => b.active - a.active || b.fee - a.fee)
    .slice(0, 6);
  const requested = payouts.filter((p) => p.status === "TALEP_EDILDI");
  const requestedSum = requested.reduce((s, p) => s + p.amountKurus, 0);
  const unpaidSum = unpaidClosed.reduce((s, c) => s + Number(c.brandTotalFeeKurus), 0);
  const content: Record<(typeof DASHBOARD_WIDGETS)[number]["id"], ReactNode> = {
    copilot: <CopilotHome actor={actor} />,
    kpi: (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label={tt("Aktif kampanya")} value={activeCount} sparkline={sparkActive} hint={tt("Son 8 hafta")} />
          <MetricCard label={tt("Bekleyen onay")} value={pending.length} sparkline={sparkPending} hint={tt("Yüklenen taslak / hafta")} />
          <MetricCard label={tt("Geciken teslim")} value={overdue.length} sparkline={sparkOverdue} hint={tt("Geç yayın / hafta")} />
          <MetricCard label={tt("Ödenecek tutar")} value={payable} format="currency-kurus" sparkline={sparkPayable} hint={tt("Onaylı + ödeme listesinde")} />
        </div>
    ),
    quick: (
      <Card interactive={false} className="flex flex-col gap-3">
        <CardTitle>{tt("Hızlı erişim")}</CardTitle>
        <nav aria-label={tt("Hızlı erişim")} className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-9">
          {QUICK_LINKS.filter((l) => !(actor.staffRole && l.href === "/admin/finans")).map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="flex flex-col items-center gap-2 rounded-[8px] border border-border px-2 py-3 text-center text-[12px] text-fg-muted transition-standard hover:bg-surface-hover hover:text-fg"
            >
              <l.icon size={20} />
              {l.label}
            </Link>
          ))}
        </nav>
      </Card>
    ),
    queue: (
      <Card interactive={false} className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4">
          <CardTitle>{tt("Aksiyon kuyruğu")}</CardTitle>
          <span className="text-[13px] text-fg-passive tabular-nums">
            {queue.length > QUEUE_LIMIT ? `${QUEUE_LIMIT} / ${queue.length}` : queue.length}{" "}{tt("öğe")}</span>
        </div>
        {queue.length === 0 ? (
          <EmptyState message={tt("Bekleyen aksiyon yok. Yeni taslaklar ve agent uyarıları burada toplanır.")} />
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
                    <ButtonLink href={q.href} variant="secondary" size="sm">{" "}{tt("İncele")}</ButtonLink>
                  ) : undefined
                }
              />
            ))}
          </ul>
        )}
        {runs.length > 0 ? (
          <Link href="/admin/agent" className="text-[13px] text-fg-muted hover:text-fg">{" "}{tt("Tüm agent bulguları →")}</Link>
        ) : null}
      </Card>
    ),
    week: (
      <Card interactive={false} className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4">
          <CardTitle>{tt("Bu hafta")}</CardTitle>
          <ButtonLink href="/admin/takvim" variant="secondary" size="sm">{" "}{tt("Takvimi aç")}</ButtonLink>
        </div>
        <WeekCalendar days={week.days} rows={rows} today={week.today} />
      </Card>
    ),
    campaigns: (
      <Card interactive={false} className="flex h-full flex-col gap-4">
        <div className="flex items-center justify-between gap-4">
          <CardTitle>{tt("Aktif ve taslak kampanyalar")}</CardTitle>
          <ButtonLink href="/admin/kampanyalar" variant="secondary" size="sm">{" "}{tt("Tümü")}</ButtonLink>
        </div>
        {activeList.length === 0 ? (
          <EmptyState message={tt("Açık kampanya yok.")} />
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {activeList.map((c) => {
              const span = c.endsAt.getTime() - c.startsAt.getTime();
              const prog = span > 0 ? Math.min(1, Math.max(0, (now.getTime() - c.startsAt.getTime()) / span)) : 0;
              const sc = scores.get(c.id)?.score;
              return (
                <li key={c.id} className="flex flex-col gap-2 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <Link href={`/admin/kampanyalar/${c.id}`} className="text-fg hover:underline">
                      {c.name}
                    </Link>
                    <span className="flex items-center gap-2">
                      <StatusDot tone={c.status === "AKTIF" ? "active" : "muted"}>{campaignStatusLabels[c.status]}</StatusDot>
                      <Tooltip label={tt("Influencer ekle")}>
                      <Link
                        href={`/admin/kampanyalar/${c.id}?sekme=influencerlar`}
                        aria-label={`${c.name}: influencer ekle`}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-[8px] text-fg-muted hover:bg-surface-hover hover:text-fg"
                      >
                        <UserPlusIcon size={15} />
                      </Link>
                      </Tooltip>
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-[12px] tabular-nums text-fg-muted">
                    <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-border" aria-hidden>
                      <span className="block h-full bg-fg" style={{ width: `${Math.round(prog * 100)}%` }} />
                    </span>
                    <span>
                      {c.brand.name} · {c._count.assignments}{" "}{tt("influencer ·")}{" "}{sc == null ? tt("skor —") : `skor ${pct.format(sc)}`}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    ),
    finance: (
      <Card interactive={false} className="flex h-full flex-col gap-4">
        <div className="flex items-center justify-between gap-4">
          <CardTitle>{tt("Finans özeti")}</CardTitle>
          <ButtonLink href="/admin/finans" variant="secondary" size="sm">{" "}{tt("Finans")}</ButtonLink>
        </div>
        <dl className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1">
            <dt className="text-label text-fg-muted">{tt("Ödenecek (influencer)")}</dt>
            <dd className="text-[20px] font-semibold tabular-nums">{formatKurus(payable)}</dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="text-label text-fg-muted">{tt("Çekim talebi")}</dt>
            <dd className="text-[20px] font-semibold tabular-nums">
              {requested.length} · {formatKurus(requestedSum)}
            </dd>
          </div>
          <div className="col-span-2 flex flex-col gap-1">
            <dt className="text-label text-fg-muted">{tt("Bekleyen marka tahsilatı (kapanmış kampanya)")}</dt>
            <dd className="text-[20px] font-semibold tabular-nums">{formatKurus(unpaidSum)}</dd>
          </div>
        </dl>
        {unpaidClosed.length ? (
          <ul className="flex flex-col divide-y divide-border text-sm">
            {unpaidClosed.map((c) => (
              <li key={c.id} className="flex justify-between gap-3 py-2">
                <Link href={`/admin/kampanyalar/${c.id}`} className="hover:underline">
                  {c.brand.name} · {c.name}
                </Link>
                <span className="tabular-nums text-fg-muted">{formatKurus(Number(c.brandTotalFeeKurus))}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[13px] text-fg-passive">{tt("Geciken marka tahsilatı yok.")}</p>
        )}
      </Card>
    ),
    brands: (
      <Card interactive={false} className="flex h-full flex-col gap-4">
        <div className="flex items-center justify-between gap-4">
          <CardTitle>{tt("Markalar")}</CardTitle>
          <ButtonLink href="/admin/markalar" variant="secondary" size="sm">{" "}{tt("Tümü")}</ButtonLink>
        </div>
        {brandSummary.length === 0 ? (
          <EmptyState message={tt("Henüz kampanyası olan marka yok.")} />
        ) : (
          <ul className="flex flex-col divide-y divide-border text-sm">
            {brandSummary.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <Link href={`/admin/markalar/${b.id}`} className="hover:underline">
                  {b.name}
                </Link>
                <span className="text-[12px] tabular-nums text-fg-muted">
                  {b.active}{" "}{tt("aktif /")}{" "}{b.total}{" "}{tt("kampanya ·")}{" "}{formatKurus(b.fee)}
                  {b.due ? <span className="text-critical"> · {formatKurus(b.due)}{" "}{tt("tahsilat bekliyor")}</span> : null}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    ),
    influencers: (
      <Card interactive={false} className="flex h-full flex-col gap-4">
        <div className="flex items-center justify-between gap-4">
          <CardTitle>{tt("Influencerlar")}</CardTitle>
          <ButtonLink href="/admin/influencerlar" variant="secondary" size="sm">{" "}{tt("Tümü")}</ButtonLink>
        </div>
        {pendingApplications ? (
          <Link href="/admin/davetler" className="rounded-[8px] border border-border px-3 py-2 text-sm hover:bg-surface-hover">
            {pendingApplications}{" "}{tt("üyelik başvurusu onayınızı bekliyor →")}</Link>
        ) : null}
        {topInfluencers.length === 0 ? (
          <EmptyState message={tt("Sosyal hesap bilgisi yok.")} />
        ) : (
          <ul className="flex flex-col divide-y divide-border text-sm">
            {topInfluencers.map((a) => (
              <li key={`${a.influencer.id}:${a.platform}`} className="flex items-center justify-between gap-2 py-2">
                <span className="flex items-center gap-2">
                  <PlatformIcon platform={a.platform} size={14} />
                  <Link href={`/admin/influencerlar/${a.influencer.id}`} className="hover:underline">
                    {a.influencer.name}
                  </Link>
                  <span className="text-[12px] text-fg-passive">@{a.handle}</span>
                </span>
                <span className="text-[12px] tabular-nums text-fg-muted">
                  {compact.format(a.followers)} · {pct.format(Number(a.engagementRate))}
                  {a.syncSource !== "manual" ? tt(" · otomatik") : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    ),
  };
  const widgets: BoardWidget[] = DASHBOARD_WIDGETS.filter((w) => !(actor.staffRole && w.id === "finance")).map((w) => ({ id: w.id, title: w.title, description: w.description, size: w.size, content: content[w.id] }));
  return (
    <Stagger className="flex flex-col gap-6">
      {yetki === "yok" ? (
        <p role="alert" className="rounded-2xl border border-neon-amber/50 bg-neon-amber/10 px-4 py-3 text-sm">{" "}{tt("Bu bölüm yalnız platform yöneticisine açık.")}</p>
      ) : null}
      <PageHeader title={tt("Genel bakış")} description={tt("Panonuzu düzenleyebilirsiniz: alanları sıralayın, gizleyin veya geri ekleyin.")} />
      <DashboardBoard widgets={widgets} initial={layout} defaults={normalizeLayout(null)} />
    </Stagger>
  );
}
