"use client";
import { ActionForm } from "@/components/forms/action-form";
import { Input, Select } from "@/components/ui/form";
import { saveOwnAccountAction, syncOwnAccountsAction } from "@/lib/actions/own-accounts";

/** Kullanıcı adıyla Instagram / YouTube hesabı bağla (otomatik senkron). */
export function OwnAccountForm() {
  return (
    <ActionForm action={saveOwnAccountAction} submitLabel="Bağla ve güncelle" resetOnSuccess aria-label="Hesap bağla" className="gap-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[160px_1fr]">
        <Select name="platform" aria-label="Platform" defaultValue="INSTAGRAM">
          <option value="INSTAGRAM">Instagram</option>
          <option value="YOUTUBE">YouTube</option>
        </Select>
        <Input name="handle" required placeholder="@kullaniciadi veya profil bağlantısı" aria-label="Kullanıcı adı" />
      </div>
      <p className="text-[12px] text-fg-passive">Instagram hesabı Business veya Creator olmalı. Şifre istenmez.</p>
    </ActionForm>
  );
}

export function SyncOwnButton() {
  return <ActionForm action={syncOwnAccountsAction} submitLabel="Hesaplarımı şimdi güncelle" submitVariant="secondary" submitSize="sm" aria-label="Hesapları güncelle" className="gap-1" />;
}
