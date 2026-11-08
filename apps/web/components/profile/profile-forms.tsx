"use client";
import { useTT } from "@/lib/i18n/tt-client";
import { useState } from "react";
import { ActionForm } from "@/components/forms/action-form";
import { Button, Field, Input } from "@/components/ui/form";
import { changePasswordAction, updateProfileAction } from "@/lib/actions/profile";

/** Kişisel bilgiler: varsayılan salt-okunur; "Düzenle" ile form açılır, kaydedince kapanır. */
export function ProfileForm({ name, phone }: { name: string; phone: string | null }) {
  const tt = useTT();
  const [editing, setEditing] = useState(false);

  if (!editing) {
    return (
      <div className="flex flex-col gap-3">
        <dl className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="flex flex-col gap-0.5">
            <dt className="text-[12px] text-fg-muted">{tt("Ad soyad")}</dt>
            <dd className="text-sm">{name || "—"}</dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="text-[12px] text-fg-muted">{tt("Telefon")}</dt>
            <dd className="text-sm">{phone || "—"}</dd>
          </div>
        </dl>
        <Button type="button" variant="secondary" size="sm" className="w-fit" onClick={() => setEditing(true)}>{tt("Düzenle")}</Button>
      </div>
    );
  }

  return (
    <ActionForm
      action={updateProfileAction}
      submitLabel={tt("Kaydet")}
      aria-label={tt("Profil bilgileri")}
      onSuccess={() => setEditing(false)}
      footer={
        <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>{tt("Vazgeç")}</Button>
      }
    >
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Field label={tt("Ad soyad")}>{(p) => <Input {...p} name="name" required defaultValue={name} autoComplete="name" />}</Field>
        <Field label={tt("Telefon")}>{(p) => <Input {...p} name="phone" type="tel" defaultValue={phone ?? ""} autoComplete="tel" placeholder="+90 5__ ___ __ __" />}</Field>
      </div>
    </ActionForm>
  );
}
export function PasswordForm() {
  const tt = useTT();
  const [editing, setEditing] = useState(false);
  if (!editing) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-fg-muted">{tt("Şifreniz gizlidir. Değiştirmek için düzenleyin.")}</p>
        <Button type="button" variant="secondary" size="sm" className="w-fit" onClick={() => setEditing(true)}>{tt("Şifreyi değiştir")}</Button>
      </div>
    );
  }
  return (
    <ActionForm
      action={changePasswordAction}
      submitLabel={tt("Şifreyi değiştir")}
      submitVariant="secondary"
      resetOnSuccess
      aria-label={tt("Şifre değiştir")}
      onSuccess={() => setEditing(false)}
      footer={
        <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>{tt("Vazgeç")}</Button>
      }
    >
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Field label={tt("Mevcut şifre")}>{(p) => <Input {...p} name="current" type="password" required autoComplete="current-password" />}</Field>
        <Field label={tt("Yeni şifre")} hint={tt("En az 10 karakter, harf ve rakam.")}>{(p) => <Input {...p} name="next" type="password" required minLength={10} autoComplete="new-password" />}</Field>
        <Field label={tt("Yeni şifre (tekrar)")}>{(p) => <Input {...p} name="confirm" type="password" required minLength={10} autoComplete="new-password" />}</Field>
      </div>
    </ActionForm>
  );
}
