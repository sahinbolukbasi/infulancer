import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@infulancer/core/db";
import { taxStatusLabels } from "@infulancer/core/domain/labels";
import { PlatformIcon } from "@/components/platform-icon";
import { DataTable } from "@/components/ui/data-table";
import { ButtonLink } from "@/components/ui/form";
import { PageHeader, Stagger } from "@/components/ui/layout";
import { requireActor } from "@/lib/auth-guard";
import { num } from "@/lib/format";

export const metadata: Metadata = { title: "Influencerlar" };

export default async function InfluencersPage() {
  await requireActor("ADMIN");
  const influencers = await prisma.influencer.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      category: true,
      taxStatus: true,
      canIssueInvoice: true,
      audienceTimezone: true,
      user: { select: { email: true } },
      socialAccounts: { select: { platform: true, handle: true, followers: true } },
      _count: { select: { assignments: true } },
    },
  });
  return (
    <Stagger className="flex flex-col gap-8">
      <PageHeader
        title="Influencerlar"
        description="Hesaplar, ödeme ve vergi bilgileri."
        actions={<ButtonLink href="/admin/influencerlar/yeni">Yeni influencer</ButtonLink>}
      />
      <DataTable
        caption="Influencerlar"
        emptyText="Henüz influencer yok."
        initialSort={{ key: "name", dir: "asc" }}
        columns={[
          { key: "name", header: "Influencer", sortable: true },
          { key: "category", header: "Kategori", sortable: true },
          { key: "accounts", header: "Hesaplar" },
          { key: "followers", header: "Toplam takipçi", align: "right", sortable: true },
          { key: "tax", header: "Vergi durumu", sortable: true },
          { key: "jobs", header: "Atama", align: "right", sortable: true },
        ]}
        rows={influencers.map((i) => {
          const followers = i.socialAccounts.reduce((s, a) => s + a.followers, 0);
          return {
            id: i.id,
            cells: {
              name: {
                display: (
                  <Link href={`/admin/influencerlar/${i.id}/duzenle`} className="flex flex-col text-fg hover:underline">
                    {i.name}
                    <span className="text-[12px] text-fg-passive">{i.user?.email ?? "Giriş hesabı yok"}</span>
                  </Link>
                ),
                sort: i.name,
              },
              category: { display: i.category, sort: i.category },
              accounts: (
                <span className="flex flex-wrap gap-3">
                  {i.socialAccounts.map((a) => (
                    <span key={a.platform} className="inline-flex items-center gap-1 text-fg-muted">
                      <PlatformIcon platform={a.platform} size={14} title={a.platform} />
                      {a.handle}
                    </span>
                  ))}
                </span>
              ),
              followers: { display: num.format(followers), sort: followers },
              tax: {
                display: (
                  <span className="flex flex-col">
                    {taxStatusLabels[i.taxStatus]}
                    {!i.canIssueInvoice ? <span className="text-[12px] text-fg-passive">Fatura kesemiyor</span> : null}
                  </span>
                ),
                sort: i.taxStatus,
              },
              jobs: { display: i._count.assignments, sort: i._count.assignments },
            },
            actions: [{ label: "Düzenle", href: `/admin/influencerlar/${i.id}/duzenle` }],
          };
        })}
      />
    </Stagger>
  );
}
