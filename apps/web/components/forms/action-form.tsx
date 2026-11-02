"use client";

import { startTransition, useActionState, useEffect, useRef, type ReactNode } from "react";
import { Button } from "@/components/ui/form";
import { idleState, type ActionState } from "@/lib/action-state";
import { cn } from "@/lib/cn";

export type FormAction = (prev: ActionState, fd: FormData) => Promise<ActionState>;

/**
 * Server Action formu: useActionState + Türkçe hata/başarı mesajı.
 * React 19'un otomatik form sıfırlamasını önlemek için gönderim onSubmit'te yapılır
 * (hata durumunda kullanıcının girdiği değerler korunur).
 */
export function ActionForm({
  action,
  children,
  className,
  submitLabel,
  submitVariant = "primary",
  submitSize = "md",
  resetOnSuccess = false,
  onSuccess,
  footer,
  "aria-label": ariaLabel,
}: {
  action: FormAction;
  children?: ReactNode;
  className?: string;
  submitLabel?: string;
  submitVariant?: "primary" | "secondary" | "ghost";
  submitSize?: "sm" | "md";
  resetOnSuccess?: boolean;
  onSuccess?: (state: ActionState) => void;
  footer?: ReactNode;
  "aria-label"?: string;
}) {
  const [state, formAction, pending] = useActionState(action, idleState);
  const ref = useRef<HTMLFormElement>(null);
  const onSuccessRef = useRef(onSuccess);

  useEffect(() => {
    onSuccessRef.current = onSuccess;
  }, [onSuccess]);

  useEffect(() => {
    if (!state.ok) return;
    if (resetOnSuccess) ref.current?.reset();
    onSuccessRef.current?.(state);
  }, [state, resetOnSuccess]);

  return (
    <form
      ref={ref}
      aria-label={ariaLabel}
      className={cn("flex flex-col gap-4", className)}
      onSubmit={(e) => {
        e.preventDefault();
        const submitter = (e.nativeEvent as SubmitEvent).submitter;
        const fd = new FormData(e.currentTarget, submitter);
        startTransition(() => formAction(fd));
      }}
    >
      <fieldset disabled={pending} className="contents">
        {children}
      </fieldset>
      <FormMessage state={state} />
      {submitLabel || footer ? (
        <div className="flex flex-wrap items-center gap-2">
          {submitLabel ? (
            <Button type="submit" variant={submitVariant} size={submitSize} disabled={pending}>
              {pending ? "İşleniyor…" : submitLabel}
            </Button>
          ) : null}
          {footer}
        </div>
      ) : null}
    </form>
  );
}

export function FormMessage({ state }: { state: ActionState }) {
  if (state.error) {
    return (
      <div role="alert" className="flex flex-col gap-2 rounded-[8px] border border-critical/40 px-3 py-2 text-[13px] text-critical">
        <p>{state.conflicts?.length ? "Marka çakışması bulundu:" : state.error}</p>
        {state.conflicts?.length ? (
          <ul className="list-disc pl-4 text-fg-muted">
            {state.conflicts.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        ) : null}
      </div>
    );
  }
  if (state.ok && state.message) {
    return (
      <p role="status" className="text-[13px] text-fg-muted">
        {state.message}
      </p>
    );
  }
  return null;
}
