"use client";
import { useTT } from "@/lib/i18n/tt-client";
import { ActionForm } from "@/components/forms/action-form";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { saveNotificationRuleAction, saveTemplateAction, sendAnnouncementAction, createShortLinkAction } from "@/lib/actions/notify-admin";

const CHANNELS: { key: string; label: string }[] = [
  { key: "INAPP", label: "Sistem içi" },
  { key: "EMAIL", label: "E-posta" },
  { key: "WHATSAPP", label: "WhatsApp" },
  { key: "INSTAGRAM", label: "Instagram" },
];

/** Olay → kanal kuralı (hangi kanallardan gönderilsin). */
export function RuleForm({ eventKey, active, enabled }: { eventKey: string; active: string[]; enabled: boolean }) {
  const tt = useTT();
  return (
    <ActionForm action={saveNotificationRuleAction} submitLabel={tt("Kaydet")} submitSize="sm" aria-label={`${eventKey} kuralı`} className="gap-2">
      <input type="hidden" name="eventKey" value={eventKey} />
      <div className="flex flex-wrap items-center gap-3">
        {CHANNELS.map((c) => (
          <label key={c.key} className="flex items-center gap-1.5 text-[13px]">
            <input type="checkbox" name="channels" value={c.key} defaultChecked={active.includes(c.key)} className="h-4 w-4 accent-[var(--color-fg)]" />
            {c.label}
          </label>
        ))}
        <label className="ml-auto flex items-center gap-1.5 text-[13px] text-fg-muted">
          <input type="checkbox" name="enabled" value="true" defaultChecked={enabled} className="h-4 w-4 accent-[var(--color-fg)]" />{tt("Aktif")}</label>
      </div>
    </ActionForm>
  );
}

/** Olay+kanal şablonu düzenleme. */
export function TemplateForm({ eventKey, channel, subject, body, vars }: { eventKey: string; channel: string; subject: string | null; body: string; vars: string[] }) {
  const tt = useTT();
  return (
    <ActionForm action={saveTemplateAction} submitLabel={tt("Şablonu kaydet")} submitSize="sm" aria-label={`${eventKey} ${channel} şablonu`} className="gap-2">
      <input type="hidden" name="eventKey" value={eventKey} />
      <input type="hidden" name="channel" value={channel} />
      {channel === "EMAIL" ? <Field label={tt("Konu")}>{(p) => <Input {...p} name="subject" defaultValue={subject ?? ""} />}</Field> : <input type="hidden" name="subject" value={subject ?? ""} />}
      <Field label={`Metin (${channel})`} hint={`Değişkenler: ${vars.map((v) => `{{${v}}}`).join(" ")}`}>
        {(p) => <Textarea {...p} name="body" rows={3} defaultValue={body} />}
      </Field>
    </ActionForm>
  );
}

/** Özel duyuru gönderimi. */
export function AnnouncementForm() {
  const tt = useTT();
  return (
    <ActionForm action={sendAnnouncementAction} submitLabel={tt("Duyuru gönder")} resetOnSuccess aria-label={tt("Özel duyuru")}>
      <Field label={tt("Hedef kitle")}>
        {(p) => (
          <Select {...p} name="audience" defaultValue="all">
            <option value="all">{tt("Herkes")}</option>
            <option value="influencers">{tt("İçerik üreticileri")}</option>
            <option value="brands">{tt("Markalar")}</option>
          </Select>
        )}
      </Field>
      <Field label={tt("Mesaj")}>{(p) => <Textarea {...p} name="message" rows={3} required placeholder={tt("Duyuru metni…")} />}</Field>
      <Field label={tt("Bağlantı (opsiyonel)")}>{(p) => <Input {...p} name="link" placeholder="https://…" />}</Field>
    </ActionForm>
  );
}

/** Kısa link oluşturma. */
export function ShortLinkForm() {
  const tt = useTT();
  return (
    <ActionForm action={createShortLinkAction} submitLabel={tt("Kısalt")} resetOnSuccess aria-label={tt("Link kısalt")}>
      <Field label={tt("Hedef URL")}>{(p) => <Input {...p} name="url" required placeholder="https://uzun-link…" />}</Field>
      <Field label={tt("Etiket (opsiyonel)")}>{(p) => <Input {...p} name="label" placeholder={tt("Yaz kampanyası")} />}</Field>
    </ActionForm>
  );
}
