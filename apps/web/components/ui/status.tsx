"use client";
import { useTT } from "@/lib/i18n/tt-client";
import type { ReactNode } from "react";
import type { Severity } from "@infulancer/core/enums";
import { cn } from "@/lib/cn";

/** Durum tonu: renk yerine opaklık. Yalnız "critical" #EF4444 kullanır. */
export type StatusTone = "active" | "muted" | "passive" | "critical";

const dotTone: Record<StatusTone, string> = {
  active: "bg-fg",
  muted: "bg-fg opacity-60",
  passive: "bg-fg opacity-25",
  critical: "bg-critical",
};
const textTone: Record<StatusTone, string> = {
  active: "text-fg",
  muted: "text-fg-muted",
  passive: "text-fg-passive",
  critical: "text-critical",
};

/** 6px dolu nokta + metin (pill değil). */
export function StatusDot({ tone = "active", children, className }: { tone?: StatusTone; children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 text-sm", textTone[tone], className)}>
      <span aria-hidden className={cn("h-1.5 w-1.5 shrink-0 rounded-full", dotTone[tone])} />
      {children}
    </span>
  );
}

export function severityTone(severity: Severity): StatusTone {
  return severity === "KRITIK" ? "critical" : severity === "UYARI" ? "muted" : "passive";
}

const lineTone: Record<Severity, string> = {
  BILGI: "bg-fg-passive",
  UYARI: "bg-fg-muted",
  KRITIK: "bg-critical",
};

/** Aksiyon kuyruğu öğesi: sol kenarda 2px çizgi; önem çizginin parlaklığıyla verilir. */
export function ActionQueueItem({
  severity,
  title,
  meta,
  severityLabel,
  actions,
  children,
}: {
  severity: Severity;
  title: ReactNode;
  meta?: ReactNode;
  severityLabel?: string;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  const tt = useTT();
  return (
    <li className="relative flex flex-col gap-3 rounded-[8px] border border-border bg-surface py-4 pr-4 pl-6 transition-standard hover:border-border-strong sm:flex-row sm:items-center sm:justify-between">
      <span aria-hidden className={cn("absolute top-3 bottom-3 left-0 w-0.5 rounded-full", lineTone[severity])} />
      <div className="flex min-w-0 flex-col gap-1">
        {severityLabel ? <span className="sr-only">{tt("Önem:")}{" "}{severityLabel}.</span> : null}
        <div className={cn("text-sm font-medium", severity === "KRITIK" ? "text-fg" : severity === "UYARI" ? "text-fg" : "text-fg-muted")}>
          {title}
        </div>
        {meta ? <div className="text-[13px] text-fg-passive">{meta}</div> : null}
        {children}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </li>
  );
}
