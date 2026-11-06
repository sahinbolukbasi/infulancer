"use client";
import { ActionForm } from "@/components/forms/action-form";
import { Field, Input, Select } from "@/components/ui/form";
import { updateSupportTicketAction } from "@/lib/actions/support";

const STATUSES = [
  { value: "ACIK", label: "Açık" },
  { value: "INCELEMEDE", label: "İncelemede" },
  { value: "COZULDU", label: "Çözüldü" },
  { value: "KAPANDI", label: "Kapandı" },
];

/** Yönetici: destek talebinin durumunu ve iç notunu günceller. */
export function SupportTicketUpdate({ id, status, adminNote }: { id: string; status: string; adminNote: string | null }) {
  return (
    <ActionForm action={updateSupportTicketAction} submitLabel="Kaydet" submitSize="sm" aria-label="Talebi güncelle" className="!flex-row flex-wrap items-end">
      <input type="hidden" name="id" value={id} />
      <Field label="Durum" className="w-40">
        {(p) => (
          <Select {...p} name="status" defaultValue={status}>
            {STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Field label="İç not" className="min-w-[200px] flex-1">
        {(p) => <Input {...p} name="adminNote" defaultValue={adminNote ?? ""} placeholder="Ekip içi not (opsiyonel)" />}
      </Field>
    </ActionForm>
  );
}
