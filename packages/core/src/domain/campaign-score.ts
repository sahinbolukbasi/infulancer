import { z } from "zod";
import type { DeliverableStatus, Platform } from "../generated/prisma/enums";
import { metricSettleHours } from "./platform-rules";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Kampanya skoru: Σ(ağırlık · gerçekleşen/hedef) / Σağırlık (üst sınır yok).
 * KPI durumu: ≥%100 ULASILDI, %85–100 KISMEN, <%85 ULASILAMADI;
 * pencere açıkken (veya YouTube metrikleri oturmadan) OLCULUYOR + doğrusal projeksiyon.
 */

export const KPI_KEYS = ["reach", "impressions", "er", "click", "sales", "views"] as const;
export type Kpi = (typeof KPI_KEYS)[number];

export const kpiLabels: Record<Kpi, string> = {
  reach: "Erişim",
  impressions: "Gösterim",
  er: "Etkileşim oranı",
  click: "Tıklama",
  sales: "Satış",
  views: "İzlenme",
};

export const targetSchema = z.object({
  kpi: z.enum(KPI_KEYS),
  target: z.number().positive(),
  weight: z.number().positive(),
  windowDays: z.number().int().positive().max(365),
});

export const targetsSchema = z.array(targetSchema).refine(
  (arr) => new Set(arr.map((t) => t.kpi)).size === arr.length,
  { message: "Her KPI en fazla bir kez tanımlanabilir." },
);

export type CampaignTarget = z.infer<typeof targetSchema>;

export type KpiStatus = "ULASILDI" | "KISMEN" | "ULASILAMADI" | "OLCULUYOR";

export const kpiStatusLabels: Record<KpiStatus, string> = {
  ULASILDI: "Ulaşıldı",
  KISMEN: "Kısmen",
  ULASILAMADI: "Ulaşılamadı",
  OLCULUYOR: "Ölçülüyor",
};

export type ScoreSnapshot = {
  measuredAt: Date;
  reach: number | null;
  impressions: number | null;
  likes: number | null;
  comments: number | null;
  saves: number | null;
  shares: number | null;
  clicks: number | null;
  sales: number | null;
  platformMetrics: unknown;
};

export type ScoreDeliverable = {
  platform: Platform;
  status: DeliverableStatus;
  publishedAt: Date | null;
  snapshots: ScoreSnapshot[];
};

export type KpiResult = {
  kpi: Kpi;
  target: number;
  weight: number;
  windowDays: number;
  actual: number;
  ratio: number;
  status: KpiStatus;
  /** Pencere açıkken pencere sonu için doğrusal tahmin. */
  projection?: number;
  projectionRatio?: number;
  windowEndsAt: Date;
};

export type CampaignScore = {
  /** 0..n oran (1 = %100). Hedef yoksa null. */
  score: number | null;
  windowStartsAt: Date;
  kpis: KpiResult[];
};

export function statusForRatio(ratio: number): Exclude<KpiStatus, "OLCULUYOR"> {
  if (ratio >= 1) return "ULASILDI";
  if (ratio >= 0.85) return "KISMEN";
  return "ULASILAMADI";
}

function num(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

function viewsOf(s: ScoreSnapshot, platform: Platform): number | null {
  const pm = (s.platformMetrics ?? {}) as Record<string, unknown>;
  const primary = platform === "INSTAGRAM" ? pm.plays : pm.views;
  if (typeof primary === "number") return primary;
  return s.impressions;
}

/** KPI için snapshot'taki değer; ilgili alan yoksa null (ör. yalnız tıklama içeren marka verisi). */
function kpiValue(kpi: Exclude<Kpi, "er">, s: ScoreSnapshot, platform: Platform): number | null {
  switch (kpi) {
    case "reach":
      return s.reach;
    case "impressions":
      return s.impressions;
    case "click":
      return s.clicks;
    case "sales":
      return s.sales;
    case "views":
      return viewsOf(s, platform);
  }
}

export function parseTargets(value: unknown): CampaignTarget[] {
  const parsed = targetsSchema.safeParse(value);
  return parsed.success ? parsed.data : [];
}

export function computeCampaignScore(
  campaign: { startsAt: Date; targets: unknown },
  deliverables: ScoreDeliverable[],
  now: Date = new Date(),
): CampaignScore {
  const targets = parseTargets(campaign.targets);
  const live = deliverables.filter((d) => d.status !== "IPTAL");
  const publishTimes = live.map((d) => d.publishedAt?.getTime()).filter((t): t is number => t != null);
  const windowStart = publishTimes.length ? Math.min(...publishTimes) : campaign.startsAt.getTime();
  const nowMs = now.getTime();

  // Metrikleri oturmamış (ör. YouTube 72 saat) yayın varsa karar verilmez.
  const unsettled = live.some(
    (d) => d.publishedAt && nowMs < d.publishedAt.getTime() + metricSettleHours[d.platform] * 3_600_000,
  );

  const kpis: KpiResult[] = targets.map((t) => {
    const windowEnd = windowStart + t.windowDays * DAY_MS;
    let reach = 0;
    let interactions = 0;
    let actual = 0;

    for (const d of live) {
      // Pencere içindeki, bu KPI'yı taşıyan en son snapshot.
      const inWindow = d.snapshots
        .filter((s) => s.measuredAt.getTime() <= windowEnd)
        .sort((a, b) => b.measuredAt.getTime() - a.measuredAt.getTime());
      if (t.kpi === "er") {
        const latest = inWindow.find((s) => s.reach != null && s.reach > 0);
        if (!latest) continue;
        reach += num(latest.reach);
        interactions += num(latest.likes) + num(latest.comments) + num(latest.saves) + num(latest.shares);
        continue;
      }
      const kpi = t.kpi;
      const latest = inWindow.find((s) => kpiValue(kpi, s, d.platform) != null);
      if (latest) actual += num(kpiValue(kpi, latest, d.platform));
    }
    if (t.kpi === "er") actual = reach > 0 ? interactions / reach : 0;

    const ratio = actual / t.target;
    const open = nowMs < windowEnd || unsettled;
    const result: KpiResult = {
      kpi: t.kpi,
      target: t.target,
      weight: t.weight,
      windowDays: t.windowDays,
      actual,
      ratio,
      status: open ? "OLCULUYOR" : statusForRatio(ratio),
      windowEndsAt: new Date(windowEnd),
    };
    if (open) {
      const elapsedDays = Math.max((nowMs - windowStart) / DAY_MS, 0);
      // Oran tipi KPI (ER) doğrusal büyümez; mevcut değer projeksiyondur.
      const projection =
        t.kpi === "er" ? actual : elapsedDays > 0 ? (actual * t.windowDays) / Math.min(elapsedDays, t.windowDays) : 0;
      result.projection = projection;
      result.projectionRatio = projection / t.target;
    }
    return result;
  });

  const totalWeight = kpis.reduce((s, k) => s + k.weight, 0);
  const score = totalWeight > 0 ? kpis.reduce((s, k) => s + k.weight * k.ratio, 0) / totalWeight : null;

  return { score, windowStartsAt: new Date(windowStart), kpis };
}
