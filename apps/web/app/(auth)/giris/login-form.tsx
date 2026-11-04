"use client";
import { useActionState, useState } from "react";
import { EyeIcon, EyeOffIcon } from "@/components/icons";
import { Field, Input } from "@/components/ui/form";
import { loginAction, type LoginState } from "./actions";
const inputCls = "h-12 rounded-xl border-white/10 bg-black/30 text-[15px] focus:border-fuchsia-300/60";
export function LoginForm({ next }: { next: string | null }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(loginAction, { error: null, email: "" });
  const [show, setShow] = useState(false);
  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <Field label="E-posta">
        {(p) => (
          <Input
            {...p}
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="ad@sirket.com"
            defaultValue={state.email}
            aria-invalid={state.error ? true : undefined}
            className={inputCls}
          />
        )}
      </Field>
      <Field label="Şifre">
        {(p) => (
          <div className="relative">
            <Input
              {...p}
              name="password"
              type={show ? "text" : "password"}
              autoComplete="current-password"
              required
              aria-invalid={state.error ? true : undefined}
              className={`${inputCls} pr-12`}
            />
            <button
              type="button"
              onClick={() => setShow((v) => !v)}
              aria-label={show ? "Şifreyi gizle" : "Şifreyi göster"}
              aria-pressed={show}
              className="absolute top-1/2 right-2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-fg-muted hover:bg-white/10 hover:text-fg"
            >
              {show ? <EyeOffIcon size={18} /> : <EyeIcon size={18} />}
            </button>
          </div>
        )}
      </Field>
      <p role="alert" aria-live="polite" className="min-h-5 text-[13px] text-critical">
        {state.error}
      </p>
      <button
        type="submit"
        disabled={pending}
        className="group relative inline-flex h-12 w-full items-center justify-center overflow-hidden rounded-xl text-[15px] font-medium text-black transition-transform duration-300 hover:scale-[1.01] disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
      >
        <span aria-hidden className="absolute inset-0 bg-[linear-gradient(90deg,#f0abfc,#a78bfa,#60a5fa,#34d399,#f0abfc)] bg-[length:300%_100%] animate-gradient-x" />
        <span className="relative">{pending ? "Giriş yapılıyor…" : "Giriş yap →"}</span>
      </button>
    </form>
  );
}
