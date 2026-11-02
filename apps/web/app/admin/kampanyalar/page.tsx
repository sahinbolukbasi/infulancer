import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@infulancer/core/db";
import { campaignStatusLabels, formatKurus } from "@infulancer/core/domain/labels";
import { DataTable } from "@/components/ui/data-table";
import { ButtonLink } from "@/components/ui/form";
import { PageHeader, Stagger } from "@/components/ui/layout";
import { StatusDot } from "@/components/ui/status";
import { requireActor } from "@/lib/auth-guard";
import { pct } from "@/lib/format";
import { loadCampaignScores } from "@/lib/queries";
import { campaignTone } from "@/lib/status-tone";
import { fmtDate } from "@/lib/time";

export const metadata: Metadata = { title: "Kampanyalar" };

const statusRank = { AKTIF: 0, TASLAK: 1, KAPANDI: 2, IPTAL: 3 } as const;

export default async function CampaignsPage() {
  await requireActor("ADMIN");
  const campaigns = await prisma.campaign.findMany({
    orderBy: { startsAt: "desc" },
    select: {
      id: true,
      name: true,
      status: true,
      startsAt: true,
      endsAt: true,
      budgetKurus: true,
      brand: { select: { name: true } },
      _count: { select: { assignments: { where: { contractStatus: { not: "RED" } } } } },
    },
  });
  const scores = await loadCampaignScores(campaigns.map((c) => c.id));
  return (
    <Stagger className="flex flex-col gap-8">
      <PageHeader title="Kampanyalar" description="Durum, skor ve tarih aralığı." actions={<ButtonLink href="/admin/kampanyalar/yeni">Yeni kampanya</ButtonLink>} />
      <DataTable
        caption="Kampanyalar"
        emptyText="Henüz kampanya yok."
        initialSort={{ key: "status", dir: "asc" }}
        columns={[
          { key: "name", header: "Kampanya", sortable: true },
          { key: "brand", header: "Marka", sortable: true },
          { key: "status", header: "Durum", sortable: true },
          { key: "score", header: "Skor", align: "right", sortable: true },
          { key: "dates", header: "Tarih", sortable: true },
          { key: "influencers", header: "Influencer", align: "right", sortable: true },
          { key: "budget", header: "Bütçe", align: "right", sortable: true },
        ]}
        rows={campaigns.map((c) => {
          const score = scores.get(c.id)?.score ?? null;
          return {
            id: c.id,
            cells: {
              name: {
                display: (
                  <Link href={`/admin/kampanyalar/${c.id}`} className="text-fg hover:underline">
                    {c.name}
                  </Link>
                ),
                sort: c.name,
              },
              brand: { display: c.brand.name, sort: c.brand.name },
              status: { display: <StatusDot tone={campaignTone(c.status)}>{campaignStatusLabels[c.status]}</StatusDot>, sort: statusRank[c.status] },
              score: { display: score == null ? "—" : pct.format(score), sort: score },
              dates: { display: `${fmtDate(c.startsAt)} – ${fmtDate(c.endsAt)}`, sort: c.startsAt.getTime() },
              influencers: { display: c._count.assignments, sort: c._count.assignments },
              budget: { display: formatKurus(c.budgetKurus), sort: c.budgetKurus },
            },
            actions: [
              { label: "Aç", href: `/admin/kampanyalar/${c.id}` },
              { label: "Düzenle", href: `/admin/kampanyalar/${c.id}/duzenle` },
              { label: "Brief", href: `/admin/kampanyalar/${c.id}/brief` },
            ],
          };
        })}
      />
    </Stagger>
  );
}
