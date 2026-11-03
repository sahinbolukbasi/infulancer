"use client";
import { ActionForm } from "@/components/forms/action-form";
import { Button } from "@/components/ui/form";
import { approveCampaignSummary, recommendCandidates } from "@/lib/actions/agent-jobs";
import { syncInfluencerAccounts } from "@/lib/actions/influencers";

export function RecommendButton({ campaignId }: { campaignId: string }) {
  return (
    <ActionForm action={recommendCandidates} aria-label="Aday öner">
      <input type="hidden" name="id" value={campaignId} />
      <Button type="submit" variant="secondary" size="sm">
        Aday öner
      </Button>
    </ActionForm>
  );
}

export function ApproveSummaryButton({ runId }: { runId: string }) {
  return (
    <ActionForm action={approveCampaignSummary} aria-label="Özeti rapora aktar">
      <input type="hidden" name="id" value={runId} />
      <Button type="submit" size="sm">
        Rapora aktar
      </Button>
    </ActionForm>
  );
}

export function SyncAccountsButton({ influencerId }: { influencerId: string }) {
  return (
    <ActionForm action={syncInfluencerAccounts} aria-label="Hesapları senkronla">
      <input type="hidden" name="id" value={influencerId} />
      <Button type="submit" variant="secondary" size="sm">
        Şimdi senkronla
      </Button>
    </ActionForm>
  );
}
