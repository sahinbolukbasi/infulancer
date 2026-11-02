import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@infulancer/core/db";
import { campaignStatusLabels } from "@infulancer/core/domain/labels";
import { BrandForm, BrandUserForm } from "@/components/forms/brand-forms";
import { Card, CardTitle } from "@/components/ui/card";
import { PageHeader, Stagger } from "@/components/ui/layout";
import { StatusDot } from "@/components/ui/status";
import { requireActor } from "@/lib/auth-guard";
import { campaignTone } from "@/lib/status-tone";
import { AGENCY_TZ, fmtDate, localDay } from "@/lib/time";

export const metadata: Metadata = { title: "Marka" };

export default async function BrandDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireActor("ADMIN");
  const { id } = await params;
  const brand = await prisma.brand.findUnique({
    where: { id },
    include: {
      users: { select: { id: true, name: true, email: true, createdAt: true }, orderBy: { createdAt: "asc" } },
      campaigns: { select: { id: true, name: true, status: true, startsAt: true, endsAt: true }, orderBy: { startsAt: "desc" } },
    },
  });
  if (!brand) notFound();
  const others = await prisma.brand.findMany({ where: { id: { not: id } }, orderBy: { name: "asc" }, select: { id: true, name: true, category: true } });

  return (
    <Stagger className="flex flex-col gap-8">
      <PageHeader title={brand.name} description={`${brand.category} · VKN ${brand.taxNumber}`} />
      <Card interactive={false}>
        <BrandForm
          otherBrands={others}
          brand={{
            id: brand.id,
            name: brand.name,
            taxOffice: brand.taxOffice,
            taxNumber: brand.taxNumber,
            contactName: brand.contactName,
            contactEmail: brand.contactEmail,
            contactPhone: brand.contactPhone,
            contractRef: brand.contractRef,
            contractStartsAt: brand.contractStartsAt ? localDay(brand.contractStartsAt, AGENCY_TZ) : null,
            category: brand.category,
            competitorBrandIds: brand.competitorBrandIds,
          }}
        />
      </Card>
      <div className="grid-12">
        <Card interactive={false} className="flex flex-col gap-6 md:col-span-7">
          <CardTitle>Marka kullanıcıları</CardTitle>
          {brand.users.length === 0 ? (
            <p className="text-sm text-fg-passive">Henüz kullanıcı yok.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {brand.users.map((u) => (
                <li key={u.id} className="flex items-center justify-between py-2 text-sm">
                  <span>{u.name}</span>
                  <span className="text-fg-muted">{u.email}</span>
                </li>
              ))}
            </ul>
          )}
          <BrandUserForm brandId={brand.id} />
        </Card>
        <Card interactive={false} className="flex flex-col gap-4 md:col-span-5">
          <CardTitle>Kampanyalar</CardTitle>
          {brand.campaigns.length === 0 ? (
            <p className="text-sm text-fg-passive">Kampanya yok.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {brand.campaigns.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-4 py-2 text-sm">
                  <Link href={`/admin/kampanyalar/${c.id}`} className="truncate text-fg hover:underline">
                    {c.name}
                  </Link>
                  <span className="flex shrink-0 items-center gap-3">
                    <span className="text-[12px] text-fg-passive">{fmtDate(c.startsAt)}</span>
                    <StatusDot tone={campaignTone(c.status)}>{campaignStatusLabels[c.status]}</StatusDot>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </Stagger>
  );
}
