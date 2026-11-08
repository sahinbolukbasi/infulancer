import type { Metadata } from "next";
import { prisma } from "@infulancer/core/db";
import { CampaignWizardPage } from "@/components/campaign/wizard/wizard-page";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/layout";
import { requireActor } from "@/lib/auth-guard";
export const metadata: Metadata = { title: "Yeni kampanya" };
export default async function NewCampaignPage({ searchParams }: { searchParams: Promise<{ marka?: string }> }) {
  const { marka } = await searchParams;
  const actor = await requireActor("ADMIN");
  const brands = await prisma.brand.findMany({ select: { id: true } });
  if (brands.length === 0) {
    return (
      <div className="flex flex-col gap-8">
        <PageHeader title="Yeni kampanya" />
        <EmptyState message="Kampanya açmak için önce bir marka ekleyin." action={{ label: "Marka ekle", href: "/admin/markalar/yeni" }} />
      </div>
    );
  }
  return <CampaignWizardPage actor={actor} campaignId={null} defaultBrandId={brands.some((b) => b.id === marka) ? marka : undefined} />;
}
