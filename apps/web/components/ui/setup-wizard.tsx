import { getTT } from "@/lib/i18n/tt-server";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type WizardStep = { key: string; title: string; done: boolean; hint?: string; content?: ReactNode };

/**
 * Adım adım kurulum: ilerleme çubuğu + sıradaki adım açık, diğerleri tek satır.
 * Tamamlanan adımlar tıklanınca açılır (düzenleme için). Sunucu bileşeni.
 */
export async function SetupWizard({ title, steps, doneText }: { title: string; steps: WizardStep[]; doneText: string }) {
  const tt = await getTT();
  const doneCount = steps.filter((s) => s.done).length;
  const current = steps.findIndex((s) => !s.done);
  return (
    <section aria-label={title} className="flex flex-col gap-4 rounded-3xl border border-line bg-glass p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{title}</h2>
        <span className="text-[13px] tabular-nums text-fg-muted">
          {doneCount}/{steps.length}{" "}{tt("tamam")}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-line" aria-hidden>
        <div className="bg-neon h-full rounded-full transition-all" style={{ width: `${(doneCount / steps.length) * 100}%` }} />
      </div>
      {current === -1 ? <p className="rounded-2xl border border-neon-lime/40 bg-neon-lime/10 px-4 py-3 text-sm">✓ {doneText}</p> : null}
      <ol className="flex flex-col gap-2">
        {steps.map((s, i) => {
          const active = i === current;
          const locked = current !== -1 && i > current;
          const badge = (
            <span
              aria-hidden
              className={cn(
                "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold",
                s.done ? "bg-neon-lime text-black" : active ? "bg-neon-pink text-black" : "border border-line-strong text-fg-passive",
              )}
            >
              {s.done ? "✓" : i + 1}
            </span>
          );
          if (active)
            return (
              <li key={s.key} aria-current="step" className="flex flex-col gap-4 rounded-2xl border border-neon-pink/50 bg-surface p-4">
                <div className="flex items-start gap-3">
                  {badge}
                  <div className="flex flex-col">
                    <span className="font-medium">{s.title}</span>
                    {s.hint ? <span className="text-[13px] text-fg-muted">{s.hint}</span> : null}
                  </div>
                </div>
                {s.content ? <div className="pl-10">{s.content}</div> : null}
              </li>
            );
          return (
            <li key={s.key}>
              <details className={cn("group rounded-2xl border border-line px-4 py-3", locked && "opacity-60")}>
                <summary className={cn("flex list-none items-center gap-3 [&::-webkit-details-marker]:hidden", s.content && !locked ? "cursor-pointer" : "pointer-events-none")}>
                  {badge}
                  <span className={s.done ? "text-fg" : "text-fg-muted"}>{s.title}</span>
                  {s.done && s.content ? <span className="ml-auto text-[12px] text-fg-passive group-open:hidden">{tt("Düzenle")}</span> : null}
                </summary>
                {s.content && !locked ? <div className="mt-3 pl-10">{s.content}</div> : null}
              </details>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
