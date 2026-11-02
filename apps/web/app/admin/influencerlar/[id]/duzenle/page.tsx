import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@infulancer/core/db";
import { InfluencerForm } from "@/components/forms/influencer-form";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/layout";
import { requireActor } from "@/lib/auth-guard";
import { timeZones } from "@/lib/time";

export const metadata: Metadata = { title: "Influencer düzenle" };

export default async function EditInfluencerPage({ params }: { params: Promise<{ id: string }> }) {
  await requireActor("ADMIN");
  const { id } = await params;
  const inf = await prisma.influencer.findUnique({
    where: { id },
    include: { socialAccounts: true, user: { select: { email: true } } },
  });
  if (!inf) notFound();
  return (
    <div className="flex flex-col gap-8">
      <PageHeader title={inf.name} description={inf.user ? `Giriş: ${inf.user.email}` : "Giriş hesabı yok"} />
      <Card interactive={false}>
        <InfluencerForm
          timeZones={timeZones()}
          influencer={{
            id: inf.id,
            name: inf.name,
            category: inf.category,
            iban: inf.iban,
            ibanHolder: inf.ibanHolder,
            taxStatus: inf.taxStatus,
            canIssueInvoice: inf.canIssueInvoice,
            audienceTimezone: inf.audienceTimezone,
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
