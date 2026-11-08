import type { Metadata } from "next";
import { CampaignWizardPage } from "@/components/campaign/wizard/wizard-page";
import { requireActor } from "@/lib/auth-guard";
export const metadata: Metadata = { title: "Kampanya oluştur" };
export const dynamic = "force-dynamic";
export default async function BrandCampaignWizardPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ adim?: string }> }) {
  const actor = await requireActor("BRAND");
  const [{ id }, { adim }] = await Promise.all([params, searchParams]);
  return <CampaignWizardPage actor={actor} campaignId={id} step={adim} />;
}
