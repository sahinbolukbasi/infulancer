import { getTT } from "@/lib/i18n/tt-server";
import Link from "next/link";
import { cn } from "@/lib/cn";

export type StatusCardItem = { title: string; state: "ok" | "warn" | "bad"; value: string; text: string; href?: string; action?: string };
const STYLE = {
  ok: { ring: "border-neon-lime/40", dot: "bg-neon-lime", label: "Tamam" },
  warn: { ring: "border-neon-amber/50", dot: "bg-neon-amber", label: "Dikkat" },
  bad: { ring: "border-critical/60", dot: "bg-critical", label: "Eksik" },
} as const;

/** Büyük durum kartları: yeşil/sarı/kırmızı + tek cümle + "düzelt" butonu. */
export async function StatusCards({ items }: { items: StatusCardItem[] }) {
  const tt = await getTT();
  return (
    <ul className={cn("grid grid-cols-1 gap-4 sm:grid-cols-2", items.length >= 4 ? "xl:grid-cols-4" : "lg:grid-cols-3")}>
      {items.map((it) => {
        const st = STYLE[it.state];
        return (
          <li key={it.title} className={cn("flex flex-col gap-3 rounded-3xl border bg-glass p-5", st.ring)}>
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium">{it.title}</span>
              <span className="inline-flex items-center gap-1.5 text-[12px] text-fg-muted">
                <span className={cn("h-2.5 w-2.5 rounded-full", st.dot)} aria-hidden />
                {st.label}
              </span>
            </div>
            <span className="text-2xl font-semibold tabular-nums">{it.value}</span>
            <span className="text-[13px] text-fg-muted">{it.text}</span>
            {it.href && it.state !== "ok" ? (
              <Link href={it.href} className="mt-auto inline-flex w-fit items-center rounded-full bg-fg px-4 py-1.5 text-[13px] font-medium text-bg transition-transform hover:scale-[1.03]">
                {it.action ?? tt("Düzelt")} →
              </Link>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
