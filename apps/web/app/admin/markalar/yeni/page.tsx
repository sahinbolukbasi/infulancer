import type { Metadata } from "next";
import { prisma } from "@infulancer/core/db";
import { BrandForm } from "@/components/forms/brand-forms";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/layout";
import { requireActor } from "@/lib/auth-guard";

export const metadata: Metadata = { title: "Yeni marka" };

export default async function NewBrandPage() {
  await requireActor("ADMIN");
  const brands = await prisma.brand.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, category: true } });
  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Yeni marka" />
      <Card interactive={false}>
        <BrandForm otherBrands={brands} />
      </Card>
    </div>
  );
}
