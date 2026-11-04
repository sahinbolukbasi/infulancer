import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@infulancer/core/db";
import { computeCampaignScore } from "@infulancer/core/domain/campaign-score";
import {
  assetKindLabels,
  campaignStatusLabels,
  contentTypeLabels,
  deliverableStatusLabels,
  formatKurus,
  platformLabels,
} from "@infulancer/core/domain/labels";
import { AgentRunList } from "@/components/agent/agent-run-list";
import { CampaignLifecycle } from "@/components/campaign/campaign-lifecycle";
import { ApproveSummaryButton, RecommendButton } from "@/components/forms/agent-job-forms";
import { BriefPanel } from "@/components/brief-panel";
import { KpiBreakdown } from "@/components/campaign/kpi-breakdown";
import { AssetList } from "@/components/files/asset-list";
import { AssetThumb } from "@/components/files/asset-thumb";
import { FileUploader } from "@/components/files/file-uploader";
import { AssignmentForm } from "@/components/forms/assignment-form";
import { DeliverableForm } from "@/components/forms/deliverable-form";
import { BrandDataForm, BrandPaymentForm, CloseCampaignForm, ContractDecision } from "@/components/forms/small-forms";
import { ExternalIcon, UserPlusIcon } from "@/components/icons";
import { InfluencerPicker, type PickerInfluencer } from "@/components/campaign/influencer-picker";
import { categoryLabel } from "@infulancer/core/domain/categories";
import { PlatformIcon } from "@/components/platform-icon";
import { Card, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { ButtonLink } from "@/components/ui/form";
import { PageHeader } from "@/components/ui/layout";
import { StatusDot } from "@/components/ui/status";
import { Tabs } from "@/components/ui/tabs";
import { requireActor } from "@/lib/auth-guard";
import { pickAvatar } from "@/components/ui/avatar";
import { TrackerGallery, TrackerList } from "@/components/agent/tracker-ui";
import { loadTrackerViews, templateViews } from "@/lib/trackers";
import { isOverdue } from "@/lib/calendar";
import { num } from "@/lib/format";
import { scoreDeliverableSelect, toScoreDeliverables } from "@/lib/queries";
import { campaignTone, contractTone, contractUiLabels, deliverableTone } from "@/lib/status-tone";
import { AGENCY_TZ, fmtDate, fmtDateTime, tzShort } from "@/lib/time";

export const metadata: Metadata = { title: "Kampanya" };

const AGENCY_KINDS = ["BRIEF_PDF", "MARKA_LOGO", "MARKA_FONT", "ORNEK_CEKIM", "URUN_FOTO", "ONAYLI_CAPTION", "DIGER"] as const;

type Candidate = { influencerId?: string; name?: string; score?: number; rationale?: string };

function candidatesOf(findings: unknown): Candidate[] {
  const f = findings as { candidates?: unknown } | null;
  return Array.isArray(f?.candidates) ? (f.candidates as Candidate[]).filter((c) => c && typeof c === "object") : [];
}

export default async function CampaignDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ sekme?: string }>;
}) {
  await requireActor("ADMIN");
  const { id } = await params;
  const { sekme } = await searchParams;
  const campaign = await prisma.campaign.findUnique({
    where: { id },
    include: {
      brand: { select: { id: true, name: true } },
      briefs: { orderBy: { version: "desc" }, take: 1 },
      assets: { where: { uploadStatus: "TAMAM" }, orderBy: { createdAt: "desc" }, include: { uploadedBy: { select: { name: true } } } },
      assignments: {
        orderBy: { createdAt: "asc" },
        include: {
          influencer: {
            select: { id: true, name: true, category: true, audienceTimezone: true, socialAccounts: { select: { platform: true, handle: true, followers: true } } },
          },
          deliverables: {
            orderBy: { plannedAt: "asc" },
            include: {
              metricSnapshots: scoreDeliverableSelect.metricSnapshots,
              assets: { where: { uploadStatus: "TAMAM" }, orderBy: { createdAt: "asc" }, include: { uploadedBy: { select: { name: true } } } },
            },
          },
        },
      },
    },
  });
  if (!campaign) notFound();

  const now = new Date();
  const live = campaign.assignments.filter((a) => a.contractStatus !== "RED");
  const deliverables = live.flatMap((a) => a.deliverables.map((d) => ({ ...d, influencer: a.influencer })));
  const score = computeCampaignScore(campaign, toScoreDeliverables(deliverables), now);
  const brief = campaign.briefs[0];
  const deliverableIds = campaign.assignments.flatMap((a) => a.deliverables.map((d) => d.id));

  const [runs, influencers] = await Promise.all([
    prisma.agentRun.findMany({
      where: {
        OR: [
          { targetType: "Campaign", targetId: campaign.id },
          { targetType: "Deliverable", targetId: { in: deliverableIds } },
          { targetType: "Assignment", targetId: { in: campaign.assignments.map((a) => a.id) } },
          { targetType: "Influencer", checkType: "MARKA_CAKISMASI", findings: { path: ["campaignId"], equals: campaign.id } },
        ],
      },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      include: { resolvedBy: { select: { name: true } } },
      take: 100,
    }),
    prisma.influencer.findMany({
      where: { assignments: { none: { campaignId: campaign.id, contractStatus: { not: "RED" } } } },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        category: true,
        city: true,
        categories: { include: { category: { include: { parent: { select: { name: true } } } } }, orderBy: { primary: "desc" } },
        socialAccounts: { select: { platform: true, handle: true, followers: true, engagementRate: true, avatarUrl: true } },
        assignments: {
          where: { contractStatus: { not: "RED" } },
          orderBy: { createdAt: "desc" },
          select: { feeKurus: true, campaign: { select: { brandId: true } } },
        },
      },
    }),
  ]);
  const trackers = await loadTrackerViews({ scope: "CAMPAIGN", targetId: campaign.id });
  const suggestions = runs.filter((r) => r.checkType === "INFLUENCER_ONERI" && r.targetType === "Campaign");
  const editable = campaign.status === "TASLAK" || campaign.status === "AKTIF";
  const suggested = new Map<string, string | undefined>();
  for (const s of suggestions) for (const c of candidatesOf(s.findings)) if (c.influencerId) suggested.set(c.influencerId, c.rationale);
  const pickerInfluencers: PickerInfluencer[] = influencers.map((i) => {
    const accounts = i.socialAccounts.map((a) => ({ platform: a.platform, handle: a.handle, followers: a.followers, er: Number(a.engagementRate) }));
    return {
      id: i.id,
      name: i.name,
      city: i.city,
      primaryCategory: i.categories[0] ? categoryLabel(i.categories[0].category) : i.category,
      categories: [...new Set(i.categories.flatMap((c) => [c.category.name, c.category.parent?.name].filter((x): x is string => !!x)).concat(i.category ? [i.category] : []))],
      accounts,
      totalFollowers: accounts.reduce((s, a) => s + a.followers, 0),
      bestEr: accounts.reduce((m, a) => Math.max(m, a.er), 0),
      lastFeeTl: i.assignments[0] ? Math.round(i.assignments[0].feeKurus / 100) : null,
      brandHistory: i.assignments.filter((a) => a.campaign.brandId === campaign.brand.id).length,
      suggested: suggested.has(i.id),
      rationale: suggested.get(i.id),
      avatarUrl: pickAvatar(i.socialAccounts),
    };
  });

  const latestReach = (snaps: { reach: number | null; measuredAt: Date }[]) =>
    [...snaps].sort((a, b) => b.measuredAt.getTime() - a.measuredAt.getTime()).find((s) => s.reach != null)?.reach ?? 0;

  const published = deliverables.filter((d) => d.publishedAt && d.status !== "IPTAL");

  const general = (
    <div className="flex flex-col gap-6">
      <div className="grid-12">
        <Card interactive={false} className="flex flex-col gap-6 md:col-span-8">
          <CardTitle>Kampanya skoru</CardTitle>
          <KpiBreakdown score={score} />
        </Card>
        <Card interactive={false} className="flex flex-col gap-4 md:col-span-4">
          <CardTitle>Özet</CardTitle>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-fg-passive">Marka</dt>
            <dd>
              <Link href={`/admin/markalar/${campaign.brand.id}`} className="hover:underline">
                {campaign.brand.name}
              </Link>
            </dd>
            <dt className="text-fg-passive">Tarih</dt>
            <dd>
              {fmtDate(campaign.startsAt)} – {fmtDate(campaign.endsAt)}
            </dd>
            <dt className="text-fg-passive">Bütçe</dt>
            <dd className="tabular-nums">{formatKurus(campaign.budgetKurus)}</dd>
            <dt className="text-fg-passive">Marka bedeli</dt>
            <dd className="tabular-nums">{formatKurus(campaign.brandTotalFeeKurus)}</dd>
            <dt className="text-fg-passive">UTM</dt>
            <dd className="font-mono text-[13px]">{campaign.slug}</dd>
            <dt className="text-fg-passive">Kapanış</dt>
            <dd>{campaign.closedAt ? fmtDateTime(campaign.closedAt) : "—"}</dd>
            <dt className="text-fg-passive">Marka ödemesi</dt>
            <dd>{campaign.brandPaymentReceivedAt ? fmtDate(campaign.brandPaymentReceivedAt) : "Bekleniyor"}</dd>
          </dl>
          <div className="flex flex-col gap-3 border-t border-border pt-4">
            {campaign.status === "AKTIF" ? <CloseCampaignForm campaignId={campaign.id} /> : null}
            {!campaign.brandPaymentReceivedAt && campaign.status !== "IPTAL" ? <BrandPaymentForm campaignId={campaign.id} /> : null}
          </div>
        </Card>
      </div>
      <Card interactive={false} className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <CardTitle>Influencerlar</CardTitle>
          {editable ? (
            <ButtonLink href={`/admin/kampanyalar/${campaign.id}?sekme=influencerlar`} variant="secondary" size="sm">
              <UserPlusIcon size={14} /> Ekle
            </ButtonLink>
          ) : null}
        </div>
        <DataTable
          caption="Kampanya influencerları"
          emptyText="Henüz atama yok."
          columns={[
            { key: "name", header: "Influencer", sortable: true },
            { key: "contract", header: "Sözleşme", sortable: true },
            { key: "fee", header: "Bedel", align: "right", sortable: true },
            { key: "commission", header: "Komisyon", align: "right", sortable: true },
            { key: "deliverables", header: "İş", align: "right", sortable: true },
            { key: "reach", header: "Erişim", align: "right", sortable: true },
            { key: "coupon", header: "Kupon" },
          ]}
          rows={campaign.assignments.map((a) => {
            const reach = a.deliverables.reduce((s, d) => s + latestReach(d.metricSnapshots), 0);
            return {
              id: a.id,
              cells: {
                name: { display: a.influencer.name, sort: a.influencer.name },
                contract: { display: <StatusDot tone={contractTone(a.contractStatus)}>{contractUiLabels[a.contractStatus]}</StatusDot>, sort: a.contractStatus },
                fee: { display: formatKurus(a.feeKurus), sort: a.feeKurus },
                commission: { display: formatKurus(a.commissionKurus), sort: a.commissionKurus },
                deliverables: { display: a.deliverables.filter((d) => d.status !== "IPTAL").length, sort: a.deliverables.length },
                reach: { display: num.format(reach), sort: reach },
                coupon: a.couponCode ?? "—",
              },
              label: a.influencer.name,
              actions: [
                { label: "Influencer profili", href: `/admin/influencerlar/${a.influencer.id}`, icon: "open" },
                { label: "Profili düzenle", href: `/admin/influencerlar/${a.influencer.id}/duzenle`, icon: "edit" },
              ],
            };
          })}
        />
      </Card>
      <Card interactive={false} className="flex flex-col gap-4">
        <CardTitle>İçerik galerisi</CardTitle>
        {published.length === 0 ? (
          <p className="text-sm text-fg-passive">Henüz yayınlanmış içerik yok.</p>
        ) : (
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {published.map((d) => {
              const thumb = d.assets.find((a) => (a.kind === "HAM_DOSYA" || a.kind === "TASLAK") && a.mime.startsWith("image/"));
              return (
                <li key={d.id} className="overflow-hidden rounded-[8px] border border-border bg-surface transition-standard hover:border-border-strong">
                  <Link href={`/admin/teslimler/${d.id}`}>
                    <AssetThumb assetId={thumb?.id} platform={d.platform} alt={`${d.influencer.name} ${contentTypeLabels[d.contentType]}`} />
                  </Link>
                  <div className="flex flex-col gap-1 p-3 text-[12px]">
                    <span className="truncate text-fg">{d.influencer.name}</span>
                    <span className="flex items-center gap-1 text-fg-passive">
                      <PlatformIcon platform={d.platform} size={12} /> {contentTypeLabels[d.contentType]}
                    </span>
                    {d.postUrl ? (
                      <a href={d.postUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-fg-muted hover:text-fg">
                        Paylaşımı aç <ExternalIcon size={12} />
                        <span className="sr-only">(yeni sekmede açılır)</span>
                      </a>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );

  const delivery = (
    <div className="flex flex-col gap-6">
      {campaign.assignments.length === 0 ? (
        <EmptyState message="Kampanyaya henüz influencer atanmadı. Influencerlar sekmesinden ekleyin." />
      ) : (
        campaign.assignments.map((a) => {
          const tz = a.influencer.audienceTimezone;
          const tzLabel = tz === AGENCY_TZ ? "İstanbul" : `${tz}, ${tzShort(tz)}`;
          return (
            <Card key={a.id} interactive={false} className="flex flex-col gap-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex flex-col gap-1">
                  <h3 className="text-section">{a.influencer.name}</h3>
                  <p className="text-[13px] text-fg-muted">
                    {formatKurus(a.feeKurus)} bedel · {formatKurus(a.commissionKurus)} komisyon
                    {a.couponCode ? ` · kupon ${a.couponCode}` : ""}
                    {a.exclusivityDays ? ` · ${a.exclusivityDays} gün münhasırlık${a.exclusivityCategory ? ` (${a.exclusivityCategory})` : ""}` : ""}
                  </p>
                  {a.conflictOverrideReason ? <p className="text-[13px] text-fg-muted">Çakışma ezme gerekçesi: {a.conflictOverrideReason}</p> : null}
                </div>
                <div className="flex flex-col items-end gap-2">
                  <StatusDot tone={contractTone(a.contractStatus)}>{contractUiLabels[a.contractStatus]}</StatusDot>
                  {a.contractStatus === "TEKLIF" ? <ContractDecision assignmentId={a.id} /> : null}
                </div>
              </div>
              {a.deliverables.length === 0 ? (
                <p className="text-sm text-fg-passive">Bu atamada planlanmış iş yok.</p>
              ) : (
                <ul className="flex flex-col divide-y divide-border">
                  {a.deliverables.map((d) => (
                    <li key={d.id}>
                      <Link
                        href={`/admin/teslimler/${d.id}`}
                        className="-mx-2 flex flex-wrap items-center justify-between gap-3 rounded-[8px] px-2 py-3 transition-standard hover:bg-surface-hover"
                      >
                        <span className="flex items-center gap-2 text-sm">
                          <PlatformIcon platform={d.platform} size={16} title={platformLabels[d.platform]} />
                          {contentTypeLabels[d.contentType]}
                        </span>
                        <span className="text-[13px] tabular-nums text-fg-muted">
                          {fmtDateTime(d.plannedAt, tz)}
                          {tz !== AGENCY_TZ ? ` (${tzShort(tz)}) · İstanbul ${fmtDateTime(d.plannedAt)}` : ""}
                        </span>
                        <StatusDot tone={deliverableTone(d.status, { overdue: isOverdue(d, now), violation: d.contractViolation })}>
                          {deliverableStatusLabels[d.status]}
                          {isOverdue(d, now) ? " · gecikti" : ""}
                        </StatusDot>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              {a.contractStatus !== "RED" && editable ? (
                <details className="rounded-[8px] border border-border">
                  <summary className="cursor-pointer px-4 py-3 text-sm text-fg-muted hover:text-fg">Yeni iş planla</summary>
                  <div className="border-t border-border p-4">
                    <DeliverableForm
                      assignmentId={a.id}
                      tz={tz}
                      tzLabel={tzLabel}
                      defaults={{
                        hashtags: brief?.hashtags ?? [],
                        mentions: brief?.mentions ?? [],
                        disclosureRequired: brief?.disclosureRequired ?? true,
                        advertiser: campaign.brand.name,
                      }}
                    />
                  </div>
                </details>
              ) : null}
            </Card>
          );
        })
      )}
      {live.some((a) => a.couponCode) ? (
        <Card interactive={false} className="flex flex-col gap-4">
          <CardTitle>Marka verisi (kupon koduyla)</CardTitle>
          <p className="text-[13px] text-fg-muted">Kupon tıklama/satış/ciro, o atamanın iptal olmayan işlerine eşit bölünür. Kaynak: marka verisi (yüksek güven).</p>
          <BrandDataForm campaignId={campaign.id} />
        </Card>
      ) : null}
    </div>
  );

  const files = (
    <div className="grid-12">
      <Card interactive={false} className="flex flex-col gap-4 md:col-span-7">
        <CardTitle>Ajans dosyaları</CardTitle>
        <AssetList
          assets={campaign.assets.map((a) => ({ ...a, uploadedByName: a.uploadedBy.name }))}
          emptyText="Kampanyaya bağlı dosya yok."
        />
        <CardTitle className="pt-4">İş dosyaları</CardTitle>
        <AssetList
          editableRights
          assets={campaign.assignments.flatMap((a) =>
            a.deliverables.flatMap((d) => d.assets.map((as) => ({ ...as, uploadedByName: `${as.uploadedBy.name} · ${a.influencer.name}` }))),
          )}
          emptyText="İşlere yüklenmiş dosya yok."
        />
      </Card>
      <Card interactive={false} className="flex flex-col gap-4 md:col-span-5">
        <CardTitle>Influencer&apos;lara dosya gönder</CardTitle>
        <FileUploader target={{ type: "campaign", id: campaign.id }} kinds={AGENCY_KINDS.map((k) => ({ value: k, label: assetKindLabels[k] }))} />
      </Card>
    </div>
  );

  const briefTab = (
    <Card interactive={false} className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <CardTitle>Brief</CardTitle>
        <ButtonLink href={`/admin/kampanyalar/${campaign.id}/brief`} variant="secondary" size="sm">
          {brief ? "Yeni sürüm" : "Brief yaz"}
        </ButtonLink>
      </div>
      {brief ? <BriefPanel brief={brief} /> : <p className="text-sm text-fg-passive">Henüz brief yok.</p>}
    </Card>
  );

  const people = (
    <div className="flex flex-col gap-6">
      {editable ? (
        <>
          <Card interactive={false} className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-col gap-1">
                <CardTitle>Influencer ekle</CardTitle>
                <p className="text-[13px] text-fg-muted">
                  Filtreleyin, işaretleyin, bedeli girin. Eklenen herkese sözleşme teklifi gider; rakip markayla çakışanlar otomatik engellenir.
                </p>
              </div>
              <RecommendButton campaignId={campaign.id} />
            </div>
            <InfluencerPicker campaignId={campaign.id} influencers={pickerInfluencers} />
          </Card>
          <details className="rounded-[8px] border border-border">
            <summary className="cursor-pointer px-4 py-3 text-sm text-fg-muted hover:text-fg">
              Tekli atama (kupon, münhasırlık veya çakışma gerekçesiyle)
            </summary>
            <div className="border-t border-border p-4">
              <AssignmentForm campaignId={campaign.id} influencers={influencers.map((i) => ({ id: i.id, name: i.name, category: i.category }))} />
            </div>
          </details>
        </>
      ) : (
        <EmptyState message="Kapanmış veya iptal edilmiş kampanyaya influencer eklenemez." />
      )}
    </div>
  );
  const summaryDraft = runs.find((r) => r.checkType === "KAMPANYA_OZETI");
  const draftText = (summaryDraft?.findings as { draft?: string } | null)?.draft;
  const agent = (
    <div className="flex flex-col gap-6">
      <Card interactive={false} className="flex flex-col gap-4">
        <CardTitle>Takip agent&apos;ları</CardTitle>
        <TrackerList trackers={trackers} emptyText="Bu kampanyada takipçi yok." />
        <TrackerGallery templates={templateViews()} targets={{ CAMPAIGN: [], INFLUENCER: [], BRAND: [] }} fixedTarget={{ scope: "CAMPAIGN", id: campaign.id }} />
      </Card>
      {summaryDraft && draftText ? (
        <Card interactive={false} className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <CardTitle>Rapor özeti taslağı</CardTitle>
            <ApproveSummaryButton runId={summaryDraft.id} />
          </div>
          <p className="whitespace-pre-line text-sm text-fg-muted">{draftText}</p>
          {campaign.reportSummary ? <p className="text-[13px] text-fg-passive">Rapordaki mevcut özet bu taslakla değiştirilir.</p> : null}
        </Card>
      ) : null}
    <AgentRunList
      runs={runs.map((r) => ({ ...r, resolvedByName: r.resolvedBy?.name }))}
      emptyText="Bu kampanya için agent bulgusu yok."
    />
    </div>
  );

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title={campaign.name}
        description={
          <span className="inline-flex flex-wrap items-center gap-3">
            <StatusDot tone={campaignTone(campaign.status)}>{campaignStatusLabels[campaign.status]}</StatusDot>
            <span>{campaign.brand.name}</span>
          </span>
        }
        actions={
          <>
            {editable ? (
              <ButtonLink href={`/admin/kampanyalar/${campaign.id}?sekme=influencerlar`}>
                <UserPlusIcon size={16} /> Influencer ekle
              </ButtonLink>
            ) : null}
            <ButtonLink href={`/admin/kampanyalar/${campaign.id}/brief`} variant="secondary">
              Brief
            </ButtonLink>
            {campaign.status !== "KAPANDI" ? (
              <ButtonLink href={`/admin/kampanyalar/${campaign.id}/duzenle`} variant="secondary">
                Düzenle
              </ButtonLink>
            ) : null}
          </>
        }
      />
      <CampaignLifecycle campaignId={campaign.id} base={`/admin/kampanyalar/${campaign.id}`} />
      <Tabs
        key={sekme ?? "genel"}
        label="Kampanya bölümleri"
        defaultTab={sekme}
        tabs={[
          { id: "genel", label: "Genel", content: general },
          { id: "influencerlar", label: `Influencerlar (${live.length})`, content: people },
          { id: "teslimler", label: `Teslimler (${deliverables.length})`, content: delivery },
          { id: "dosyalar", label: "Dosyalar", content: files },
          { id: "brief", label: "Brief", content: briefTab },
          { id: "agent", label: `Agent (${runs.filter((r) => r.status === "ACIK").length + trackers.reduce((n, t) => n + t.findings.length, 0)})`, content: agent },
        ]}
      />
    </div>
  );
}
