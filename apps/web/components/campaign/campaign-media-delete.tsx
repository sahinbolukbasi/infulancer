"use client";
import { useActionState } from "react";
import { deleteCampaignAsset } from "@/lib/actions/assets";
import { idleState } from "@/lib/action-state";

export function DeleteMediaButton({ assetId, name }: { assetId: string; name: string }) {
  const [state, action, pending] = useActionState(deleteCampaignAsset, idleState);
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm(`"${name}" silinsin mi?`)) e.preventDefault();
      }}
    >
      <input type="hidden" name="assetId" value={assetId} />
      <button type="submit" disabled={pending} aria-label={`${name} dosyasını sil`} className="rounded-full px-2 py-0.5 text-[11px] text-fg-muted hover:bg-red-500/10 hover:text-critical disabled:opacity-40">
        {pending ? "…" : "Sil"}
      </button>
      {state.error ? (
        <span role="alert" className="sr-only">
          {state.error}
        </span>
      ) : null}
    </form>
  );
}
