"use client";
import { ActionForm } from "@/components/forms/action-form";
import { setUserStatusAction } from "@/lib/actions/users";

/** Satır içi askıya al / etkinleştir düğmesi. */
export function UserStatusButton({ userId, status, name }: { userId: string; status: "ACTIVE" | "SUSPENDED"; name: string }) {
  const next = status === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
  return (
    <ActionForm
      action={setUserStatusAction}
      submitLabel={next === "SUSPENDED" ? "Askıya al" : "Etkinleştir"}
      submitVariant={next === "SUSPENDED" ? "ghost" : "secondary"}
      submitSize="sm"
      aria-label={`${name}: ${next === "SUSPENDED" ? "askıya al" : "etkinleştir"}`}
      className="gap-1"
    >
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="status" value={next} />
    </ActionForm>
  );
}
