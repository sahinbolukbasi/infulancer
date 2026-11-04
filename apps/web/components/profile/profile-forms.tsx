"use client";
import { ActionForm } from "@/components/forms/action-form";
import { Field, Input } from "@/components/ui/form";
import { changePasswordAction, updateProfileAction } from "@/lib/actions/profile";

export function ProfileForm({ name, phone }: { name: string; phone: string | null }) {
  return (
    <ActionForm action={updateProfileAction} submitLabel="Kaydet" aria-label="Profil bilgileri">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Field label="Ad soyad">{(p) => <Input {...p} name="name" required defaultValue={name} autoComplete="name" />}</Field>
        <Field label="Telefon">{(p) => <Input {...p} name="phone" type="tel" defaultValue={phone ?? ""} autoComplete="tel" placeholder="+90 5__ ___ __ __" />}</Field>
      </div>
    </ActionForm>
  );
}
export function PasswordForm() {
  return (
    <ActionForm action={changePasswordAction} submitLabel="Şifreyi değiştir" submitVariant="secondary" resetOnSuccess aria-label="Şifre değiştir">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Field label="Mevcut şifre">{(p) => <Input {...p} name="current" type="password" required autoComplete="current-password" />}</Field>
        <Field label="Yeni şifre" hint="En az 10 karakter, harf ve rakam.">{(p) => <Input {...p} name="next" type="password" required minLength={10} autoComplete="new-password" />}</Field>
        <Field label="Yeni şifre (tekrar)">{(p) => <Input {...p} name="confirm" type="password" required minLength={10} autoComplete="new-password" />}</Field>
      </div>
    </ActionForm>
  );
}
