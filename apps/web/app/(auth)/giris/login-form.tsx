"use client";
import { useActionState, useState } from "react";
import { EyeIcon, EyeOffIcon } from "@/components/icons";
import { Field, Input } from "@/components/ui/form";
import { loginAction, type LoginState } from "./actions";
import { useT } from "@/lib/i18n/client";
const inputCls = "h-12 rounded-xl border-line bg-glass-strong text-[15px] focus:border-neon-pink/60";
export function LoginForm({ next }: { next: string | null }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(loginAction, { error: null, email: "" });
  const [show, setShow] = useState(false);
  const t = useT();
  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <Field label={t("auth.email", "E-posta")}>
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
      <Field label={t("auth.password", "Şifre")}>
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
              aria-label={show ? t("auth.hidePassword", "Şifreyi gizle") : t("auth.showPassword", "Şifreyi göster")}
              aria-pressed={show}
              className="absolute top-1/2 right-2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-fg-muted hover:bg-surface-hover hover:text-fg"
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
        className="group relative inline-flex h-12 w-full items-center justify-center overflow-hidden rounded-xl text-[15px] font-medium text-black transition-transform duration-300 hover:scale-[1.01] disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-neon-pink"
      >
        <span aria-hidden className="absolute inset-0 bg-[linear-gradient(90deg,#ff2bd6,#9d4dff,#00e5ff,#a3ff12,#ff2bd6)] bg-[length:300%_100%] animate-gradient-x" />
        <span className="relative">{pending ? t("auth.submitting", "Giriş yapılıyor…") : t("auth.submit", "Giriş yap →")}</span>
      </button>
    </form>
  );
}
