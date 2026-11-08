"use client";
import { useTT } from "@/lib/i18n/tt-client";
import { ActionForm } from "@/components/forms/action-form";
import { Field, Input, Select } from "@/components/ui/form";
import { createStaffUserAction, setStaffRoleAction, setUserStatusAction } from "@/lib/actions/users";

/** Satır içi askıya al / etkinleştir düğmesi. */
export function UserStatusButton({ userId, status, name }: { userId: string; status: "ACTIVE" | "SUSPENDED"; name: string }) {
  const tt = useTT();
  const next = status === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
  return (
    <ActionForm
      action={setUserStatusAction}
      submitLabel={next === "SUSPENDED" ? tt("Askıya al") : tt("Etkinleştir")}
      submitVariant={next === "SUSPENDED" ? "ghost" : "secondary"}
      submitSize="sm"
      aria-label={`${name}: ${next === "SUSPENDED" ? "askıya al" : "etkinleştir"}`}
      className="gap-1"
    >
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="status" value={next} />
    </ActionForm>
  );
}

/** Ajans ekibi rol değiştirici (Admin ↔ Ajans). */
export function StaffRoleButton({ userId, role, name }: { userId: string; role: "ADMIN" | "AGENCY"; name: string }) {
  const tt = useTT();
  const next = role === "ADMIN" ? "AGENCY" : "ADMIN";
  return (
    <ActionForm action={setStaffRoleAction} submitLabel={next === "ADMIN" ? tt("Admin yap") : tt("Ajans yap")} submitVariant="ghost" submitSize="sm" aria-label={`${name}: rolü değiştir`} className="gap-1">
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="role" value={next} />
    </ActionForm>
  );
}

/** Ajans ekibine kullanıcı ekleme formu. */
export function StaffUserForm() {
  const tt = useTT();
  return (
    <ActionForm action={createStaffUserAction} submitLabel={tt("Ekip üyesi ekle")} resetOnSuccess aria-label={tt("Ajans ekibine kullanıcı ekle")}>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <Field label={tt("Ad soyad")}>{(p) => <Input {...p} name="name" required />}</Field>
        <Field label={tt("E-posta")}>{(p) => <Input {...p} name="email" type="email" required autoComplete="off" />}</Field>
        <Field label={tt("Geçici şifre")}>{(p) => <Input {...p} name="password" type="text" required minLength={10} autoComplete="new-password" />}</Field>
        <Field label={tt("Rol")}>
          {(p) => (
            <Select {...p} name="role" defaultValue="AGENCY">
              <option value="AGENCY">{tt("Ajans (operasyon)")}</option>
              <option value="ADMIN">{tt("Admin (tam yetki)")}</option>
            </Select>
          )}
        </Field>
      </div>
    </ActionForm>
  );
}
