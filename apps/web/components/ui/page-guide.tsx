import type { ReactNode } from "react";
import { CheckIcon } from "@/components/icons";
import { cn } from "@/lib/cn";

export type GuideStep = { label: string; done: boolean; hint?: ReactNode };

/** Sayfa rehberi: bu sayfa ne işe yarar, neden önemli, sırada ne var (yapılacaklar listesi). */
export function PageGuide({ what, why, steps, open = true }: { what: ReactNode; why?: ReactNode; steps?: GuideStep[]; open?: boolean }) {
  const done = steps?.filter((s) => s.done).length ?? 0;
  return (
    <details open={open} className="rounded-[12px] border border-border">
      <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 px-5 py-4 text-sm text-fg">
        <span>Bu sayfa ne işe yarar?</span>
        {steps?.length ? (
          <span className="text-[13px] text-fg-muted">
            {done}/{steps.length} adım tamam
          </span>
        ) : null}
      </summary>
      <div className="flex flex-col gap-4 border-t border-border px-5 py-4">
        <p className="max-w-3xl text-sm text-fg-muted">{what}</p>
        {why ? <p className="max-w-3xl text-[13px] text-fg-passive">{why}</p> : null}
        {steps?.length ? (
          <ol className="flex flex-col gap-2">
            {steps.map((s, i) => (
              <li key={i} className="flex items-start gap-3 text-sm">
                <span
                  aria-hidden
                  className={cn("mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px]", s.done ? "border-fg bg-fg text-bg" : "border-border text-fg-muted")}
                >
                  {s.done ? <CheckIcon size={12} /> : i + 1}
                </span>
                <span className={s.done ? "text-fg-muted" : "text-fg"}>
                  <span className="sr-only">{s.done ? "Tamamlandı: " : "Yapılacak: "}</span>
                  {s.label}
                  {s.hint ? <span className="block text-[12px] text-fg-passive">{s.hint}</span> : null}
                </span>
              </li>
            ))}
          </ol>
        ) : null}
      </div>
    </details>
  );
}
