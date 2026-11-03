import type { Metadata } from "next";
import { prisma } from "@infulancer/core/db";
import { getConfig } from "@infulancer/core/config/store";
import { partnershipNotes } from "@infulancer/core/ads/partnership";
import { tiktokDmNotice, unauditedPublishingNotice } from "@infulancer/core/tiktok/index";
import { UNVERIFIED_FACTS } from "@infulancer/core/unverified";
import { Card, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/layout";
import { StatusDot } from "@/components/ui/status";
import { InfoNote, UnverifiedBadge } from "@/components/ui/unverified";
import { requireActor } from "@/lib/auth-guard";
import { PageGuide } from "@/components/ui/page-guide";
import { BudgetRequestForm, RunJobButton } from "@/components/forms/operations-forms";
import { fmtDateTime } from "@/lib/time";

export const metadata: Metadata = { title: "Reklam" };

export default async function AdminAdsPage() {
  await requireActor("ADMIN");
  const [limits, quota, changes, codes, brands] = await Promise.all([
    getConfig("meta.ads.writeLimits"),
    getConfig("meta.ads.quota"),
    prisma.adBudgetChange.findMany({ orderBy: { requestedAt: "desc" }, take: 40 }),
    prisma.partnershipAdCode.findMany({ orderBy: { createdAt: "desc" }, take: 40 }),
    prisma.brand.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  const queued = changes.filter((c) => c.status === "queued").length;
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Reklam"
        description="Meta Marketing API yazma limitleri, saatlik bütçe optimizasyonu, Partnership Ads kodları ve TikTok yayın kısıtları."
        actions={<RunJobButton job="ads-budget-batch" label="Bekleyenleri şimdi uygula" />}
      />
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

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card interactive={false} className="flex flex-col gap-3">
          <CardTitle>Yazma limitleri</CardTitle>
          <ul className="flex flex-col gap-1 text-sm text-fg-muted">
            <li>Mutation: {limits.mutationQps} istek/sn (app + ad account)</li>
            <li>Aynı nesne: {limits.sameObjectEditSeconds} sn’de bir düzenleme (hata 4841018)</li>
            <li>Ad set bütçesi: saatte {limits.adSetBudgetChangesPerHour} değişiklik; fazlası sonraki saate ötelenir</li>
            <li>Hesap harcama limiti: günde {limits.spendCapChangesPerDay} değişiklik</li>
          </ul>
          <p className="text-[13px] text-fg-muted">Bütçe motoru saatlik batch çalışır; dakikalık otomatik müdahale yapılmaz.</p>
        </Card>
        <Card interactive={false} className="flex flex-col gap-3">
          <CardTitle>Erişim seviyesi</CardTitle>
          <p className="text-sm text-fg-muted">
            Full Access için son {quota.fullAccessThreshold.days} günde {quota.fullAccessThreshold.calls} çağrı ve son {quota.fullAccessThreshold.window} çağrıda hata oranı %
            {quota.fullAccessThreshold.maxErrorRate * 100} altı gerekir. Development seviyesi (saatte {quota.development.adsManagementBase} + 40 × aktif reklam) yalnız pilot içindir;
            ödeme yapan müşteri öncesi Full Access alınmalıdır.
          </p>
        </Card>
      </section>

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
        <p className="text-sm text-fg-muted">
          Kod creator’ın kendi Instagram oturumuyla (instagram_branded_content_creator) üretilir; markanın erişim belirteciyle üretilemez. Creator kodu istediği an iptal edebilir — kod
          lansmandan hemen önce yeniden doğrulanır.
        </p>
        <ul className="flex list-disc flex-col gap-1 pl-5 text-[13px] text-fg-muted">
          {partnershipNotes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
        <ul className="flex flex-col divide-y divide-border text-sm">
          {codes.map((c) => (
            <li key={c.id} className="flex justify-between py-2">
              <span>Medya {c.igMediaId}</span>
              <StatusDot tone={c.state === "revoked" ? "critical" : "active"}>{c.state}</StatusDot>
            </li>
          ))}
        </ul>
      </Card>

      <Card interactive={false} className="flex flex-col gap-3">
        <CardTitle>TikTok</CardTitle>
        <InfoNote>{unauditedPublishingNotice}</InfoNote>
        <InfoNote>{tiktokDmNotice}</InfoNote>
        <p className="text-[13px] text-fg-muted">
          {UNVERIFIED_FACTS.tiktokRateLimits} <UnverifiedBadge />
        </p>
        <p className="text-[13px] text-fg-muted">
          İzlenme süresi, tamamlanma oranı ve takipçi demografisi TikTok public API’sinde yok; creator’ın yüklediği ekran görüntüsü veya media kit ile toplanır. TikTok One / Creator
          Marketplace API’ye bağımlı özellik yoktur.
        </p>
      </Card>
    </div>
  );
}
