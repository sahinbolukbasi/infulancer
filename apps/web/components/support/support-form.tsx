"use client";
import { useTT } from "@/lib/i18n/tt-client";
import { ActionForm } from "@/components/forms/action-form";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { submitSupportTicket } from "@/lib/actions/support";

const CATEGORIES = [
  { value: "HATA", label: "Hata bildirimi" },
  { value: "SORU", label: "Soru" },
  { value: "ISTEK", label: "İstek / öneri" },
  { value: "DIGER", label: "Diğer" },
];

/** Destek talebi formu. Girişli kullanıcıda ad/e-posta ön doldurulur; açtığınız sayfa otomatik eklenir. */
export function SupportForm({ defaultName = "", defaultEmail = "", defaultCategory = "SORU" }: { defaultName?: string; defaultEmail?: string; defaultCategory?: string }) {
  const tt = useTT();
  // Hatanın yaşandığı sayfayı referans için gizli input'a yaz (callback ref, state yok).
  const setPageUrl = (el: HTMLInputElement | null) => {
    if (el && !el.value) el.value = document.referrer && !document.referrer.includes("/destek") ? document.referrer : window.location.href;
  };
  return (
    <ActionForm action={submitSupportTicket} submitLabel={tt("Talebi gönder")} resetOnSuccess aria-label={tt("Destek talebi")}>
      <input ref={setPageUrl} type="hidden" name="pageUrl" defaultValue="" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label={tt("Adınız")}>{(p) => <Input {...p} name="name" required defaultValue={defaultName} placeholder={tt("Ad Soyad")} />}</Field>
        <Field label={tt("E-posta")}>{(p) => <Input {...p} name="email" type="email" required defaultValue={defaultEmail} placeholder={tt("ornek@eposta.com")} />}</Field>
      </div>
      <Field label={tt("Konu türü")}>
        {(p) => (
          <Select {...p} name="category" defaultValue={defaultCategory}>
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Field label={tt("Konu")}>{(p) => <Input {...p} name="subject" required maxLength={200} placeholder={tt("Kısa bir başlık")} />}</Field>
      <Field label={tt("Mesajınız")} hint={tt("Yaşadığınız hatayı, adımları veya isteğinizi olabildiğince ayrıntılı yazın.")}>
        {(p) => <Textarea {...p} name="message" required rows={6} maxLength={5000} placeholder={tt("Ne oldu? Hangi adımda, ne beklerken ne gördünüz?")} />}
      </Field>
    </ActionForm>
  );
}
