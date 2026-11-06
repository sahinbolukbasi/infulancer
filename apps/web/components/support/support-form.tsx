"use client";
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
  // Hatanın yaşandığı sayfayı referans için gizli input'a yaz (callback ref, state yok).
  const setPageUrl = (el: HTMLInputElement | null) => {
    if (el && !el.value) el.value = document.referrer && !document.referrer.includes("/destek") ? document.referrer : window.location.href;
  };
  return (
    <ActionForm action={submitSupportTicket} submitLabel="Talebi gönder" resetOnSuccess aria-label="Destek talebi">
      <input ref={setPageUrl} type="hidden" name="pageUrl" defaultValue="" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Adınız">{(p) => <Input {...p} name="name" required defaultValue={defaultName} placeholder="Ad Soyad" />}</Field>
        <Field label="E-posta">{(p) => <Input {...p} name="email" type="email" required defaultValue={defaultEmail} placeholder="ornek@eposta.com" />}</Field>
      </div>
      <Field label="Konu türü">
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
      <Field label="Konu">{(p) => <Input {...p} name="subject" required maxLength={200} placeholder="Kısa bir başlık" />}</Field>
      <Field label="Mesajınız" hint="Yaşadığınız hatayı, adımları veya isteğinizi olabildiğince ayrıntılı yazın.">
        {(p) => <Textarea {...p} name="message" required rows={6} maxLength={5000} placeholder="Ne oldu? Hangi adımda, ne beklerken ne gördünüz?" />}
      </Field>
    </ActionForm>
  );
}
