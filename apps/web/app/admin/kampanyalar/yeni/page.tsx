import type { Metadata } from "next";
import { prisma } from "@infulancer/core/db";
import { CampaignForm } from "@/components/forms/campaign-form";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/layout";
import { requireActor } from "@/lib/auth-guard";

export const metadata: Metadata = { title: "Yeni kampanya" };

export default async function NewCampaignPage({ searchParams }: { searchParams: Promise<{ marka?: string }> }) {
  const { marka } = await searchParams;
  await requireActor("ADMIN");
  const brands = await prisma.brand.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } });
  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Yeni kampanya" description="1/6 · Kampanya bilgileri ve hedefler. Kaydettikten sonra kurulum sihirbazı influencer, içerik planı (story kareleri dahil), brief ve yayın kontrolü adımlarıyla devam eder." />
      {brands.length === 0 ? (
        <EmptyState message="Kampanya açmak için önce bir marka ekleyin." action={{ label: "Marka ekle", href: "/admin/markalar/yeni" }} />
      ) : (
        <Card interactive={false}>
          <CampaignForm brands={brands} defaultBrandId={brands.some((b) => b.id === marka) ? marka : undefined} />
        </Card>
      )}
    </div>
  );
}
