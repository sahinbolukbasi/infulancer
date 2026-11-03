import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { loadBrandCampaignReport } from "@infulancer/core/access/brand-report";
import { isDomainError } from "@infulancer/core/domain/errors";
import {
  campaignStatusLabels,
  contentTypeLabels,
  deliverableStatusLabels,
  formatKurus,
  metricSourceLabels,
  platformLabels,
  reviewDecisionLabels,
  trustLevelLabels,
  usageChannelLabels,
} from "@infulancer/core/domain/labels";
import { DeliverableReview } from "@/components/brand/draft-review-form";
import { WeekCalendar } from "@/components/calendar/week-calendar";
import { KpiBreakdown } from "@/components/campaign/kpi-breakdown";
import { AssetThumb } from "@/components/files/asset-thumb";
import { ChevronLeftIcon, ChevronRightIcon, ExternalIcon, FileIcon } from "@/components/icons";
import { PlatformIcon } from "@/components/platform-icon";
import { Card, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonClass } from "@/components/ui/form";
import { PageHeader } from "@/components/ui/layout";
import { StatusDot } from "@/components/ui/status";
import { requireActor } from "@/lib/auth-guard";
import { buildCalendarRows, resolveWeek } from "@/lib/calendar";
import { num, pct, pct1 } from "@/lib/format";
import { campaignTone } from "@/lib/status-tone";
import { AGENCY_TZ, fmtDate, fmtDateTime, fmtDayLabel } from "@/lib/time";

export const metadata: Metadata = { title: "Kampanya raporu" };

const roasFmt = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 2 });

export default async function BrandCampaignPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ hafta?: string | string[] }>;
}) {
  const actor = await requireActor("BRAND");
  const { id } = await params;
  const { hafta } = await searchParams;
  const now = new Date();

  // Yalnız core DTO'su (bedel/komisyon/bütçe içermez); başka markanın kampanyası → 404.
  const report = await loadBrandCampaignReport(actor, id, now).catch((err: unknown) => {
    if (isDomainError(err) && (err.code === "BULUNAMADI" || err.code === "YETKISIZ")) notFound();
    throw err;
  });
  const { campaign, score } = report;

  const inRange = now >= campaign.startsAt && now <= campaign.endsAt;
  const week = { ...resolveWeek(hafta, inRange ? now : campaign.startsAt), today: resolveWeek(undefined, now).today };
  const base = `/marka/kampanyalar/${campaign.id}`;
  const rows = buildCalendarRows(
    week.days,
    report.deliverables.map((d) => ({
      ...d,
      contractViolation: false,
      campaignName: campaign.name,
      influencer: { id: d.influencer.id, name: d.influencer.name, audienceTimezone: AGENCY_TZ },
    })),
    (did) => `${base}?hafta=${week.monday}#is-${did}`,
  );

  const summary = (
    <div className="grid-12">
      <Card interactive={false} className="flex flex-col gap-6 md:col-span-8">
        <CardTitle>Kampanya skoru</CardTitle>
        <KpiBreakdown score={score} large />
      </Card>
      <Card interactive={false} className="flex flex-col gap-4 md:col-span-4">
        <CardTitle>Özet</CardTitle>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          <dt className="text-fg-passive">Tarih</dt>
          <dd className="tabular-nums">
            {fmtDate(campaign.startsAt)} – {fmtDate(campaign.endsAt)}
          </dd>
          <dt className="text-fg-passive">Toplam ödenen</dt>
          <dd className="tabular-nums">{formatKurus(campaign.brandTotalFeeKurus)}</dd>
          <dt className="text-fg-passive">Erişim</dt>
          <dd className="tabular-nums">{num.format(report.totals.reach)}</dd>
          <dt className="text-fg-passive">Tıklama</dt>
          <dd className="tabular-nums">{num.format(report.totals.clicks)}</dd>
          <dt className="text-fg-passive">Satış</dt>
          <dd className="tabular-nums">{num.format(report.totals.sales)}</dd>
          {report.roas != null ? (
            <>
              <dt className="text-fg-passive">Ciro</dt>
              <dd className="tabular-nums">{formatKurus(report.totals.revenueKurus)}</dd>
              <dt className="text-fg-passive">ROAS</dt>
              <dd className="tabular-nums">{roasFmt.format(report.roas)}x</dd>
            </>
          ) : null}
        </dl>
        {campaign.reportSummary ? (
          <div className="flex flex-col gap-2 border-t border-border pt-4">
            <h3 className="text-label text-fg-muted">Ajans özeti</h3>
            <p className="text-sm leading-relaxed whitespace-pre-line text-fg-muted">{campaign.reportSummary}</p>
          </div>
        ) : null}
      </Card>
    </div>
  );

  const trust = (
    <Card interactive={false} className="flex flex-col gap-4">
      <CardTitle>Metrik kaynakları ve güven düzeyi</CardTitle>
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {report.trust.map((t) => (
          <li key={t.source} className="flex flex-col gap-1 rounded-[8px] border border-border px-4 py-3">
            <StatusDot tone={t.level === "YUKSEK" ? "active" : t.level === "ORTA" ? "muted" : "passive"}>{metricSourceLabels[t.source]}</StatusDot>
            <span className="text-[13px] text-fg-passive">
              {trustLevelLabels[t.level]} · {num.format(t.count)} ölçüm
            </span>
          </li>
        ))}
      </ul>
      <p className="text-[13px] text-fg-passive">
        Platform API ve marka verisi yüksek, agent tarafından doğrulanan ekran görüntüsü orta, manuel giriş düşük güvenlidir.
      </p>
    </Card>
  );

  const calendar = (
    <Card interactive={false} className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <CardTitle>Yayın takvimi</CardTitle>
        <nav aria-label="Hafta" className="flex items-center gap-2 text-[13px] text-fg-muted">
          <Link href={`${base}?hafta=${week.prev}`} className={buttonClass("ghost", "sm")} aria-label="Önceki hafta">
            <ChevronLeftIcon size={16} />
          </Link>
          <span className="tabular-nums">
            {fmtDayLabel(week.days[0]!)} – {fmtDayLabel(week.days[6]!)}
          </span>
          <Link href={`${base}?hafta=${week.next}`} className={buttonClass("ghost", "sm")} aria-label="Sonraki hafta">
            <ChevronRightIcon size={16} />
          </Link>
        </nav>
      </div>
      <WeekCalendar days={week.days} rows={rows} today={week.today} emptyText="Bu hafta planlanmış paylaşım yok." />
      <p className="text-[12px] text-fg-passive">Saatler İstanbul saatine göredir.</p>
    </Card>
  );

  const performance = (
    <Card interactive={false} className="flex flex-col gap-4">
      <CardTitle>Influencer performansı</CardTitle>
      <DataTable
        caption="Influencer performansı"
        emptyText="Kampanyada henüz influencer yok."
        initialSort={{ key: "reach", dir: "desc" }}
        columns={[
          { key: "name", header: "Influencer", sortable: true },
          { key: "platforms", header: "Platform" },
          { key: "deliverables", header: "İçerik", align: "right", sortable: true },
          { key: "reach", header: "Erişim", align: "right", sortable: true },
          { key: "er", header: "ER", align: "right", sortable: true },
          { key: "clicks", header: "Tıklama", align: "right", sortable: true },
          { key: "sales", header: "Satış", align: "right", sortable: true },
          { key: "onTime", header: "Zamanında", align: "right", sortable: true },
        ]}
        rows={report.influencers.map((r) => ({
          id: r.influencerId,
          cells: {
            name: {
              display: (
                <span className="flex flex-col">
                  {r.name}
                  <span className="text-[12px] text-fg-passive">{r.accounts.map((a) => a.handle).join(" · ") || "—"}</span>
                </span>
              ),
              sort: r.name,
            },
            platforms: (
              <span className="flex gap-2 text-fg-muted">
                {r.platforms.map((p) => (
                  <PlatformIcon key={p} platform={p} size={14} title={platformLabels[p]} />
                ))}
              </span>
            ),
            deliverables: { display: r.deliverableCount, sort: r.deliverableCount },
            reach: { display: num.format(r.reach), sort: r.reach },
            er: { display: r.er == null ? "—" : pct1.format(r.er), sort: r.er },
            clicks: { display: num.format(r.clicks), sort: r.clicks },
            sales: { display: num.format(r.sales), sort: r.sales },
            onTime: {
              display: r.onTimeRate == null ? "—" : `${pct.format(r.onTimeRate)} (${r.onTimeCount}/${r.publishedCount})`,
              sort: r.onTimeRate,
            },
          },
        }))}
      />
    </Card>
  );

  const drafts = (
    <Card interactive={false} className="flex flex-col gap-4" id="taslaklar">
      <CardTitle>Onayınızı bekleyen taslaklar</CardTitle>
      {report.pendingDrafts.length === 0 ? (
        <p className="text-sm text-fg-passive">Görüş bekleyen taslak yok.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {report.pendingDrafts.map(({ deliverable: d, assets, reviews }) => (
            <li key={d.id} id={`is-${d.id}`} className="grid grid-cols-1 gap-4 py-5 first:pt-0 lg:grid-cols-2">
              <div className="flex flex-col gap-2">
                <span className="flex items-center gap-2 text-sm text-fg">
                  <PlatformIcon platform={d.platform} size={16} title={platformLabels[d.platform]} />
                  {d.influencer.name} · {contentTypeLabels[d.contentType]}
                </span>
                <span className="text-[13px] text-fg-muted tabular-nums">
                  Paylaşım {fmtDateTime(d.plannedAt)} · onay son tarihi {fmtDateTime(d.approvalDeadline)}
                </span>
                {d.caption ? <p className="text-[13px] leading-relaxed whitespace-pre-line text-fg-muted">{d.caption}</p> : null}
                {assets.length ? (
                  <ul className="flex flex-col gap-1">
                    {assets.map((a) => (
                      <li key={a.id}>
                        <a
                          href={`/api/assets/${a.id}/download`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 text-[13px] text-fg-muted hover:text-fg"
                        >
                          <FileIcon size={14} /> {a.fileName} önizle
                          <span className="sr-only">(yeni sekmede açılır)</span>
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-[13px] text-fg-passive">Önizlenecek dosya yok.</p>
                )}
                {reviews.length ? (
                  <ul className="flex flex-col gap-1 border-t border-border pt-2 text-[13px] text-fg-passive">
                    {reviews.slice(0, 3).map((r) => (
                      <li key={r.createdAt.toISOString()}>
                        {reviewDecisionLabels[r.decision]} · {r.byName} · {fmtDateTime(r.createdAt)}
                        {r.note ? ` — ${r.note}` : ""}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
              <DeliverableReview deliverableId={d.id} />
            </li>
          ))}
        </ul>
      )}
    </Card>
  );

  const gallery = (
    <Card interactive={false} className="flex flex-col gap-4">
      <CardTitle>İçerik galerisi</CardTitle>
      {report.gallery.length === 0 ? (
        <p className="text-sm text-fg-passive">Henüz yayınlanmış içerik yok.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {report.gallery.map(({ deliverable: d, thumbAssetId, usage, reach }) => (
            <li key={d.id} id={`is-${d.id}`} className="overflow-hidden rounded-[8px] border border-border bg-surface transition-standard hover:border-border-strong">
              <AssetThumb assetId={thumbAssetId} platform={d.platform} alt={`${d.influencer.name} ${contentTypeLabels[d.contentType]}`} />
              <div className="flex flex-col gap-1 p-3 text-[12px]">
                <span className="truncate text-fg">{d.influencer.name}</span>
                <span className="flex items-center gap-1 text-fg-passive">
                  <PlatformIcon platform={d.platform} size={12} /> {contentTypeLabels[d.contentType]} · {deliverableStatusLabels[d.status]}
                </span>
                {reach != null ? <span className="text-fg-muted tabular-nums">{num.format(reach)} erişim</span> : null}
                {usage ? (
                  <span className="w-fit rounded-[6px] border border-border px-2 py-0.5 text-fg-muted">
                    {usage.channel ? usageChannelLabels[usage.channel] : "Kullanım hakkı"}
                    {usage.endsAt ? ` · ${fmtDate(usage.endsAt)}'e kadar` : usage.durationDays ? ` · ${usage.durationDays} gün` : ""}
                    {usage.geography.length ? ` · ${usage.geography.join(", ")}` : ""}
                  </span>
                ) : null}
                {d.postUrl ? (
                  <a href={d.postUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-fg-muted hover:text-fg">
                    Paylaşımı aç <ExternalIcon size={12} />
                    <span className="sr-only">(yeni sekmede açılır)</span>
                  </a>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title={campaign.name}
        description={
          <span className="inline-flex flex-wrap items-center gap-3">
            <StatusDot tone={campaignTone(campaign.status)}>{campaignStatusLabels[campaign.status]}</StatusDot>
            <span>{campaign.brandName}</span>
          </span>
        }
        actions={
          <a href={`/api/raporlar/kampanya/${campaign.id}/pdf`} download className={buttonClass("primary")}>
            Raporu indir (PDF)
          </a>
        }
      />
      {summary}
      {drafts}
      {report.deliverables.length === 0 ? <EmptyState message="Bu kampanyada henüz planlanmış içerik yok." /> : calendar}
      {performance}
      {gallery}
      {trust}
    </div>
  );
}
