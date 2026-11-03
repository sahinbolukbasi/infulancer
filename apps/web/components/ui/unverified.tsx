import { UNVERIFIED_LABEL } from "@infulancer/core/unverified";

/** Doğrulanmamış rakam rozeti (kesin bilgi gibi gösterilmez). */
export function UnverifiedBadge({ verified = false, title }: { verified?: boolean; title?: string }) {
  if (verified) return null;
  return (
    <span
      className="ml-2 inline-flex items-center rounded-full border border-border px-2 py-0.5 text-[11px] uppercase tracking-wide text-fg-muted"
      title={title ?? "Bu değer birincil kaynaktan doğrulanmadı; kesin bilgi olarak kullanmayın."}
    >
      {UNVERIFIED_LABEL}
    </span>
  );
}

/** Kısa açıklayıcı not (tooltip yerine erişilebilir metin). */
export function InfoNote({ children }: { children: React.ReactNode }) {
  return (
    <p role="note" className="rounded-lg border border-border px-4 py-3 text-[13px] leading-relaxed text-fg-muted">
      {children}
    </p>
  );
}
