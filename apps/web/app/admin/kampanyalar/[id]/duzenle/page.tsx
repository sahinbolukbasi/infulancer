import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@infulancer/core/db";
import { parseTargets } from "@infulancer/core/domain/campaign-score";
import { CampaignForm } from "@/components/forms/campaign-form";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/layout";
import { requireActor } from "@/lib/auth-guard";
import { AGENCY_TZ, localDay } from "@/lib/time";

export const metadata: Metadata = { title: "Kampanya düzenle" };

const tl = (kurus: number) => (kurus / 100).toFixed(2);

export default async function EditCampaignPage({ params }: { params: Promise<{ id: string }> }) {
  await requireActor("ADMIN");
  const { id } = await params;
  const [c, brands] = await Promise.all([
    prisma.campaign.findUnique({ where: { id } }),
    prisma.brand.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  if (!c) notFound();
  return (
    <div className="flex flex-col gap-8">
      <PageHeader title={`${c.name} · düzenle`} />
      <Card interactive={false}>
        <CampaignForm
          brands={brands}
          campaign={{
            id: c.id,
            brandId: c.brandId,
            name: c.name,
            slug: c.slug,
            budget: tl(Number(c.budgetKurus)),
            brandTotalFee: tl(Number(c.brandTotalFeeKurus)),
            startsAt: localDay(c.startsAt, AGENCY_TZ),
            endsAt: localDay(c.endsAt, AGENCY_TZ),
            status: c.status,
            targets: parseTargets(c.targets),
          }}
        />
      </Card>
    </div>
  );
}
