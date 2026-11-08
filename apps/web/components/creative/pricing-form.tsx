"use client";
import { useTT } from "@/lib/i18n/tt-client";
import { ActionForm } from "@/components/forms/action-form";
import { Field, Input } from "@/components/ui/form";
import { savePricingAction } from "@/lib/actions/operations";

/** Yönetici: Creative fiyat formülü ayarları. Kaydedince tüm model fiyatları yeniden hesaplanır. */
export function PricingForm({ markup, minTry, usdTry, autoFx }: { markup: number; minTry: number; usdTry: number; autoFx: boolean }) {
  const tt = useTT();
  return (
    <ActionForm action={savePricingAction} submitLabel={tt("Kaydet ve fiyatları yeniden hesapla")} submitSize="sm" aria-label={tt("Fiyatlandırma")}>
      <div className="grid grid-cols-3 gap-3">
        <Field label={tt("Markup (×)")} hint={tt("Maliyet çarpanı; 1 = maliyetine")}>
          {(p) => <Input {...p} name="markup" inputMode="decimal" defaultValue={String(markup)} required />}
        </Field>
        <Field label={tt("En düşük ücret (TL)")}>{(p) => <Input {...p} name="minTry" inputMode="decimal" defaultValue={String(minTry)} required />}</Field>
        <Field label={tt("USD/TRY")}>{(p) => <Input {...p} name="usdTry" inputMode="decimal" defaultValue={String(usdTry)} required />}</Field>
      </div>
      <label className="flex items-center gap-2 text-[12px] text-fg-muted">
        <input type="checkbox" name="autoFx" defaultChecked={autoFx} className="h-4 w-4 accent-[var(--color-fg)]" />{" "}{tt("Kuru her açılışta otomatik güncelle")}</label>
    </ActionForm>
  );
}
