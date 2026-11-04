"use client";
import { ActionForm } from "@/components/forms/action-form";
import { Button, Field, Input, Select, Textarea } from "@/components/ui/form";
import {
  addKnowledge,
  captureConsent,
  confirmPayment,
  createTemplate,
  enableAgent,
  kvkkAction,
  sendInboxMessage,
  signupWhatsApp,
  updateConversation,
  connectInstagramAction,
} from "@/lib/actions/channels";

/** Pencere kapalıyken serbest metin devre dışıdır; yalnız onaylı template seçilir. */
export function Composer({
  conversationId,
  mode,
  reason,
  templates,
}: {
  conversationId: string;
  mode: "free_text" | "template_only" | "blocked";
  reason?: string;
  templates: { id: string; name: string; category: string }[];
}) {
  return (
    <ActionForm action={sendInboxMessage} resetOnSuccess aria-label="Mesaj gönder" submitLabel="Gönder" footer={reason ? <p className="text-[13px] text-fg-muted">{reason}</p> : undefined}>
      <input type="hidden" name="conversationId" value={conversationId} />
      {mode === "free_text" ? (
        <Field label="Mesaj">
          {(p) => <Textarea {...p} name="text" rows={3} maxLength={4000} required />}
        </Field>
      ) : mode === "template_only" ? (
        <Field label="Onaylı template (serbest metin devre dışı)">
          {(p) => (<Select {...p} name="templateId" required defaultValue="">
            <option value="" disabled>
              Template seçin
            </option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} · {t.category}
              </option>
            ))}
          </Select>)}
        </Field>
      ) : (
        <Textarea name="text" rows={2} disabled aria-disabled placeholder="Bu konuşmaya mesaj gönderilemez." />
      )}
    </ActionForm>
  );
}

export function ConversationActions({ conversationId, status }: { conversationId: string; status: string }) {
  const ops = status === "closed" ? [["reopen", "Yeniden aç"]] : [["take", "Üstlen"], ["close", "Kapat"]];
  return (
    <div className="flex gap-2">
      {ops.map(([op, label]) => (
        <ActionForm key={op} action={updateConversation} aria-label={label}>
          <input type="hidden" name="conversationId" value={conversationId} />
          <input type="hidden" name="op" value={op} />
          <Button type="submit" variant="secondary" size="sm">
            {label}
          </Button>
        </ActionForm>
      ))}
    </div>
  );
}

export function InstagramConnectForm() {
  return (
    <ActionForm action={connectInstagramAction} submitLabel="Instagram'ı bağla" aria-label="Instagram bağla">
      <p className="text-[13px] text-fg-muted">Meta ile giriş penceresinden dönen kodu ve hesap bilgilerini girin. Hesap Business veya Creator olmalı, bir Facebook Sayfasına bağlı olmalı.</p>
      <Field label="Bağlantı kodu">{(p) => <Input {...p} name="code" required maxLength={500} />}</Field>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field label="Facebook Sayfa ID">{(p) => <Input {...p} name="pageId" inputMode="numeric" required />}</Field>
        <Field label="Instagram hesap ID">{(p) => <Input {...p} name="igUserId" inputMode="numeric" required />}</Field>
        <Field label="Hesap türü">
          {(p) => (
            <Select {...p} name="accountType" defaultValue="BUSINESS">
              <option value="BUSINESS">Business</option>
              <option value="CREATOR">Creator</option>
              <option value="PERSONAL">Kişisel</option>
            </Select>
          )}
        </Field>
      </div>
    </ActionForm>
  );
}
export function WhatsAppSignupForm() {
  return (
    <ActionForm action={signupWhatsApp} submitLabel="Numarayı bağla" aria-label="WhatsApp bağla">
      <p className="text-[13px] text-fg-muted">
        Embedded Signup v4 penceresinden dönen kod ve kimlikler sunucuda işlenir. Bu form, Meta penceresi entegre edilene kadar manuel giriş içindir.
      </p>
      <Field label="Signup kodu">
        {(p) => <Input {...p} name="code" required maxLength={500} />}
      </Field>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="WABA ID">
          {(p) => <Input {...p} name="wabaId" inputMode="numeric" required />}
        </Field>
        <Field label="Phone number ID">
          {(p) => <Input {...p} name="phoneNumberId" inputMode="numeric" required />}
        </Field>
        <Field label="Görünen numara">
          {(p) => <Input {...p} name="displayNumber" placeholder="+90 …" />}
        </Field>
        <Field label="İki adımlı doğrulama PIN'i (6 hane)">
          {(p) => <Input {...p} name="pin" inputMode="numeric" pattern="\d{6}" required autoComplete="off" />}
        </Field>
      </div>
    </ActionForm>
  );
}

export function ConfirmPaymentButton() {
  return (
    <ActionForm action={async () => confirmPayment()} aria-label="Ödeme yöntemini onayla">
      <Button type="submit" size="sm">
        Ödeme yöntemini ekledim
      </Button>
    </ActionForm>
  );
}

export function EnableAgentButton({ agentKey }: { agentKey: string }) {
  return (
    <ActionForm action={enableAgent} aria-label="Agent'ı etkinleştir">
      <input type="hidden" name="key" value={agentKey} />
      <Button type="submit" size="sm" variant="secondary">
        Etkinleştir
      </Button>
    </ActionForm>
  );
}

export function KnowledgeForm() {
  return (
    <ActionForm action={addKnowledge} resetOnSuccess submitLabel="Bilgi tabanına ekle" aria-label="Bilgi ekle">
      <Field label="Başlık">
        {(p) => <Input {...p} name="title" required maxLength={140} />}
      </Field>
      <Field label="Metin (SSS, kargo, iade, stok…)">
        {(p) => <Textarea {...p} name="text" rows={5} required />}
      </Field>
    </ActionForm>
  );
}

export function TemplateForm() {
  return (
    <ActionForm action={createTemplate} resetOnSuccess submitLabel="İncelemeye gönder" aria-label="Template oluştur">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Ad">
          {(p) => <Input {...p} name="name" required pattern="[a-z0-9_]{3,60}" />}
        </Field>
        <Field label="Kategori">
          {(p) => (<Select {...p} name="category" defaultValue="utility">
            <option value="utility">utility</option>
            <option value="marketing">marketing</option>
            <option value="authentication">authentication</option>
          </Select>)}
        </Field>
      </div>
      <Field label="Metin">
        {(p) => <Textarea {...p} name="body" rows={3} required maxLength={1024} />}
      </Field>
      <p className="text-[13px] text-fg-muted">Promosyon unsuru (indirim, kupon…) içeren utility template ticari ileti sayılır ve İYS onayı gerektirir.</p>
    </ActionForm>
  );
}

/** İki onay ayrı: pazarlama (İYS) ve AI işleme (KVKK açık rıza) birbirine bağlanmaz. */
export function ConsentForm() {
  return (
    <ActionForm action={captureConsent} resetOnSuccess submitLabel="Kaydet" aria-label="İYS onayı kaydet">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Alıcı (E.164 telefon veya e-posta)">
          {(p) => <Input {...p} name="recipient" required />}
        </Field>
        <Field label="Kanal">
          {(p) => (<Select {...p} name="channel" defaultValue="MESAJ">
            <option value="MESAJ">MESAJ</option>
            <option value="EPOSTA">EPOSTA</option>
            <option value="ARAMA">ARAMA</option>
          </Select>)}
        </Field>
        <Field label="Durum">
          {(p) => (<Select {...p} name="state" defaultValue="ONAY">
            <option value="ONAY">ONAY</option>
            <option value="RET">RET</option>
          </Select>)}
        </Field>
        <Field label="Aydınlatma metni sürümü">
          {(p) => <Input {...p} name="aydinlatmaVersion" required defaultValue="2026-08" />}
        </Field>
      </div>
      <Field label="Delil (form/çağrı kaydı referansı)">
        {(p) => <Input {...p} name="evidence" />}
      </Field>
    </ActionForm>
  );
}

export function KvkkForms({ signed, missing }: { signed: boolean; missing: { key: string; label: string }[] }) {
  return (
    <div className="flex flex-col gap-4">
      {!signed ? (
        <ActionForm action={kvkkAction} aria-label="Standart sözleşmeyi imzala">
          <input type="hidden" name="op" value="sign" />
          <Button type="submit">Veri sorumlusu → veri işleyen standart sözleşmesini imzala</Button>
        </ActionForm>
      ) : null}
      {signed
        ? missing.map((m) => (
            <ActionForm key={m.key} action={kvkkAction} submitLabel="Makbuzu kaydet" submitSize="sm" aria-label={`${m.label} makbuzu`}>
              <input type="hidden" name="op" value="receipt" />
              <input type="hidden" name="target" value={m.key} />
              <Field label={`${m.label} — bildirim makbuzu (dosya anahtarı)`}>
                {(p) => <Input {...p} name="s3Key" required placeholder="kvkk/…/makbuz.pdf" />}
              </Field>
            </ActionForm>
          ))
        : null}
      <ActionForm action={kvkkAction} aria-label="Canlıya geç">
        <input type="hidden" name="op" value="production" />
        <Button type="submit" variant="secondary">
          Canlı moda geç
        </Button>
      </ActionForm>
    </div>
  );
}
