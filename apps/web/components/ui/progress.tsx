import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/cn";

const pct = new Intl.NumberFormat("tr-TR", { style: "percent", maximumFractionDigits: 0 });

/** Soldan sağa dolan ilerleme çubuğu. value: 0..1 (üstü 1'e kırpılır). */
export function ProgressBar({ value, label, className }: { value: number; label: string; className?: string }) {
  const clamped = Math.max(0, Math.min(1, value));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped * 100)}
      className={cn("h-1.5 w-full overflow-hidden rounded-full bg-border", className)}
    >
      <div className="h-full origin-left animate-fill rounded-full bg-fg" style={{ width: `${clamped * 100}%` }} />
    </div>
  );
}

/**
 * Kalın skor halkası: saat yönünde çizilerek dolar, ortada yüzde.
 * value bir orandır (1 = %100); halka %100'de dolar, metin kırpılmaz.
 */
export function ScoreRing({
  value,
  size = 168,
  valueSize = 36,
  label = "Kampanya skoru",
  children,
}: {
  value: number;
  size?: number;
  /** Ortadaki yüzde metninin piksel boyutu. */
  valueSize?: number;
  label?: string;
  children?: ReactNode;
}) {
  const stroke = 12;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const filled = Math.max(0, Math.min(1, value));
  const offset = c * (1 - filled);
  return (
    <div className="flex flex-col items-center gap-6">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${label}: ${pct.format(value)}`}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-border)" strokeWidth={stroke} />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="var(--color-fg)"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={offset}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            className="animate-draw"
            style={{ "--draw-length": c, "--draw-offset": offset } as CSSProperties}
          />
        </svg>
        <div aria-hidden className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="leading-none font-semibold tabular-nums" style={{ fontSize: valueSize }}>
            {pct.format(value)}
          </span>
          <span className="mt-1 text-label text-fg-passive">{label}</span>
        </div>
      </div>
      {children ? <div className="w-full">{children}</div> : null}
    </div>
  );
}
