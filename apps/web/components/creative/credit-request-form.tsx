"use client";
import { ActionForm } from "@/components/forms/action-form";
import { Field, Input } from "@/components/ui/form";
import { requestCreditAction } from "@/lib/actions/credit-requests";

/** Marka/influencer için Creative bakiyesi (TL) talep formu. Açılır bölüm içinde. */
export function CreditRequestForm({ pending, currency = "TRY" }: { pending: boolean; currency?: string }) {
  return (
    <details className="rounded-2xl border border-line bg-surface">
      <summary className="cursor-pointer px-4 py-3 text-[13px] font-medium text-fg hover:text-fg">
        {pending ? "Bakiye talebiniz inceleniyor" : "Bakiye talebi gönder"}
      </summary>
      <div className="border-t border-line p-4">
        {pending ? (
          <p className="text-[13px] text-fg-muted">Bekleyen bir talebiniz var. Yönetici onayladığında bakiyeniz güncellenir.</p>
        ) : (
          <ActionForm action={requestCreditAction} submitLabel="Talep gönder" submitSize="sm" resetOnSuccess aria-label="Bakiye talebi">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label={`Talep tutarı (${currency === "TRY" ? "TL" : currency})`}>{(p) => <Input {...p} name="amount" inputMode="numeric" required placeholder={currency === "TRY" ? "2000" : "50"} />}</Field>
              <Field label="Açıklama (opsiyonel)">{(p) => <Input {...p} name="note" placeholder="Video üretimi için" />}</Field>
            </div>
          </ActionForm>
        )}
      </div>
    </details>
  );
}
