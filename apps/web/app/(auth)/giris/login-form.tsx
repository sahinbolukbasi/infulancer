"use client";

import { useActionState } from "react";
import { Button, Field, Input } from "@/components/ui/form";
import { loginAction, type LoginState } from "./actions";

export function LoginForm({ next }: { next: string | null }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(loginAction, { error: null, email: "" });
  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <Field label="E-posta">
        {(p) => (
          <Input {...p} name="email" type="email" autoComplete="email" required defaultValue={state.email} aria-invalid={state.error ? true : undefined} />
        )}
      </Field>
      <Field label="Şifre">
        {(p) => <Input {...p} name="password" type="password" autoComplete="current-password" required aria-invalid={state.error ? true : undefined} />}
      </Field>
      <p role="alert" aria-live="polite" className="min-h-5 text-[13px] text-fg">
        {state.error}
      </p>
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Giriş yapılıyor…" : "Giriş yap"}
      </Button>
    </form>
  );
}
