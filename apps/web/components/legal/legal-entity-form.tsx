"use client";
import { ActionForm } from "@/components/forms/action-form";
import { Field, Input } from "@/components/ui/form";
import { saveLegalEntityAction } from "@/lib/actions/landing";
import type { LegalEntity } from "@/lib/legal";

const FIELDS: { k: keyof LegalEntity; label: string; type?: string; wide?: boolean }[] = [
  { k: "title", label: "Ticari unvan", wide: true },
  { k: "shortName", label: "Kısa ad" },
  { k: "mersis", label: "MERSİS no" },
  { k: "taxOffice", label: "Vergi dairesi" },
  { k: "taxNumber", label: "Vergi no" },
  { k: "address", label: "Adres", wide: true },
  { k: "email", label: "Destek e-postası", type: "email" },
  { k: "kvkkEmail", label: "KVKK başvuru e-postası", type: "email" },
  { k: "kep", label: "KEP adresi" },
  { k: "phone", label: "Telefon" },
  { k: "updatedAt", label: "Yürürlük tarihi (metinde görünür)" },
];
/** Gizlilik, KVKK, çerez ve kullanım koşulları metinlerindeki şirket bilgileri. */
export function LegalEntityForm({ entity }: { entity: LegalEntity }) {
  return (
    <ActionForm action={saveLegalEntityAction} submitLabel="Kaydet ve yasal metinleri güncelle" aria-label="Şirket bilgileri">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {FIELDS.map((f) => (
          <Field key={f.k} label={f.label} className={f.wide ? "md:col-span-2" : undefined}>
            {(p) => <Input {...p} name={f.k} type={f.type ?? "text"} defaultValue={entity[f.k]} />}
          </Field>
        ))}
      </div>
    </ActionForm>
  );
}
