import { prisma } from "@infulancer/core/db";
import { computeCampaignScore, type CampaignScore, type ScoreDeliverable } from "@infulancer/core/domain/campaign-score";

/** Skor hesabı için deliverable + snapshot seçimi (Prisma select). */
export const scoreDeliverableSelect = {
  platform: true,
  status: true,
  publishedAt: true,
  metricSnapshots: {
    select: {
      measuredAt: true,
      reach: true,
      impressions: true,
      likes: true,
      comments: true,
      saves: true,
      shares: true,
      clicks: true,
      sales: true,
      platformMetrics: true,
    },
  },
} as const;

type ScoreRow = {
  platform: ScoreDeliverable["platform"];
  status: ScoreDeliverable["status"];
  publishedAt: Date | null;
  metricSnapshots: ScoreDeliverable["snapshots"];
};

export function toScoreDeliverables(rows: ScoreRow[]): ScoreDeliverable[] {
  return rows.map((d) => ({ platform: d.platform, status: d.status, publishedAt: d.publishedAt, snapshots: d.metricSnapshots }));
}

/** Kampanya başına skor (reddedilmiş atamaların işleri hariç). */
export async function loadCampaignScores(ids: string[], now: Date = new Date()): Promise<Map<string, CampaignScore>> {
  if (ids.length === 0) return new Map();
  const campaigns = await prisma.campaign.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      startsAt: true,
      targets: true,
      assignments: {
        where: { contractStatus: { not: "RED" } },
        select: { deliverables: { select: scoreDeliverableSelect } },
      },
    },
  });
  return new Map(
    campaigns.map((c) => [
      c.id,
      computeCampaignScore(c, toScoreDeliverables(c.assignments.flatMap((a) => a.deliverables)), now),
    ]),
  );
}
