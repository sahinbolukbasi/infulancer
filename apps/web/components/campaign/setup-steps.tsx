import { getTT } from "@/lib/i18n/tt-server";
import Link from "next/link";
import type { SetupStep } from "@infulancer/core/domain/campaign-setup";
import { CheckIcon } from "@/components/icons";
import { cn } from "@/lib/cn";

/** Kampanya kurulum adımları — sihirbazda ve kampanya detayında aynı bileşen. */
export async function SetupSteps({ campaignId, steps, active, compact = false }: { campaignId: string; steps: SetupStep[]; active?: string; compact?: boolean }) {
  const tt = await getTT();
  return (
    <nav aria-label={tt("Kampanya kurulum adımları")}>
      <ol className={cn("grid gap-2", compact ? "grid-cols-3 md:grid-cols-6" : "grid-cols-1 md:grid-cols-6")}>
        {steps.map((s, i) => (
          <li key={s.key}>
            <Link
              href={`/admin/kampanyalar/${campaignId}/kurulum?adim=${s.key}`}
              aria-current={active === s.key ? "step" : undefined}
              className={cn(
                "flex h-full flex-col gap-1 rounded-[8px] border px-3 py-2 transition-colors",
                active === s.key ? "border-fg" : "border-border hover:border-fg-muted",
              )}
            >
              <span className="flex items-center gap-2 text-[12px] text-fg-passive">
                <span
                  aria-hidden
                  className={cn(
                    "inline-flex h-5 w-5 items-center justify-center rounded-full border text-[11px]",
                    s.done ? "border-fg bg-fg text-bg" : s.issues.length ? "border-critical text-critical" : "border-border",
                  )}
                >
                  {s.done ? <CheckIcon size={12} /> : i + 1}
                </span>
                {s.done ? tt("Tamam") : s.issues.length ? tt("Eksik") : tt("Bekliyor")}
              </span>
              <span className="text-sm text-fg">{s.title}</span>
              {!compact ? <span className="text-[12px] text-fg-muted">{s.summary}</span> : null}
            </Link>
          </li>
        ))}
      </ol>
    </nav>
  );
}
