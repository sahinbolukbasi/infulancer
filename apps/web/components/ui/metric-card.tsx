"use client";

import { useEffect, useState } from "react";
import { ArrowDownIcon, ArrowUpIcon } from "@/components/icons";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import { cn } from "@/lib/cn";

const DURATION = 600;

/** 0'dan hedefe 600ms'de sayan değer (requestAnimationFrame; az hareket tercihinde direkt hedef). */
function useCountUp(target: number): number {
  const reduced = useReducedMotion();
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (reduced) return;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / DURATION);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(target * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, reduced]);
  return reduced ? target : value;
}

export function Sparkline({ data, className }: { data: number[]; className?: string }) {
  if (data.length < 2) return null;
  const w = 120;
  const h = 32;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const points = data
    .map((v, i) => `${((i / (data.length - 1)) * w).toFixed(1)},${(h - 2 - ((v - min) / span) * (h - 4)).toFixed(1)}`)
    .join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} preserveAspectRatio="none" aria-hidden className={className}>
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

export type MetricCardProps = {
  label: string;
  value: number;
  /** Görüntüleme biçimi; varsayılan tr-TR tamsayı. */
  format?: "number" | "percent" | "currency-kurus";
  /** Önceki döneme göre değişim (oran; 0.12 = %12). */
  delta?: number | null;
  sparkline?: number[];
  hint?: string;
};

const nf = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 0 });
const pf = new Intl.NumberFormat("tr-TR", { style: "percent", maximumFractionDigits: 1 });
const cf = new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 });

function formatValue(v: number, format: MetricCardProps["format"]) {
  if (format === "percent") return pf.format(v);
  if (format === "currency-kurus") return cf.format(v / 100);
  return nf.format(Math.round(v));
}

export function MetricCard({ label, value, format = "number", delta, sparkline, hint }: MetricCardProps) {
  const shown = useCountUp(value);
  const up = (delta ?? 0) >= 0;
  return (
    <div className="flex flex-col gap-4 rounded-[8px] border border-border bg-surface p-6 transition-standard hover:-translate-y-px hover:border-border-strong">
      <p className="text-label text-fg-muted">{label}</p>
      <p className="text-metric text-fg" aria-label={`${label}: ${formatValue(value, format)}`}>
        <span aria-hidden>{formatValue(shown, format)}</span>
      </p>
      <div className="flex items-center justify-between gap-4">
        {delta != null ? (
          <span className={cn("inline-flex items-center gap-1 text-[13px] tabular-nums", up ? "text-fg" : "text-fg-muted")}>
            {up ? <ArrowUpIcon size={14} /> : <ArrowDownIcon size={14} />}
            <span className="sr-only">{up ? "Artış" : "Düşüş"}</span>
            {pf.format(Math.abs(delta))}
          </span>
        ) : hint ? (
          <span className="text-[13px] text-fg-passive">{hint}</span>
        ) : (
          <span />
        )}
        {sparkline ? <Sparkline data={sparkline} className="w-28 text-fg-muted" /> : null}
      </div>
    </div>
  );
}
