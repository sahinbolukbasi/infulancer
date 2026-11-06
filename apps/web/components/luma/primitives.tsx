import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { dayNum, monthShort } from "@/lib/event-format";

/**
 * Luma tarzı sade yapı taşları. "use client" YOK ve sunucuya özel import YOK:
 * hem sunucu sayfalarında hem istemci önizlemelerinde kullanılabilir.
 */

/** Ay + gün rozeti ("KAS / 12"). */
export function DateBadge({ date, size = "md" }: { date: Date; size?: "sm" | "md" }) {
  return (
    <div
      className={cn(
        "flex shrink-0 flex-col items-center justify-center overflow-hidden rounded-xl border border-line bg-surface text-center",
        size === "sm" ? "h-11 w-11" : "h-14 w-14",
      )}
      aria-hidden
    >
      <span className={cn("w-full bg-surface-hover font-semibold tracking-wide text-fg-muted", size === "sm" ? "text-[9px] leading-4" : "text-[10px] leading-5")}>{monthShort(date)}</span>
      <span className={cn("font-semibold tabular-nums text-fg", size === "sm" ? "text-base leading-6" : "text-xl leading-8")}>{dayNum(date)}</span>
    </div>
  );
}

export type PillTone = "green" | "amber" | "red" | "gray" | "violet";
const pillTone: Record<PillTone, string> = {
  green: "bg-emerald-500/12 text-emerald-500 ring-emerald-500/25",
  amber: "bg-amber-500/12 text-amber-600 ring-amber-500/25",
  red: "bg-red-500/12 text-red-500 ring-red-500/25",
  gray: "bg-fg/5 text-fg-muted ring-line",
  violet: "bg-violet-500/12 text-violet-500 ring-violet-500/25",
};
/** Küçük durum etiketi. */
export function Pill({ tone = "gray", children, className }: { tone?: PillTone; children: ReactNode; className?: string }) {
  return <span className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[12px] font-medium ring-1 ring-inset", pillTone[tone], className)}>{children}</span>;
}

export type Stat = { label: string; value: string; hint?: string };
/** Yatay analitik şeridi. */
export function StatStrip({ stats }: { stats: Stat[] }) {
  return (
    <dl className="grid grid-cols-2 overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-3 lg:grid-cols-6" style={{ gap: 1 }}>
      {stats.map((s) => (
        <div key={s.label} className="flex flex-col gap-0.5 bg-surface px-4 py-3">
          <dt className="text-[12px] text-fg-muted">{s.label}</dt>
          <dd className="text-xl font-semibold tabular-nums text-fg">{s.value}</dd>
          {s.hint ? <dd className="text-[11px] text-fg-passive">{s.hint}</dd> : null}
        </div>
      ))}
    </dl>
  );
}

/** Üst geri bağlantısı. */
export function BackLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="inline-flex w-fit items-center gap-1 text-[13px] text-fg-muted transition-standard hover:text-fg">
      <span aria-hidden>←</span> {children}
    </Link>
  );
}

/** Basit filtre sekmeleri (bağlantı tabanlı; sayfa durumu URL'de). */
export function FilterTabs({ items, active }: { items: { id: string; label: string; href: string; count?: number }[]; active: string }) {
  return (
    <nav aria-label="Filtre" className="flex flex-wrap gap-1 rounded-full border border-line bg-surface p-1 text-[13px]">
      {items.map((i) => (
        <Link
          key={i.id}
          href={i.href}
          aria-current={i.id === active ? "page" : undefined}
          className={cn("rounded-full px-3 py-1 transition-standard", i.id === active ? "bg-fg text-bg" : "text-fg-muted hover:text-fg")}
        >
          {i.label}
          {i.count != null ? <span className="ml-1 tabular-nums opacity-60">{i.count}</span> : null}
        </Link>
      ))}
    </nav>
  );
}

/** İkonlu bilgi satırı (Luma etkinlik sayfasındaki tarih/konum satırları gibi). */
export function InfoRow({ icon, title, children }: { icon: ReactNode; title: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-line bg-surface text-fg-muted" aria-hidden>
        {icon}
      </span>
      <div className="flex min-w-0 flex-col">
        <span className="font-medium text-fg">{title}</span>
        {children ? <span className="text-[13px] text-fg-muted">{children}</span> : null}
      </div>
    </div>
  );
}

/** Bölüm başlığı. */
export function SectionHead({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-line pb-2">
      <h2 className="text-[15px] font-semibold text-fg">{title}</h2>
      {action}
    </div>
  );
}

/** Önizleme ve boş durumlar için QR yer tutucusu. */
export function QrPlaceholder({ size = 132 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 21 21" className="rounded-lg bg-white p-2" aria-label="QR kod önizlemesi" role="img">
      {[
        [0, 0], [14, 0], [0, 14],
      ].map(([x, y]) => (
        <g key={`${x}-${y}`} fill="#0b0b14">
          <rect x={x} y={y} width="7" height="7" />
          <rect x={x! + 1} y={y! + 1} width="5" height="5" fill="#fff" />
          <rect x={x! + 2} y={y! + 2} width="3" height="3" />
        </g>
      ))}
      {[[9, 1], [10, 3], [8, 5], [12, 8], [9, 9], [16, 9], [18, 11], [9, 12], [11, 14], [15, 15], [17, 17], [10, 18], [13, 19], [19, 19]].map(([x, y]) => (
        <rect key={`${x}-${y}`} x={x} y={y} width="1.6" height="1.6" fill="#0b0b14" />
      ))}
    </svg>
  );
}

/** Takvim ikonu. */
export function CalIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <rect x="3" y="5" width="18" height="16" rx="3" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </svg>
  );
}
/** Konum ikonu. */
export function PinIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M12 21s-7-6.1-7-11.5A7 7 0 0 1 19 9.5C19 14.9 12 21 12 21Z" />
      <circle cx="12" cy="9.5" r="2.5" />
    </svg>
  );
}
/** Kişi ikonu. */
export function PersonIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </svg>
  );
}
/** Etiket ikonu. */
export function TagIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8Z" />
      <circle cx="7.5" cy="7.5" r="1.5" />
    </svg>
  );
}
