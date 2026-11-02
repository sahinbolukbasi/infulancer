import type { Metadata } from "next";
import { prisma } from "@infulancer/core/db";
import { CampaignForm } from "@/components/forms/campaign-form";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/layout";
import { requireActor } from "@/lib/auth-guard";

export const metadata: Metadata = { title: "Yeni kampanya" };

export default async function NewCampaignPage() {
  await requireActor("ADMIN");
  const brands = await prisma.brand.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } });
  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Yeni kampanya" description="Hedefler ağırlıklı kampanya skorunu belirler." />
      {brands.length === 0 ? (
        <EmptyState message="Kampanya açmak için önce bir marka ekleyin." action={{ label: "Marka ekle", href: "/admin/markalar/yeni" }} />
      ) : (
        <Card interactive={false}>
          <CampaignForm brands={brands} />
        </Card>
      )}
    </div>
  );
}
