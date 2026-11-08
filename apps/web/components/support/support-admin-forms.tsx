"use client";
import { useTT } from "@/lib/i18n/tt-client";
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
  const tt = useTT();
  return (
    <ActionForm action={updateSupportTicketAction} submitLabel={tt("Kaydet")} submitSize="sm" aria-label={tt("Talebi güncelle")} className="!flex-row flex-wrap items-end">
      <input type="hidden" name="id" value={id} />
      <Field label={tt("Durum")} className="w-40">
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
      <Field label={tt("İç not")} className="min-w-[200px] flex-1">
        {(p) => <Input {...p} name="adminNote" defaultValue={adminNote ?? ""} placeholder={tt("Ekip içi not (opsiyonel)")} />}
      </Field>
    </ActionForm>
  );
}
