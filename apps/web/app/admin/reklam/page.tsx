import type { Metadata } from "next";
import { prisma } from "@infulancer/core/db";
import { getConfig } from "@infulancer/core/config/store";
import { objectivesFor } from "@infulancer/core/ads/drafts";
import { Card, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/layout";
import { StatusDot } from "@/components/ui/status";
import { Tabs } from "@/components/ui/tabs";
import { requireActor } from "@/lib/auth-guard";
import { DocLink } from "@/components/docs/doc-components";
import { PageGuide } from "@/components/ui/page-guide";
import { BudgetRequestForm, RunJobButton } from "@/components/forms/operations-forms";
import { AdDraftForm, BulkAdDraftForm } from "@/components/ads/ad-draft-forms";
import { AdDraftList } from "@/components/ads/ad-draft-list";
import { InfoNote } from "@/components/ui/unverified";
import { fmtDateTime } from "@/lib/time";

export const metadata: Metadata = { title: "Reklam" };

export default async function AdminAdsPage() {
  await requireActor("ADMIN");
  const [limits, quota, changes, codes, brands, assets, pendingAds] = await Promise.all([
    getConfig("meta.ads.writeLimits"),
    getConfig("meta.ads.quota"),
    prisma.adBudgetChange.findMany({ orderBy: { requestedAt: "desc" }, take: 40 }),
    prisma.partnershipAdCode.findMany({ orderBy: { createdAt: "desc" }, take: 40 }),
    prisma.brand.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.generatedAsset.findMany({ orderBy: { createdAt: "desc" }, take: 20, select: { id: true, modelKey: true, tenantId: true, createdAt: true } }),
    prisma.adDraft.count({ where: { status: "ONAY_BEKLIYOR" } }),
  ]);
  const queued = changes.filter((c) => c.status === "queued").length;
  const metaObjectives = objectivesFor("META").map((o) => ({ key: o.key, label: o.label }));
  const tiktokObjectives = objectivesFor("TIKTOK").map((o) => ({ key: o.key, label: o.label }));
  const assetOptions = assets.map((a) => ({ id: a.id, label: `${a.modelKey} · ${fmtDateTime(a.createdAt)}` }));
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Reklam"
        description="Meta ve TikTok reklam taslakları, onay akışı, bütçe optimizasyonu ve Partnership Ads kodları."
        actions={<RunJobButton job="ads-budget-batch" label="Bekleyenleri şimdi uygula" />}
      />

      <Card interactive={false} className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle>Reklam kampanyaları</CardTitle>
          {pendingAds > 0 ? <StatusDot tone="passive">{pendingAds} taslak onay bekliyor</StatusDot> : null}
        </div>
        <InfoNote>
          Reklam taslakları onay akışında ilerler (Taslak → Onay bekliyor → Onaylandı). Onay <strong>gerçek harcama başlatmaz</strong>; canlı Meta/TikTok yayını, reklam hesabı anahtarları eklendiğinde ayrı adımda açılacaktır.
        </InfoNote>
        <Tabs
          label="Reklam oluşturma"
          tabs={[
            { id: "tek", label: "Tek reklam", content: <AdDraftForm brands={brands} metaObjectives={metaObjectives} tiktokObjectives={tiktokObjectives} assets={assetOptions} isAdmin /> },
            { id: "toplu", label: "Toplu kampanya", content: <BulkAdDraftForm brands={brands} metaObjectives={metaObjectives} tiktokObjectives={tiktokObjectives} assets={assetOptions} isAdmin /> },
          ]}
        />
        <AdDraftList isAdmin />
      </Card>

      <PageGuide
        what="Influencer içeriklerini reklama dönüştürme ve reklam bütçelerini yönetme alanı. Bütçe değişikliklerini buradan istersiniz; sistem Meta’nın yazma limitlerine (saatte 4 bütçe değişikliği, aynı nesneye 30 saniyede bir düzenleme) uyarak uygular."
        why="Limit aşılırsa Meta hesabı 1 saat bloklar. Bu yüzden fazla istekler reddedilmez, sıradaki uygun saate ötelenir ve aşağıdaki kuyrukta görünür."
        steps={[
          { label: "Meta Marketing API bağlantısı (Full Access) — ajans tarafında kurulum", done: false, hint: "Şu an demo mod: istekler kaydedilir, Meta’ya gönderilmez" },
          { label: "Bütçe değişikliği isteyin", done: changes.length > 0, hint: `${changes.length} istek · ${queued} ötelenmiş` },
          { label: "Partnership Ads için creator kendi Instagram hesabıyla kod üretir", done: codes.length > 0, hint: "Kod creator hesabına bağlıdır; marka kendi başına üretemez" },
        ]}
      />
      <Card interactive={false} className="flex flex-col gap-3">
        <CardTitle>Bütçe değişikliği iste</CardTitle>
        <BudgetRequestForm brands={brands} />
      </Card>

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4" aria-label="Yazma limitleri">
        {[
          ["Mutation", `${limits.mutationQps} istek/sn`],
          ["Aynı nesne", `${limits.sameObjectEditSeconds} sn'de 1`],
          ["Ad set bütçesi", `saatte ${limits.adSetBudgetChangesPerHour}`],
          ["Harcama limiti", `günde ${limits.spendCapChangesPerDay}`],
        ].map(([l, v]) => (
          <Card key={l} interactive={false} className="flex flex-col gap-1">
            <span className="text-label text-fg-muted">{l}</span>
            <span className="text-[20px] font-semibold tabular-nums">{v}</span>
          </Card>
        ))}
      </section>
      <DocLink slug="meta-marketing-api" />
      <p className="text-[12px] text-fg-passive">Full Access eşiği: son {quota.fullAccessThreshold.days} günde {quota.fullAccessThreshold.calls} çağrı, hata oranı %{quota.fullAccessThreshold.maxErrorRate * 100} altı.</p>

      <Card interactive={false} className="flex flex-col gap-3">
        <CardTitle>Bütçe değişiklik kuyruğu</CardTitle>
        {changes.length === 0 ? (
          <p className="text-sm text-fg-passive">Kayıt yok.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border text-sm">
            {changes.map((c) => (
              <li key={c.id} className="flex flex-wrap justify-between gap-2 py-2">
                <span>
                  Ad set {c.adSetId} → {c.newBudgetMinor}
                </span>
                <StatusDot tone={c.status === "applied" ? "active" : "muted"}>
                  {c.status === "queued" ? `Ötelendi: ${fmtDateTime(c.scheduledFor)}` : c.status}
                </StatusDot>
                {c.reason ? <span className="w-full text-[13px] text-fg-muted">{c.reason}</span> : null}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card interactive={false} className="flex flex-col gap-3">
        <CardTitle>Partnership Ads</CardTitle>
        <DocLink slug="meta-partnership-ads" />
        <ul className="flex flex-col divide-y divide-border text-sm">
          {codes.map((c) => (
            <li key={c.id} className="flex justify-between py-2">
              <span>Medya {c.igMediaId}</span>
              <StatusDot tone={c.state === "revoked" ? "critical" : "active"}>{c.state}</StatusDot>
            </li>
          ))}
        </ul>
      </Card>

      <Card interactive={false} className="flex flex-col gap-2">
        <CardTitle>TikTok</CardTitle>
        <DocLink slug="tiktok-content-api" />
        <DocLink slug="tiktok-marketing-api" />
      </Card>
    </div>
  );
}
