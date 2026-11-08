"use client";
import { useTT } from "@/lib/i18n/tt-client";
import { ActionForm } from "@/components/forms/action-form";
import { Input, Select } from "@/components/ui/form";
import { saveOwnAccountAction, syncOwnAccountsAction } from "@/lib/actions/own-accounts";

/** Kullanıcı adıyla Instagram / YouTube hesabı bağla (otomatik senkron). */
export function OwnAccountForm() {
  const tt = useTT();
  return (
    <ActionForm action={saveOwnAccountAction} submitLabel={tt("Bağla ve güncelle")} resetOnSuccess aria-label={tt("Hesap bağla")} className="gap-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[160px_1fr]">
        <Select name="platform" aria-label={tt("Platform")} defaultValue="INSTAGRAM">
          <option value="INSTAGRAM">{tt("Instagram")}</option>
          <option value="YOUTUBE">{tt("YouTube")}</option>
        </Select>
        <Input name="handle" required placeholder={tt("@kullaniciadi veya profil bağlantısı")} aria-label={tt("Kullanıcı adı")} />
      </div>
      <p className="text-[12px] text-fg-passive">{tt("Instagram hesabı Business veya Creator olmalı. Şifre istenmez.")}</p>
    </ActionForm>
  );
}

export function SyncOwnButton() {
  const tt = useTT();
  return <ActionForm action={syncOwnAccountsAction} submitLabel={tt("Hesaplarımı şimdi güncelle")} submitVariant="secondary" submitSize="sm" aria-label={tt("Hesapları güncelle")} className="gap-1" />;
}
