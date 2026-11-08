import type { Metadata } from "next";
import { CampaignWizardPage } from "@/components/campaign/wizard/wizard-page";
import { requireActor } from "@/lib/auth-guard";
export const metadata: Metadata = { title: "Yeni kampanya" };
export default async function BrandNewCampaignPage() {
  const actor = await requireActor("BRAND");
  return <CampaignWizardPage actor={actor} campaignId={null} />;
}
