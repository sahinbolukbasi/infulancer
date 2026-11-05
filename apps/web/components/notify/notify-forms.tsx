"use client";
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
  return (
    <ActionForm action={saveNotificationRuleAction} submitLabel="Kaydet" submitSize="sm" aria-label={`${eventKey} kuralı`} className="gap-2">
      <input type="hidden" name="eventKey" value={eventKey} />
      <div className="flex flex-wrap items-center gap-3">
        {CHANNELS.map((c) => (
          <label key={c.key} className="flex items-center gap-1.5 text-[13px]">
            <input type="checkbox" name="channels" value={c.key} defaultChecked={active.includes(c.key)} className="h-4 w-4 accent-[var(--color-fg)]" />
            {c.label}
          </label>
        ))}
        <label className="ml-auto flex items-center gap-1.5 text-[13px] text-fg-muted">
          <input type="checkbox" name="enabled" value="true" defaultChecked={enabled} className="h-4 w-4 accent-[var(--color-fg)]" />
          Aktif
        </label>
      </div>
    </ActionForm>
  );
}

/** Olay+kanal şablonu düzenleme. */
export function TemplateForm({ eventKey, channel, subject, body, vars }: { eventKey: string; channel: string; subject: string | null; body: string; vars: string[] }) {
  return (
    <ActionForm action={saveTemplateAction} submitLabel="Şablonu kaydet" submitSize="sm" aria-label={`${eventKey} ${channel} şablonu`} className="gap-2">
      <input type="hidden" name="eventKey" value={eventKey} />
      <input type="hidden" name="channel" value={channel} />
      {channel === "EMAIL" ? <Field label="Konu">{(p) => <Input {...p} name="subject" defaultValue={subject ?? ""} />}</Field> : <input type="hidden" name="subject" value={subject ?? ""} />}
      <Field label={`Metin (${channel})`} hint={`Değişkenler: ${vars.map((v) => `{{${v}}}`).join(" ")}`}>
        {(p) => <Textarea {...p} name="body" rows={3} defaultValue={body} />}
      </Field>
    </ActionForm>
  );
}

/** Özel duyuru gönderimi. */
export function AnnouncementForm() {
  return (
    <ActionForm action={sendAnnouncementAction} submitLabel="Duyuru gönder" resetOnSuccess aria-label="Özel duyuru">
      <Field label="Hedef kitle">
        {(p) => (
          <Select {...p} name="audience" defaultValue="all">
            <option value="all">Herkes</option>
            <option value="influencers">İçerik üreticileri</option>
            <option value="brands">Markalar</option>
          </Select>
        )}
      </Field>
      <Field label="Mesaj">{(p) => <Textarea {...p} name="message" rows={3} required placeholder="Duyuru metni…" />}</Field>
      <Field label="Bağlantı (opsiyonel)">{(p) => <Input {...p} name="link" placeholder="https://…" />}</Field>
    </ActionForm>
  );
}

/** Kısa link oluşturma. */
export function ShortLinkForm() {
  return (
    <ActionForm action={createShortLinkAction} submitLabel="Kısalt" resetOnSuccess aria-label="Link kısalt">
      <Field label="Hedef URL">{(p) => <Input {...p} name="url" required placeholder="https://uzun-link…" />}</Field>
      <Field label="Etiket (opsiyonel)">{(p) => <Input {...p} name="label" placeholder="Yaz kampanyası" />}</Field>
    </ActionForm>
  );
}
