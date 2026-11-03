import type { Metadata } from "next";
import { InfluencerForm } from "@/components/forms/influencer-form";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/layout";
import { requireActor } from "@/lib/auth-guard";
import { timeZones } from "@/lib/time";
import { categoryTree } from "@infulancer/core/domain/categories";

export const metadata: Metadata = { title: "Yeni influencer" };

export default async function NewInfluencerPage() {
  await requireActor("ADMIN");
  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Yeni influencer" description="Kayıttan sonra sahte etkileşim kontrolü otomatik çalışır." />
      <Card interactive={false}>
        <InfluencerForm timeZones={timeZones()} categories={await categoryTree()} />
      </Card>
    </div>
  );
}
