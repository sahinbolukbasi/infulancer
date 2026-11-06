"use client";
import { useState } from "react";
import { cn } from "@/lib/cn";

/**
 * Kopyalanabilir kod kutusu. "card" tonu beyaz bilet/kupon kartları için yüksek kontrastlıdır
 * (koyu metin, açık gri zemin); "app" tonu uygulama temasına uyar (tablolar, yönetim sayfaları).
 */
export function CopyCode({ code, label, tone = "card", size = "lg" }: { code: string; label?: string; tone?: "card" | "app"; size?: "sm" | "lg" }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* pano erişimi yoksa sessiz */
    }
  };
  const card = tone === "card";
  return (
    <div className={cn("flex flex-col gap-1", size === "lg" ? "items-center" : "items-start")}>
      {label ? <span className={cn("text-[11px] font-medium uppercase tracking-[0.12em]", card ? "text-[#6b6b80]" : "text-fg-muted")}>{label}</span> : null}
      <button
        type="button"
        onClick={copy}
        aria-label={copied ? "Kod kopyalandı" : `Kodu kopyala: ${code}`}
        className={cn(
          "group inline-flex items-center gap-2.5 rounded-xl border font-mono font-semibold transition-standard",
          size === "lg" ? "px-4 py-2.5 text-[17px] tracking-[0.16em]" : "px-2.5 py-1 text-[13px] tracking-[0.08em]",
          card
            ? "border-[#e3e3eb] bg-[#f4f4f8] text-[#0b0b14] hover:border-[#c9c9d6] hover:bg-[#ececf3]"
            : "border-line bg-surface text-fg hover:border-line-strong",
        )}
      >
        <span>{code}</span>
        <svg width={size === "lg" ? 16 : 13} height={size === "lg" ? 16 : 13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={cn("shrink-0", copied ? "text-emerald-500" : "opacity-50 group-hover:opacity-90")} aria-hidden>
          {copied ? (
            <path d="M20 6 9 17l-5-5" />
          ) : (
            <>
              <rect x="9" y="9" width="12" height="12" rx="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </>
          )}
        </svg>
      </button>
      <span role="status" aria-live="polite" className={cn("text-[11px]", copied ? "text-emerald-500" : card ? "text-[#8e8ea3]" : "text-fg-passive", size === "sm" && !copied && "sr-only")}>
        {copied ? "Kopyalandı" : "Kopyalamak için dokunun"}
      </span>
    </div>
  );
}
