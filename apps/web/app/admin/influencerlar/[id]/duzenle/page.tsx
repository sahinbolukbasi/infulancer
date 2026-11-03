import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@infulancer/core/db";
import { InfluencerForm } from "@/components/forms/influencer-form";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/layout";
import { requireActor } from "@/lib/auth-guard";
import { timeZones } from "@/lib/time";
import { categoryTree } from "@infulancer/core/domain/categories";
import { ButtonLink } from "@/components/ui/form";

export const metadata: Metadata = { title: "Influencer düzenle" };

export default async function EditInfluencerPage({ params }: { params: Promise<{ id: string }> }) {
  await requireActor("ADMIN");
  const { id } = await params;
  const inf = await prisma.influencer.findUnique({
    where: { id },
    include: { socialAccounts: true, user: { select: { email: true } }, categories: true },
  });
  if (!inf) notFound();
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title={`${inf.name} · düzenle`}
        description={inf.user ? `Giriş: ${inf.user.email}` : "Giriş hesabı yok"}
        actions={
          <ButtonLink href={`/admin/influencerlar/${inf.id}`} variant="secondary">
            Profile dön
          </ButtonLink>
        }
      />
      <Card interactive={false}>
        <InfluencerForm
          timeZones={timeZones()}
          categories={await categoryTree()}
          influencer={{
            id: inf.id,
            name: inf.name,
            category: inf.category,
            iban: inf.iban,
            ibanHolder: inf.ibanHolder,
            taxStatus: inf.taxStatus,
            canIssueInvoice: inf.canIssueInvoice,
            audienceTimezone: inf.audienceTimezone,
            city: inf.city,
            bio: inf.bio,
            categoryIds: inf.categories.map((c) => c.categoryId),
            primaryCategoryId: inf.categories.find((c) => c.primary)?.categoryId ?? null,
            accounts: inf.socialAccounts.map((a) => ({
              platform: a.platform,
              handle: a.handle,
              followers: a.followers,
              erPercent: (Number(a.engagementRate) * 100).toLocaleString("tr-TR", { maximumFractionDigits: 2 }),
              demographics: JSON.stringify(a.demographics, null, 2),
            })),
          }}
        />
      </Card>
    </div>
  );
}
