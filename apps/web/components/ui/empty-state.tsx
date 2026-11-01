import type { ReactNode } from "react";
import { ButtonLink } from "./form";

/** Boş durum: ince çizgi illüstrasyon + tek cümle + tek buton (href ya da özel düğme). */
export function EmptyState({
  message,
  action,
  children,
  illustration,
}: {
  message: string;
  action?: { label: string; href: string };
  /** action yerine özel bir düğme (ör. form gönderimi) */
  children?: ReactNode;
  illustration?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-6 rounded-[8px] border border-border px-6 py-16 text-center">
      {illustration ?? <DefaultIllustration />}
      <p className="max-w-md text-sm text-fg-muted">{message}</p>
      {action ? (
        <ButtonLink href={action.href} variant="secondary">
          {action.label}
        </ButtonLink>
      ) : (
        children
      )}
    </div>
  );
}

function DefaultIllustration() {
  return (
    <svg width="120" height="88" viewBox="0 0 120 88" fill="none" stroke="currentColor" strokeWidth={1} aria-hidden className="text-fg-passive">
      <rect x="18" y="14" width="84" height="60" rx="6" />
      <path d="M18 28h84" />
      <circle cx="27" cy="21" r="1.5" />
      <circle cx="34" cy="21" r="1.5" />
      <path d="M32 44h36M32 54h56M32 64h24" strokeLinecap="round" />
      <circle cx="88" cy="52" r="8" />
      <path d="m94 58 6 6" strokeLinecap="round" />
    </svg>
  );
}
