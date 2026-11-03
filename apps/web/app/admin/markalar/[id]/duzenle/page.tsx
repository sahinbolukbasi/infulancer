import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@infulancer/core/db";
import { BrandForm } from "@/components/forms/brand-forms";
import { Card } from "@/components/ui/card";
import { PageHeader, Stagger } from "@/components/ui/layout";
import { requireActor } from "@/lib/auth-guard";
import { categoryTree } from "@infulancer/core/domain/categories";
import { ButtonLink } from "@/components/ui/form";
import { AGENCY_TZ, localDay } from "@/lib/time";

export const metadata: Metadata = { title: "Marka düzenle" };

export default async function BrandDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireActor("ADMIN");
  const { id } = await params;
  const brand = await prisma.brand.findUnique({
    where: { id },
    include: {
      categories: true,
    },
  });
  if (!brand) notFound();
  const others = await prisma.brand.findMany({ where: { id: { not: id } }, orderBy: { name: "asc" }, select: { id: true, name: true, category: true } });

  return (
    <Stagger className="flex flex-col gap-8">
      <PageHeader
        title={`${brand.name} · düzenle`}
        description={`VKN ${brand.taxNumber}`}
        actions={
          <ButtonLink href={`/admin/markalar/${brand.id}`} variant="secondary">
            Profile dön
          </ButtonLink>
        }
      />
      <Card interactive={false}>
        <BrandForm
          otherBrands={others}
          categories={await categoryTree()}
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
            categoryIds: brand.categories.map((c) => c.categoryId),
            primaryCategoryId: brand.categories.find((c) => c.primary)?.categoryId ?? null,
          }}
        />
      </Card>
    </Stagger>
  );
}
