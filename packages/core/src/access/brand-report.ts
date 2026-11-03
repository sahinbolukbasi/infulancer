import { prisma, type MetricSource, type Platform, type ReviewDecision, type Tx, type UsageChannel } from "../db";
import { computeCampaignScore, type CampaignScore } from "../domain/campaign-score";
import { interactionsOf, isOnTime, latestReachSnapshot } from "../domain/influencer-stats";
import { metricSourceTrust, type TrustLevel } from "../domain/labels";
import { requireRole, type Actor } from "./actor";
import {
  toBrandCampaignView,
  toBrandDeliverableView,
  type BrandCampaignView,
  type BrandDeliverableView,
} from "./dto";
import { assertCampaignAccess } from "./ownership";

/**
 * Marka kampanya sayfası ve PDF raporu için tek veri kaynağı.
 * Çıktı yalnız DTO'lardan ve türetilmiş metriklerden oluşur: atama bedeli,
 * komisyon ve bütçe bu nesneye hiç girmez. Marka yalnız toplam ödediği
 * tutarı (brandTotalFeeKurus) görür.
 */

type Db = Tx | typeof prisma;

export type BrandInfluencerRow = {
  influencerId: string;
  name: string;
  accounts: { platform: Platform; handle: string }[];
  platforms: Platform[];
  deliverableCount: number;
  publishedCount: number;
  onTimeCount: number;
  onTimeRate: number | null;
  reach: number;
  er: number | null;
  clicks: number;
  sales: number;
};

export type UsageRights = {
  channel: UsageChannel | null;
  durationDays: number | null;
  endsAt: Date | null;
  geography: string[];
};

export type BrandGalleryItem = {
  deliverable: BrandDeliverableView;
  thumbAssetId: string | null;
  reach: number | null;
  usage: UsageRights | null;
};

export type BrandPendingDraft = {
  deliverable: BrandDeliverableView;
  assets: { id: string; fileName: string; mime: string }[];
  reviews: { decision: ReviewDecision; note: string; createdAt: Date; byName: string }[];
};

export type BrandCampaignReport = {
  campaign: BrandCampaignView & { brandName: string };
  score: CampaignScore;
  deliverables: BrandDeliverableView[];
  influencers: BrandInfluencerRow[];
  gallery: BrandGalleryItem[];
  pendingDrafts: BrandPendingDraft[];
  totals: { reach: number; impressions: number; clicks: number; sales: number; revenueKurus: number };
  /** Ciro / marka toplam bedeli; marka cirosu yoksa null. */
  roas: number | null;
  trust: { source: MetricSource; level: TrustLevel; count: number }[];
};

type SnapRow = {
  measuredAt: Date;
  source: MetricSource;
  reach: number | null;
  impressions: number | null;
  likes: number | null;
  comments: number | null;
  saves: number | null;
  shares: number | null;
  clicks: number | null;
  sales: number | null;
  revenueKurus: number | null;
  platformMetrics: unknown;
};

/** Alan için en son değer (snapshot'lar birikir, üzerine yazılmaz). */
function latestValue(snaps: SnapRow[], field: "impressions" | "clicks" | "sales" | "revenueKurus"): number {
  let best: SnapRow | undefined;
  for (const s of snaps) {
    if (s[field] == null) continue;
    if (!best || s.measuredAt > best.measuredAt) best = s;
  }
  return best?.[field] ?? 0;
}

export async function loadBrandCampaignReport(
  actorIn: Actor,
  campaignId: string,
  now: Date = new Date(),
  db: Db = prisma,
): Promise<BrandCampaignReport> {
  const actor = requireRole(actorIn, "ADMIN", "BRAND");
  await assertCampaignAccess(db as Tx, actor, campaignId);

  const campaign = await db.campaign.findUniqueOrThrow({
    where: { id: campaignId },
    include: {
      brand: { select: { name: true } },
      assignments: {
        orderBy: { createdAt: "asc" },
        include: {
          influencer: {
            select: { id: true, name: true, socialAccounts: { select: { platform: true, handle: true } } },
          },
          deliverables: {
            orderBy: { plannedAt: "asc" },
            include: {
              metricSnapshots: {
                select: {
                  measuredAt: true,
                  source: true,
                  reach: true,
                  impressions: true,
                  likes: true,
                  comments: true,
                  saves: true,
                  shares: true,
                  clicks: true,
                  sales: true,
                  revenueKurus: true,
                  platformMetrics: true,
                },
              },
              assets: {
                where: { uploadStatus: "TAMAM", kind: { in: ["TASLAK", "HAM_DOSYA"] } },
                orderBy: { createdAt: "desc" },
                select: {
                  id: true,
                  fileName: true,
                  mime: true,
                  kind: true,
                  usageChannel: true,
                  usageDurationDays: true,
                  usageEndsAt: true,
                  usageGeography: true,
                },
              },
              reviews: {
                orderBy: { createdAt: "desc" },
                select: { decision: true, note: true, createdAt: true, brandUser: { select: { name: true } } },
              },
            },
          },
        },
      },
    },
  });

  const view = toBrandCampaignView(campaign);
  const liveAssignments = campaign.assignments.filter((a) => a.contractStatus !== "RED");
  const liveDeliverables = liveAssignments.flatMap((a) =>
    a.deliverables
      .filter((d) => d.status !== "IPTAL")
      .map((d) => ({ raw: d, view: toBrandDeliverableView({ ...d, assignment: { influencer: a.influencer } }) })),
  );

  const score = computeCampaignScore(
    campaign,
    liveDeliverables.map(({ raw }) => ({
      platform: raw.platform,
      status: raw.status,
      publishedAt: raw.publishedAt,
      snapshots: raw.metricSnapshots,
    })),
    now,
  );

  const totals = { reach: 0, impressions: 0, clicks: 0, sales: 0, revenueKurus: 0 };
  const trustCounts = new Map<MetricSource, number>();

  const influencers: BrandInfluencerRow[] = liveAssignments.map((a) => {
    const ds = a.deliverables.filter((d) => d.status !== "IPTAL");
    let reach = 0;
    let interactions = 0;
    let erReach = 0;
    let clicks = 0;
    let sales = 0;
    let publishedCount = 0;
    let onTimeCount = 0;
    for (const d of ds) {
      const latest = latestReachSnapshot(d.metricSnapshots);
      if (latest?.reach) {
        reach += latest.reach;
        erReach += latest.reach;
        interactions += interactionsOf(latest);
      }
      const dClicks = latestValue(d.metricSnapshots, "clicks");
      const dSales = latestValue(d.metricSnapshots, "sales");
      clicks += dClicks;
      sales += dSales;
      totals.impressions += latestValue(d.metricSnapshots, "impressions");
      totals.revenueKurus += latestValue(d.metricSnapshots, "revenueKurus");
      for (const s of d.metricSnapshots) trustCounts.set(s.source, (trustCounts.get(s.source) ?? 0) + 1);
      if (d.publishedAt) {
        publishedCount += 1;
        if (isOnTime(d)) onTimeCount += 1;
      }
    }
    totals.reach += reach;
    totals.clicks += clicks;
    totals.sales += sales;
    const used = new Set(ds.map((d) => d.platform));
    return {
      influencerId: a.influencer.id,
      name: a.influencer.name,
      accounts: a.influencer.socialAccounts
        .filter((s) => used.has(s.platform))
        .map((s) => ({ platform: s.platform, handle: s.handle })),
      platforms: [...used],
      deliverableCount: ds.length,
      publishedCount,
      onTimeCount,
      onTimeRate: publishedCount > 0 ? onTimeCount / publishedCount : null,
      reach,
      er: erReach > 0 ? interactions / erReach : null,
      clicks,
      sales,
    };
  });

  const gallery: BrandGalleryItem[] = liveDeliverables
    .filter(({ raw }) => raw.publishedAt)
    .map(({ raw, view: dv }) => {
      const thumb = raw.assets.find((as) => as.mime.startsWith("image/"));
      const rights = raw.assets.find((as) => as.usageChannel || as.usageDurationDays || as.usageEndsAt);
      return {
        deliverable: dv,
        thumbAssetId: thumb?.id ?? null,
        reach: latestReachSnapshot(raw.metricSnapshots)?.reach ?? null,
        usage: rights
          ? {
              channel: rights.usageChannel,
              durationDays: rights.usageDurationDays,
              endsAt: rights.usageEndsAt,
              geography: rights.usageGeography,
            }
          : null,
      };
    });

  const pendingDrafts: BrandPendingDraft[] = liveDeliverables
    .filter(({ raw }) => raw.status === "ICERIK_YUKLENDI")
    .map(({ raw, view: dv }) => ({
      deliverable: dv,
      assets: raw.assets.filter((as) => as.kind === "TASLAK").map((as) => ({ id: as.id, fileName: as.fileName, mime: as.mime })),
      reviews: raw.reviews.map((r) => ({ decision: r.decision, note: r.note, createdAt: r.createdAt, byName: r.brandUser.name })),
    }));

  const roas = totals.revenueKurus > 0 && view.brandTotalFeeKurus > 0 ? totals.revenueKurus / view.brandTotalFeeKurus : null;

  const order: MetricSource[] = ["API", "MARKA", "EKRAN_GORUNTUSU", "MANUEL"];
  return {
    campaign: { ...view, brandName: campaign.brand.name },
    score,
    deliverables: liveDeliverables.map((d) => d.view),
    influencers,
    gallery,
    pendingDrafts,
    totals,
    roas,
    trust: order.map((source) => ({ source, level: metricSourceTrust[source], count: trustCounts.get(source) ?? 0 })),
  };
}
