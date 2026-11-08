import { getTT } from "@/lib/i18n/tt-server";
import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@infulancer/core/db";
import { DataTable } from "@/components/ui/data-table";
import { ButtonLink } from "@/components/ui/form";
import { PageHeader, Stagger } from "@/components/ui/layout";
import { requireActor } from "@/lib/auth-guard";

export const metadata: Metadata = { title: "Markalar" };

export default async function BrandsPage() {
  const tt = await getTT();
  await requireActor("ADMIN");
  const brands = await prisma.brand.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      category: true,
      contactName: true,
      contactEmail: true,
      competitorBrandIds: true,
      _count: { select: { campaigns: true, users: true } },
    },
  });
  return (
    <Stagger className="flex flex-col gap-8">
      <PageHeader title={tt("Markalar")} description={tt("Vergi, sözleşme ve rakip bilgileri; marka kullanıcıları.")} actions={<ButtonLink href="/admin/markalar/yeni">{tt("Yeni marka")}</ButtonLink>} />
      <DataTable
        caption={tt("Markalar")}
        emptyText={tt("Henüz marka yok.")}
        initialSort={{ key: "name", dir: "asc" }}
        columns={[
          { key: "name", header: "Marka", sortable: true },
          { key: "category", header: "Kategori", sortable: true },
          { key: "contact", header: "Yetkili" },
          { key: "competitors", header: "Rakip", align: "right", sortable: true },
          { key: "campaigns", header: "Kampanya", align: "right", sortable: true },
          { key: "users", header: "Kullanıcı", align: "right", sortable: true },
        ]}
        rows={brands.map((b) => ({
          id: b.id,
          cells: {
            name: {
              display: (
                <Link href={`/admin/markalar/${b.id}`} className="text-fg hover:underline">
                  {b.name}
                </Link>
              ),
              sort: b.name,
            },
            category: { display: b.category, sort: b.category },
            contact: (
              <span className="flex flex-col">
                <span>{b.contactName}</span>
                <span className="text-[12px] text-fg-passive">{b.contactEmail}</span>
              </span>
            ),
            competitors: { display: b.competitorBrandIds.length, sort: b.competitorBrandIds.length },
            campaigns: { display: b._count.campaigns, sort: b._count.campaigns },
            users: { display: b._count.users, sort: b._count.users },
          },
          label: b.name,
          actions: [
            { label: "Profil ve geçmiş", href: `/admin/markalar/${b.id}`, icon: "open" },
            { label: "Yeni kampanya", href: `/admin/kampanyalar/yeni?marka=${b.id}`, icon: "plus" },
            { label: "Düzenle", href: `/admin/markalar/${b.id}/duzenle`, icon: "edit" },
          ],
        }))}
      />
    </Stagger>
  );
}
