import { getConfig } from "../config/store";

/**
 * Marketing API kota modeli (Access Tier: Limited/Full — 4 Mayıs 2026). Tüm sayılar config'den.
 * Header'lar loglanır ve dashboard'a konur: X-Ad-Account-Usage, X-Business-Use-Case, X-FB-Ads-Insights-Throttle.
 */
export type Tier = "full" | "development";

export async function hourlyQuota(tier: Tier, activeAds: number, activeAudiences = 0, userErrors = 0) {
  const q = await getConfig("meta.ads.quota");
  const base = q[tier];
  return {
    adsManagement: base.adsManagementBase + q.perActiveAd.adsManagement * activeAds,
    adsInsights: Math.max(0, base.adsInsightsBase + q.perActiveAd.adsInsights * activeAds - 0.001 * userErrors),
    customAudience: Math.min(q.customAudienceCap, base.customAudienceBase + q.perActiveAudience * activeAudiences),
  };
}

/** Skor: okuma 1, yazma 3 puan; 300 sn pencerede erir. Dolunca blok. */
export class ScoreTracker {
  private events: { at: number; points: number }[] = [];
  private blockedUntil = 0;
  constructor(private readonly cfg: { maxScore: number; blockSeconds: number; decaySeconds: number; readPoints: number; writePoints: number }, private readonly now: () => number = Date.now) {}
  record(kind: "read" | "write"): { allowed: boolean; score: number; blockedForSec: number } {
    const t = this.now();
    if (t < this.blockedUntil) return { allowed: false, score: this.score(t), blockedForSec: Math.ceil((this.blockedUntil - t) / 1000) };
    const points = kind === "write" ? this.cfg.writePoints : this.cfg.readPoints;
    if (this.score(t) + points > this.cfg.maxScore) {
      this.blockedUntil = t + this.cfg.blockSeconds * 1000;
      return { allowed: false, score: this.score(t), blockedForSec: this.cfg.blockSeconds };
    }
    this.events.push({ at: t, points });
    return { allowed: true, score: this.score(t), blockedForSec: 0 };
  }
  private score(t: number) {
    this.events = this.events.filter((e) => t - e.at < this.cfg.decaySeconds * 1000);
    return this.events.reduce((s, e) => s + e.points, 0);
  }
}

export type UsageHeaders = {
  adAccount?: { acc_id_util_pct?: number; reset_time_duration?: number; ads_api_access_tier?: string };
  businessUseCase?: Record<string, { call_count?: number; total_cputime?: number; total_time?: number; estimated_time_to_regain_access?: number }[]>;
  insightsThrottle?: Record<string, unknown>;
};

export function parseUsageHeaders(h: Headers | Record<string, string | undefined>): UsageHeaders {
  const get = (k: string) => (h instanceof Headers ? h.get(k) : h[k] ?? h[k.toLowerCase()]) ?? undefined;
  const json = (v: string | undefined) => {
    if (!v) return undefined;
    try {
      return JSON.parse(v);
    } catch {
      return undefined;
    }
  };
  return { adAccount: json(get("X-Ad-Account-Usage")), businessUseCase: json(get("X-Business-Use-Case")), insightsThrottle: json(get("X-FB-Ads-Insights-Throttle")) };
}

/** Full Access eşiği: son 15 günde 500 çağrı ve son 500 çağrıda hata oranı < %15. */
export async function fullAccessProgress(callsLast15Days: number, errorsInLast500: number) {
  const t = (await getConfig("meta.ads.quota")).fullAccessThreshold;
  const window = Math.min(t.window, callsLast15Days);
  const errorRate = window ? errorsInLast500 / window : 0;
  return { calls: callsLast15Days, needed: t.calls, errorRate, eligible: callsLast15Days >= t.calls && errorRate < t.maxErrorRate };
}
