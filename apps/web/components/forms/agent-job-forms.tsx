"use client";
import { useTT } from "@/lib/i18n/tt-client";
import { ActionForm } from "@/components/forms/action-form";
import { Button } from "@/components/ui/form";
import { approveCampaignSummary, recommendCandidates } from "@/lib/actions/agent-jobs";
import { syncInfluencerAccounts } from "@/lib/actions/influencers";

export function RecommendButton({ campaignId }: { campaignId: string }) {
  const tt = useTT();
  return (
    <ActionForm action={recommendCandidates} aria-label={tt("Aday öner")}>
      <input type="hidden" name="id" value={campaignId} />
      <Button type="submit" variant="secondary" size="sm">{tt("Aday öner")}</Button>
    </ActionForm>
  );
}

export function ApproveSummaryButton({ runId }: { runId: string }) {
  const tt = useTT();
  return (
    <ActionForm action={approveCampaignSummary} aria-label={tt("Özeti rapora aktar")}>
      <input type="hidden" name="id" value={runId} />
      <Button type="submit" size="sm">{tt("Rapora aktar")}</Button>
    </ActionForm>
  );
}

export function SyncAccountsButton({ influencerId }: { influencerId: string }) {
  const tt = useTT();
  return (
    <ActionForm action={syncInfluencerAccounts} aria-label={tt("Hesapları senkronla")}>
      <input type="hidden" name="id" value={influencerId} />
      <Button type="submit" variant="secondary" size="sm">{tt("Şimdi senkronla")}</Button>
    </ActionForm>
  );
}
