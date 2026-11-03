import { prisma, type Tx } from "../db";
import { parseTargets } from "./campaign-score";
import { DAY_MS } from "./ledger";

/**
 * Admin influencer takip metrikleri (yalnız admin ekranları kullanır; bedel içerir).
 *
 * - Zamanında teslim: yayınlanan işlerde publishedAt ≤ plannedAt + 30 dk oranı.
 * - Ortalama performans: erişim hedefi olan kampanyalarda influencer erişiminin
 *   kişi başı hedef payına oranı (hedef / canlı atama sayısı); yoksa ortalama ER.
 * - Aktif münhasırlık: reddedilmemiş atamada kampanya bitişi + exclusivityDays henüz dolmadı.
 * - Toplam ödenen: INFLUENCER_PAYABLE hesabındaki ODEME borç kayıtları toplamı.
 */

export const ON_TIME_GRACE_MS = 30 * 60_000;

type Db = Tx | typeof prisma;

export type ExclusivityWindow = { campaignId: string; campaignName: string; category: string; until: Date };

export type InfluencerStats = {
  influencerId: string;
  /** En çok takipçili hesabın ER geçmişi (eskiden yeniye, oran). */
  erTrend: number[];
  completedCampaigns: number;
  publishedCount: number;
  onTimeCount: number;
  /** 0..1; yayınlanmış iş yoksa null. */
  onTimeRate: number | null;
  performance: { kind: "ERISIM_ORANI" | "ER"; value: number } | null;
  activeExclusivities: ExclusivityWindow[];
  totalPaidKurus: number;
};

type Snap = {
  measuredAt: Date;
  reach: number | null;
  likes: number | null;
  comments: number | null;
  saves: number | null;
  shares: number | null;
};

const n = (v: number | null) => v ?? 0;

/** En son, erişim içeren snapshot. */
export function latestReachSnapshot<T extends { measuredAt: Date; reach: number | null }>(snaps: T[]): T | undefined {
  let best: T | undefined;
  for (const s of snaps) {
    if (s.reach == null) continue;
    if (!best || s.measuredAt > best.measuredAt) best = s;
  }
  return best;
}

export function interactionsOf(s: Snap): number {
  return n(s.likes) + n(s.comments) + n(s.saves) + n(s.shares);
}

export function isOnTime(d: { plannedAt: Date; publishedAt: Date | null }): boolean {
  return !!d.publishedAt && d.publishedAt.getTime() <= d.plannedAt.getTime() + ON_TIME_GRACE_MS;
}

export async function computeInfluencerStats(
  ids?: string[],
  now: Date = new Date(),
  db: Db = prisma,
): Promise<Map<string, InfluencerStats>> {
  const where = ids ? { id: { in: ids } } : {};
  const influencerWhere = ids ? { influencerId: { in: ids } } : {};

  const [influencers, assignments, paid] = await Promise.all([
    db.influencer.findMany({
      where,
      select: {
        id: true,
        socialAccounts: {
          select: {
            followers: true,
            snapshots: { orderBy: { takenAt: "asc" }, select: { engagementRate: true, takenAt: true } },
          },
        },
      },
    }),
    db.assignment.findMany({
      where: { ...influencerWhere, contractStatus: { not: "RED" } },
      select: {
        influencerId: true,
        contractStatus: true,
        exclusivityDays: true,
        exclusivityCategory: true,
        campaign: {
          select: {
            id: true,
            name: true,
            status: true,
            endsAt: true,
            targets: true,
            brand: { select: { category: true } },
            _count: { select: { assignments: { where: { contractStatus: { not: "RED" } } } } },
          },
        },
        deliverables: {
          where: { status: { not: "IPTAL" } },
          select: {
            status: true,
            plannedAt: true,
            publishedAt: true,
            metricSnapshots: {
              select: { measuredAt: true, reach: true, likes: true, comments: true, saves: true, shares: true },
            },
          },
        },
      },
    }),
    db.ledgerEntry.groupBy({
      by: ["influencerId"],
      where: { ...influencerWhere, account: "INFLUENCER_PAYABLE", reason: "ODEME", direction: "DEBIT" },
      _sum: { amountKurus: true },
    }),
  ]);

  const paidBy = new Map(paid.map((p) => [p.influencerId, p._sum.amountKurus ?? 0]));
  const byInfluencer = new Map<string, typeof assignments>();
  for (const a of assignments) {
    const list = byInfluencer.get(a.influencerId) ?? [];
    list.push(a);
    byInfluencer.set(a.influencerId, list);
  }

  const out = new Map<string, InfluencerStats>();
  for (const inf of influencers) {
    const primary = [...inf.socialAccounts].sort((a, b) => b.followers - a.followers)[0];
    const erTrend = (primary?.snapshots ?? []).map((s) => Number(s.engagementRate));

    const list = byInfluencer.get(inf.id) ?? [];
    const completed = new Set<string>();
    const exclusivities: ExclusivityWindow[] = [];
    let published = 0;
    let onTime = 0;
    const reachRatios: number[] = [];
    const ers: number[] = [];

    for (const a of list) {
      const live = a.deliverables;
      const allDone = live.length > 0 && live.every((d) => d.status === "TAMAMLANDI");
      if (a.contractStatus === "KABUL" && (a.campaign.status === "KAPANDI" || allDone)) completed.add(a.campaign.id);

      if (a.exclusivityDays > 0 && a.campaign.status !== "IPTAL") {
        const until = new Date(a.campaign.endsAt.getTime() + a.exclusivityDays * DAY_MS);
        if (until > now) {
          exclusivities.push({
            campaignId: a.campaign.id,
            campaignName: a.campaign.name,
            category: a.exclusivityCategory ?? a.campaign.brand.category,
            until,
          });
        }
      }

      let reachSum = 0;
      let anyPublished = false;
      for (const d of live) {
        if (!d.publishedAt) continue;
        anyPublished = true;
        published += 1;
        if (isOnTime(d)) onTime += 1;
        const latest = latestReachSnapshot(d.metricSnapshots);
        if (latest && n(latest.reach) > 0) {
          reachSum += n(latest.reach);
          ers.push(interactionsOf(latest) / n(latest.reach));
        }
      }

      const reachTarget = parseTargets(a.campaign.targets).find((t) => t.kpi === "reach");
      const liveCount = Math.max(a.campaign._count.assignments, 1);
      if (reachTarget && anyPublished) reachRatios.push(reachSum / (reachTarget.target / liveCount));
    }

    const avg = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
    out.set(inf.id, {
      influencerId: inf.id,
      erTrend,
      completedCampaigns: completed.size,
      publishedCount: published,
      onTimeCount: onTime,
      onTimeRate: published > 0 ? onTime / published : null,
      performance: reachRatios.length
        ? { kind: "ERISIM_ORANI", value: avg(reachRatios) }
        : ers.length
          ? { kind: "ER", value: avg(ers) }
          : null,
      activeExclusivities: exclusivities.sort((x, y) => x.until.getTime() - y.until.getTime()),
      totalPaidKurus: paidBy.get(inf.id) ?? 0,
    });
  }
  return out;
}
