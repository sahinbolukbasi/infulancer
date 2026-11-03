import { kpiLabels, kpiStatusLabels, type CampaignScore, type KpiStatus } from "@infulancer/core/domain/campaign-score";
import { ProgressBar, ScoreRing } from "@/components/ui/progress";
import { StatusDot, type StatusTone } from "@/components/ui/status";
import { fmtKpi, pct } from "@/lib/format";
import { fmtDate } from "@/lib/time";

const tone: Record<KpiStatus, StatusTone> = {
  ULASILDI: "active",
  KISMEN: "muted",
  ULASILAMADI: "passive",
  OLCULUYOR: "muted",
};

/** Skor halkası + KPI kırılımı (hedef, gerçekleşen, oran çubuğu, durum, projeksiyon). */
export function KpiBreakdown({ score, large = false }: { score: CampaignScore; large?: boolean }) {
  if (score.kpis.length === 0) {
    return <p className="text-sm text-fg-passive">Bu kampanyada hedef tanımlı değil; skor hesaplanamaz.</p>;
  }
  return (
    <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
      <div className="shrink-0">
        <ScoreRing value={score.score ?? 0} {...(large ? { size: 220, valueSize: 48 } : {})} />
      </div>
      <ul className="flex flex-1 flex-col divide-y divide-border">
        {score.kpis.map((k) => (
          <li key={k.kpi} className="flex flex-col gap-2 py-4 first:pt-0">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-sm text-fg">
                {kpiLabels[k.kpi]} <span className="text-[12px] text-fg-passive">· ağırlık {k.weight}</span>
              </span>
              <StatusDot tone={tone[k.status]}>{kpiStatusLabels[k.status]}</StatusDot>
            </div>
            <ProgressBar value={k.ratio} label={`${kpiLabels[k.kpi]} hedef oranı`} />
            <div className="flex flex-wrap justify-between gap-2 text-[13px] text-fg-muted tabular-nums">
              <span>
                {fmtKpi(k.kpi, k.actual)} / {fmtKpi(k.kpi, k.target)} · {pct.format(k.ratio)}
              </span>
              <span className="text-fg-passive">
                {k.status === "OLCULUYOR" && k.projection != null
                  ? `Projeksiyon: ${fmtKpi(k.kpi, k.projection)} (${pct.format(k.projectionRatio ?? 0)}) · pencere ${fmtDate(k.windowEndsAt)}`
                  : `Pencere ${k.windowDays} gün · ${fmtDate(k.windowEndsAt)}`}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
