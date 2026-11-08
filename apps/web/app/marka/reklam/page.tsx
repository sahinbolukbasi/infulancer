import { getTT } from "@/lib/i18n/tt-server";
import type { Metadata } from "next";
import { prisma } from "@infulancer/core/db";
import { objectivesFor } from "@infulancer/core/ads/drafts";
import { AdDraftForm, BulkAdDraftForm } from "@/components/ads/ad-draft-forms";
import { AdDraftList } from "@/components/ads/ad-draft-list";
import { Card, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/layout";
import { Tabs } from "@/components/ui/tabs";
import { InfoNote } from "@/components/ui/unverified";
import { requireActor } from "@/lib/auth-guard";
import { fmtDateTime } from "@/lib/time";

export const metadata: Metadata = { title: "Reklam" };
export const dynamic = "force-dynamic";

/** Marka: kendi Meta/TikTok reklam taslaklarını oluşturur, onaya gönderir ve durumunu izler. */
export default async function BrandAdsPage({ searchParams }: { searchParams: Promise<{ asset?: string }> }) {
  const tt = await getTT();
  const actor = await requireActor("BRAND");
  const { asset: defaultAssetId } = await searchParams;
  const t = actor.brandId!;
  const [assets, tenant] = await Promise.all([
    prisma.generatedAsset.findMany({ where: { tenantId: t }, orderBy: { createdAt: "desc" }, take: 20, select: { id: true, modelKey: true, createdAt: true } }),
    prisma.tenantSettings.findUnique({ where: { tenantId: t }, select: { mode: true } }),
  ]);
  const metaObjectives = objectivesFor("META").map((o) => ({ key: o.key, label: o.label }));
  const tiktokObjectives = objectivesFor("TIKTOK").map((o) => ({ key: o.key, label: o.label }));
  const assetOptions = assets.map((a) => ({ id: a.id, label: `${a.modelKey} · ${fmtDateTime(a.createdAt)}` }));
  const live = tenant?.mode === "production";
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={tt("Reklam")} description={tt("Meta ve TikTok için reklam taslakları oluşturun, onaya gönderin; ajans onayladıktan sonra yayına hazır olur.")} />
      <InfoNote>{tt("Reklam taslakları ajans onayından geçer. Onay")}{" "}<strong>{tt("gerçek harcama başlatmaz")}</strong>{tt("; canlı Meta/TikTok yayını, reklam hesabı bağlantısı (anahtarlar) tamamlandığında açılır.")}{!live ? tt(" Hesabınız şu an deneme modunda.") : ""}
      </InfoNote>
      <Card interactive={false} className="flex flex-col gap-4">
        <CardTitle>{tt("Yeni reklam")}</CardTitle>
        <Tabs
          label={tt("Reklam oluşturma")}
          tabs={[
            { id: "tek", label: "Tek reklam", content: <AdDraftForm brands={[]} metaObjectives={metaObjectives} tiktokObjectives={tiktokObjectives} assets={assetOptions} isAdmin={false} defaultAssetId={defaultAssetId} /> },
            { id: "toplu", label: "Toplu kampanya", content: <BulkAdDraftForm brands={[]} metaObjectives={metaObjectives} tiktokObjectives={tiktokObjectives} assets={assetOptions} isAdmin={false} defaultAssetId={defaultAssetId} /> },
          ]}
        />
      </Card>
      <Card interactive={false} className="flex flex-col gap-3">
        <CardTitle>{tt("Reklamlarım")}</CardTitle>
        <AdDraftList tenantId={t} isAdmin={false} />
      </Card>
    </div>
  );
}
