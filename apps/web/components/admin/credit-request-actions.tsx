"use client";
import { startTransition, useActionState } from "react";
import { approveCreditRequestAction, rejectCreditRequestAction } from "@/lib/actions/credit-requests";
import { idleState } from "@/lib/action-state";

/** Yönetici: bakiye talebini onayla / reddet. */
export function CreditRequestActions({ id }: { id: string }) {
  const [, approve, approving] = useActionState(approveCreditRequestAction, idleState);
  const [, reject, rejecting] = useActionState(rejectCreditRequestAction, idleState);
  const run = (action: (fd: FormData) => void) => {
    const fd = new FormData();
    fd.set("id", id);
    startTransition(() => action(fd));
  };
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        disabled={approving || rejecting}
        onClick={() => run(approve)}
        className="rounded-full bg-fg px-3 py-1.5 text-[13px] font-semibold text-bg transition-standard hover:opacity-90 disabled:opacity-40"
      >
        {approving ? "Onaylanıyor…" : "Onayla ve yükle"}
      </button>
      <button
        type="button"
        disabled={approving || rejecting}
        onClick={() => run(reject)}
        className="rounded-full border border-border px-3 py-1.5 text-[13px] text-fg-muted transition-standard hover:text-fg disabled:opacity-40"
      >
        Reddet
      </button>
    </div>
  );
}
