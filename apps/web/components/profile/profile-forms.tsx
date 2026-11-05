"use client";
import { useState } from "react";
import { ActionForm } from "@/components/forms/action-form";
import { Button, Field, Input } from "@/components/ui/form";
import { changePasswordAction, updateProfileAction } from "@/lib/actions/profile";

/** Kişisel bilgiler: varsayılan salt-okunur; "Düzenle" ile form açılır, kaydedince kapanır. */
export function ProfileForm({ name, phone }: { name: string; phone: string | null }) {
  const [editing, setEditing] = useState(false);

  if (!editing) {
    return (
      <div className="flex flex-col gap-3">
        <dl className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="flex flex-col gap-0.5">
            <dt className="text-[12px] text-fg-muted">Ad soyad</dt>
            <dd className="text-sm">{name || "—"}</dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="text-[12px] text-fg-muted">Telefon</dt>
            <dd className="text-sm">{phone || "—"}</dd>
          </div>
        </dl>
        <Button type="button" variant="secondary" size="sm" className="w-fit" onClick={() => setEditing(true)}>
          Düzenle
        </Button>
      </div>
    );
  }

  return (
    <ActionForm
      action={updateProfileAction}
      submitLabel="Kaydet"
      aria-label="Profil bilgileri"
      onSuccess={() => setEditing(false)}
      footer={
        <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>
          Vazgeç
        </Button>
      }
    >
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Field label="Ad soyad">{(p) => <Input {...p} name="name" required defaultValue={name} autoComplete="name" />}</Field>
        <Field label="Telefon">{(p) => <Input {...p} name="phone" type="tel" defaultValue={phone ?? ""} autoComplete="tel" placeholder="+90 5__ ___ __ __" />}</Field>
      </div>
    </ActionForm>
  );
}
export function PasswordForm() {
  const [editing, setEditing] = useState(false);
  if (!editing) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-fg-muted">Şifreniz gizlidir. Değiştirmek için düzenleyin.</p>
        <Button type="button" variant="secondary" size="sm" className="w-fit" onClick={() => setEditing(true)}>
          Şifreyi değiştir
        </Button>
      </div>
    );
  }
  return (
    <ActionForm
      action={changePasswordAction}
      submitLabel="Şifreyi değiştir"
      submitVariant="secondary"
      resetOnSuccess
      aria-label="Şifre değiştir"
      onSuccess={() => setEditing(false)}
      footer={
        <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>
          Vazgeç
        </Button>
      }
    >
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Field label="Mevcut şifre">{(p) => <Input {...p} name="current" type="password" required autoComplete="current-password" />}</Field>
        <Field label="Yeni şifre" hint="En az 10 karakter, harf ve rakam.">{(p) => <Input {...p} name="next" type="password" required minLength={10} autoComplete="new-password" />}</Field>
        <Field label="Yeni şifre (tekrar)">{(p) => <Input {...p} name="confirm" type="password" required minLength={10} autoComplete="new-password" />}</Field>
      </div>
    </ActionForm>
  );
}
