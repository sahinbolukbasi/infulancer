import type { ReactNode } from "react";
import { CopyCode } from "@/components/wallet/copy-code";
import { cn } from "@/lib/cn";
import { QrPlaceholder } from "./primitives";

/**
 * Bilet ve kupon kartları (Apple Wallet benzeri). Gövde her temada beyazdır: kod ve QR her
 * zaman yüksek kontrastla okunur. "use client" yok; hem sunucu sayfalarında hem canlı
 * önizlemede kullanılır. Sunucuya özel import içermez.
 */

/** Kartın iki yanındaki yarım daire kesikler + kesikli çizgi. */
function Perforation() {
  return (
    <div className="relative flex items-center" aria-hidden>
      <span className="-ml-3 h-6 w-6 shrink-0 rounded-full bg-bg" />
      <span className="mx-2 flex-1 border-t-2 border-dashed border-[#e3e3eb]" />
      <span className="-mr-3 h-6 w-6 shrink-0 rounded-full bg-bg" />
    </div>
  );
}

export type TicketCardProps = {
  title: string;
  organizer: string;
  holderName: string;
  dateLabel: string;
  venueLabel?: string | null;
  code: string;
  statusLabel: string;
  statusTone: "ok" | "used" | "void";
  coverSrc?: string | null;
  accent?: string;
  qr?: ReactNode;
  className?: string;
};

const ticketStatus: Record<TicketCardProps["statusTone"], string> = {
  ok: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  used: "bg-[#f1f1f5] text-[#4f4f63] ring-[#e3e3eb]",
  void: "bg-red-50 text-red-600 ring-red-200",
};

export function TicketCard({ title, organizer, holderName, dateLabel, venueLabel, code, statusLabel, statusTone, coverSrc, accent = "#7c3aed", qr, className }: TicketCardProps) {
  return (
    <article aria-label={`${title} bileti`} className={cn("w-full max-w-sm overflow-hidden rounded-[28px] bg-white text-[#0b0b14] ring-1 ring-black/10", className)}>
      <div className="relative h-36">
        {coverSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={coverSrc} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full" style={{ background: `linear-gradient(135deg, ${accent} 0%, #1e1b4b 100%)` }} />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
        <div className="absolute left-4 right-4 top-4 flex items-center justify-between gap-2">
          <span className="truncate rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-[#0b0b14]">{organizer}</span>
          <span className="rounded-full bg-black/40 px-2.5 py-1 text-[11px] font-medium uppercase tracking-wider text-white backdrop-blur">Bilet</span>
        </div>
      </div>

      <div className="flex flex-col gap-1 px-6 pb-4 pt-5">
        <h2 className="text-[19px] font-semibold leading-snug">{title}</h2>
        <p className="text-[13px] text-[#4f4f63]">{dateLabel}</p>
        {venueLabel ? <p className="text-[13px] text-[#4f4f63]">{venueLabel}</p> : null}
      </div>

      <dl className="mx-6 grid grid-cols-2 gap-3 rounded-2xl bg-[#f7f7fa] p-4">
        <div className="min-w-0">
          <dt className="text-[10px] font-medium uppercase tracking-[0.12em] text-[#8e8ea3]">Bilet sahibi</dt>
          <dd className="truncate text-[15px] font-semibold">{holderName}</dd>
        </div>
        <div className="flex flex-col items-start">
          <dt className="text-[10px] font-medium uppercase tracking-[0.12em] text-[#8e8ea3]">Durum</dt>
          <dd className={cn("mt-0.5 rounded-full px-2 py-0.5 text-[12px] font-semibold ring-1 ring-inset", ticketStatus[statusTone])}>{statusLabel}</dd>
        </div>
      </dl>

      <div className="py-4">
        <Perforation />
      </div>

      <div className="flex flex-col items-center gap-3 px-6 pb-7">
        {qr ?? <QrPlaceholder />}
        <CopyCode code={code} label="Bilet kodu" />
      </div>
    </article>
  );
}

export type CouponCardProps = {
  kindLabel: string;
  title: string;
  brandName: string;
  valueLabel: string;
  code: string;
  codeHint?: string;
  validLabel?: string | null;
  expired?: boolean;
  statusLabel?: string | null;
  logoSrc?: string | null;
  heroSrc?: string | null;
  accent?: string;
  qr?: ReactNode;
  className?: string;
};

export function CouponCard({ kindLabel, title, brandName, valueLabel, code, codeHint, validLabel, expired, statusLabel, logoSrc, heroSrc, accent = "#ff2bd6", qr, className }: CouponCardProps) {
  return (
    <article aria-label={`${title} ${kindLabel.toLocaleLowerCase("tr")}`} className={cn("w-full max-w-sm overflow-hidden rounded-[28px] bg-white text-[#0b0b14] ring-1 ring-black/10", className)}>
      <div className="relative px-6 pb-6 pt-5 text-white" style={{ background: `linear-gradient(140deg, ${accent} 0%, #111827 135%)` }}>
        {heroSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={heroSrc} alt="" className="absolute inset-0 h-full w-full object-cover opacity-35" />
        ) : null}
        <div className="relative flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            {logoSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoSrc} alt={`${brandName} logosu`} className="h-10 w-10 rounded-xl bg-white object-cover ring-2 ring-white/60" />
            ) : (
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/90 text-[15px] font-bold text-[#0b0b14]" aria-hidden>
                {brandName.slice(0, 1).toLocaleUpperCase("tr")}
              </span>
            )}
            <span className="truncate text-[13px] font-semibold">{brandName}</span>
          </div>
          <span className="rounded-full bg-white/20 px-2.5 py-1 text-[11px] font-medium uppercase tracking-wider backdrop-blur">{kindLabel}</span>
        </div>
        <p className="relative mt-6 text-[34px] font-bold leading-none tracking-tight">{valueLabel}</p>
        <p className="relative mt-2 text-[15px] font-medium text-white/90">{title}</p>
      </div>

      <div className="py-4">
        <Perforation />
      </div>

      <div className="flex flex-col items-center gap-3 px-6 pb-6">
        {qr ?? <QrPlaceholder />}
        <CopyCode code={code} label="Kupon kodu" />
        {codeHint ? <p className="text-center text-[11px] text-[#8e8ea3]">{codeHint}</p> : null}
        <div className="flex w-full items-center justify-between gap-2 border-t border-[#eeeef3] pt-3 text-[12px]">
          <span className={expired ? "font-medium text-red-600" : "text-[#4f4f63]"}>{expired ? "Süresi doldu" : (validLabel ?? "Süresiz")}</span>
          {statusLabel ? <span className="font-medium text-[#4f4f63]">{statusLabel}</span> : null}
        </div>
      </div>
    </article>
  );
}
