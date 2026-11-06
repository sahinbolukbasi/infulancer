import Link from "next/link";
import { cn } from "@/lib/cn";
import { dayMonthShort, timeShort, weekdayLong } from "@/lib/event-format";
import { DateBadge, Pill, type PillTone } from "./primitives";

/** Etkinlik durum etiketi ve tonu. */
export const eventStatusView: Record<string, { label: string; tone: PillTone }> = {
  TASLAK: { label: "Taslak", tone: "gray" },
  YAYINDA: { label: "Yayında", tone: "green" },
  IPTAL: { label: "İptal", tone: "red" },
  TAMAMLANDI: { label: "Tamamlandı", tone: "violet" },
};
export const couponStatusView: Record<string, { label: string; tone: PillTone }> = {
  TASLAK: { label: "Taslak", tone: "gray" },
  YAYINDA: { label: "Yayında", tone: "green" },
  PASIF: { label: "Pasif", tone: "amber" },
};

export type EventListItemData = {
  id: string;
  href: string;
  title: string;
  organizer: string;
  startsAt: Date;
  venueLabel?: string | null;
  coverSrc?: string | null;
  status: string;
  visibility: string;
  guests: number;
  going: number;
  capacity?: number | null;
};

/** Luma zaman çizelgesi satırı: solda gün, sağda kart (saat, başlık, konum, misafir, kapak). */
export function EventListItem({ e }: { e: EventListItemData }) {
  const st = eventStatusView[e.status] ?? { label: e.status, tone: "gray" as PillTone };
  return (
    <li className="grid grid-cols-[3.5rem_1fr] gap-4 sm:grid-cols-[7rem_1fr]">
      <div className="pt-1">
        <div className="sm:hidden">
          <DateBadge date={e.startsAt} size="sm" />
        </div>
        <div className="hidden flex-col text-right sm:flex">
          <span className="text-[15px] font-semibold text-fg">{dayMonthShort(e.startsAt)}</span>
          <span className="text-[12px] text-fg-muted">{weekdayLong(e.startsAt)}</span>
        </div>
      </div>
      <Link href={e.href} className="group flex items-start gap-4 rounded-2xl border border-line bg-surface p-4 transition-standard hover:border-line-strong">
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <span className="text-[13px] text-fg-muted tabular-nums">{timeShort(e.startsAt)}</span>
          <span className="text-[17px] font-semibold leading-snug text-fg group-hover:underline group-hover:underline-offset-4">{e.title}</span>
          <span className="truncate text-[13px] text-fg-muted">{e.organizer}{e.venueLabel ? ` · ${e.venueLabel}` : ""}</span>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <Pill tone={st.tone}>{st.label}</Pill>
            <Pill>{e.visibility === "HERKESE_ACIK" ? "Herkese açık" : "Davetli"}</Pill>
            <span className="text-[12px] text-fg-muted tabular-nums">
              {e.going} katılımcı · {e.guests} davet{e.capacity ? ` · ${e.capacity} kapasite` : ""}
            </span>
          </div>
        </div>
        <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-line sm:h-24 sm:w-24">
          {e.coverSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={e.coverSrc} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full bg-[linear-gradient(135deg,var(--color-neon-violet),var(--color-neon-pink))] opacity-80" />
          )}
        </div>
      </Link>
    </li>
  );
}

export type CouponTileData = {
  id: string;
  href: string;
  title: string;
  brandName: string;
  kindLabel: string;
  valueLabel: string;
  status?: string | null;
  statusOverride?: { label: string; tone: PillTone } | null;
  accent: string;
  logoSrc?: string | null;
  sent?: number;
  used?: number;
  validLabel?: string | null;
  expired?: boolean;
};

/** Mini kupon kartı (liste için). */
export function CouponTile({ c }: { c: CouponTileData }) {
  const st = c.statusOverride ?? (c.status ? couponStatusView[c.status] : null);
  return (
    <li>
      <Link href={c.href} className="group flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-surface transition-standard hover:border-line-strong">
        <div className="relative flex items-center gap-3 px-4 py-4 text-white" style={{ background: `linear-gradient(140deg, ${c.accent} 0%, #111827 140%)` }}>
          {c.logoSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={c.logoSrc} alt="" className="h-9 w-9 rounded-lg bg-white object-cover" />
          ) : (
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/90 text-[13px] font-bold text-[#0b0b14]" aria-hidden>
              {c.brandName.slice(0, 1).toLocaleUpperCase("tr")}
            </span>
          )}
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-[12px] text-white/80">{c.brandName} · {c.kindLabel}</span>
            <span className="text-xl font-bold leading-tight">{c.valueLabel}</span>
          </div>
        </div>
        <div className="flex flex-1 flex-col gap-2 p-4">
          <span className="font-semibold leading-snug text-fg group-hover:underline group-hover:underline-offset-4">{c.title}</span>
          <div className="mt-auto flex flex-wrap items-center gap-2">
            {st ? <Pill tone={st.tone}>{st.label}</Pill> : null}
            {c.sent != null ? <span className="text-[12px] tabular-nums text-fg-muted">{c.sent} gönderim · {c.used ?? 0} kullanım</span> : null}
          </div>
          {c.validLabel ? <span className={cn("text-[12px]", c.expired ? "text-red-500" : "text-fg-passive")}>{c.expired ? "Süresi doldu" : c.validLabel}</span> : null}
        </div>
      </Link>
    </li>
  );
}
