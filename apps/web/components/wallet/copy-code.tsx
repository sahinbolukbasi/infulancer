"use client";
import { useState } from "react";

/** Kod kutusu + kopyalama ikonu. Tıklanınca panoya kopyalar, kısa süre "Kopyalandı" gösterir. */
export function CopyCode({ code, label }: { code: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* pano erişimi yoksa sessiz */
    }
  };
  return (
    <div className="flex flex-col items-center gap-1">
      {label ? <span className="text-[11px] uppercase tracking-wide text-white/40">{label}</span> : null}
      <button
        type="button"
        onClick={copy}
        aria-label="Kodu kopyala"
        className="group inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2 font-mono text-lg tracking-[0.3em] text-white transition-standard hover:border-neon-pink hover:bg-white/10"
      >
        <span>{code}</span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="opacity-60 group-hover:opacity-100" aria-hidden>
          {copied ? (
            <path d="M20 6 9 17l-5-5" />
          ) : (
            <>
              <rect x="9" y="9" width="13" height="13" rx="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </>
          )}
        </svg>
      </button>
      <span className={`text-[11px] transition-standard ${copied ? "text-neon-lime" : "text-white/30"}`}>{copied ? "Kopyalandı ✓" : "Kopyalamak için tıklayın"}</span>
    </div>
  );
}
