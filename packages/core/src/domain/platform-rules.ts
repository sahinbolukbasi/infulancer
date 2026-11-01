import { z } from "zod";
import type { ContentType, Platform } from "../generated/prisma/enums";
import { DomainError } from "./errors";

/**
 * Platform bazlı kurallar — üç platformun içerik tipi, teknik kısıtı ve ölçüm
 * metrikleri farklı olduğu için ayrı şemalar.
 */

export type PlatformRule = {
  contentTypes: readonly ContentType[];
  formatConstraints: string[];
  disclosureLabel: string;
  mainMetrics: string[];
  linkPlacement: string;
  criticalConstraint: string;
};

export const platformRules: Record<Platform, PlatformRule> = {
  INSTAGRAM: {
    contentTypes: ["REELS", "STORY", "CAROUSEL", "FEED", "LIVE"],
    formatConstraints: ["Story 24 saat ömürlü", "Reels 9:16"],
    disclosureLabel: "Reklam İşbirliği (paid partnership)",
    mainMetrics: ["reach", "saves", "shares", "profil tıklama"],
    linkPlacement: "Story sticker / bio",
    criticalConstraint: "Story metriği 24 saatte kaybolur → ekran görüntüsü zorunlu",
  },
  TIKTOK: {
    contentTypes: ["VIDEO", "PHOTO", "LIVE"],
    formatConstraints: ["9:16", "Hook ilk 3 sn"],
    disclosureLabel: "Branded content toggle",
    mainMetrics: ["views", "watch time", "completion rate"],
    linkPlacement: "Bio / Spark Ads",
    criticalConstraint: "Silinme sık → ham dosya arşivi zorunlu",
  },
  YOUTUBE: {
    contentTypes: ["VIDEO", "SHORTS", "COMMUNITY"],
    formatConstraints: ["Shorts 9:16", "Uzun video 16:9"],
    disclosureLabel: "Paid promotion disclosure",
    mainMetrics: ["views", "AVD", "CTR", "abone değişimi"],
    linkPlacement: "Açıklama + sabitlenmiş yorum",
    criticalConstraint: "Metrikler 48-72 saatte oturur → erken karar verilmez",
  },
};

/** YouTube metrikleri 72 saatte oturur; bu süre dolmadan "ulaşılamadı" denmez. */
export const metricSettleHours: Record<Platform, number> = {
  INSTAGRAM: 24,
  TIKTOK: 24,
  YOUTUBE: 72,
};

export function isContentTypeAllowed(platform: Platform, contentType: ContentType): boolean {
  return platformRules[platform].contentTypes.includes(contentType);
}

export function assertContentType(platform: Platform, contentType: ContentType): void {
  if (!isContentTypeAllowed(platform, contentType)) {
    throw new DomainError(
      "DOGRULAMA",
      `${contentType} içerik tipi ${platform} için geçerli değil.`,
      { platform, contentType },
    );
  }
}

export function isStory(d: { platform: Platform; contentType: ContentType }): boolean {
  return d.platform === "INSTAGRAM" && d.contentType === "STORY";
}

const count = z.number().int().nonnegative();
const ratio = z.number().min(0).max(1);

/** Platforma özgü metrikler (MetricSnapshot.platformMetrics). Tümü opsiyonel. */
export const platformMetricSchemas = {
  INSTAGRAM: z.strictObject({
    profileClicks: count.optional(),
    linkStickerTaps: count.optional(),
    follows: count.optional(),
    replies: count.optional(),
    exits: count.optional(),
    plays: count.optional(),
  }),
  TIKTOK: z.strictObject({
    views: count.optional(),
    watchTimeSec: count.optional(),
    avgWatchTimeSec: z.number().nonnegative().optional(),
    completionRate: ratio.optional(),
    profileViews: count.optional(),
  }),
  YOUTUBE: z.strictObject({
    views: count.optional(),
    watchTimeMin: count.optional(),
    avgViewDurationSec: z.number().nonnegative().optional(),
    ctr: ratio.optional(),
    subscriberDelta: z.number().int().optional(),
  }),
} as const;

export type PlatformMetrics<P extends Platform> = z.infer<(typeof platformMetricSchemas)[P]>;

/** Ortak metrik kolonları (MetricSnapshot). */
export const commonMetricSchema = z.object({
  reach: count.nullish(),
  impressions: count.nullish(),
  likes: count.nullish(),
  comments: count.nullish(),
  saves: count.nullish(),
  shares: count.nullish(),
  clicks: count.nullish(),
  sales: count.nullish(),
  revenueKurus: count.nullish(),
});

export type CommonMetrics = z.infer<typeof commonMetricSchema>;

export function parsePlatformMetrics(platform: Platform, value: unknown): Record<string, number> {
  const result = platformMetricSchemas[platform].safeParse(value ?? {});
  if (!result.success) {
    throw new DomainError("DOGRULAMA", "Platform metrikleri geçersiz.", {
      issues: result.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    });
  }
  // Tüm platform metrikleri sayısaldır; zod tanımsız anahtarları çıktıya koymaz.
  return result.data as Record<string, number>;
}

/**
 * Makul ER aralıkları (etkileşim / reach). Aralık dışı değerler metrik tutarlılık
 * agent'ı tarafından işaretlenir.
 */
export const engagementSanityRanges: Record<Platform, { min: number; max: number }> = {
  INSTAGRAM: { min: 0.005, max: 0.25 },
  TIKTOK: { min: 0.01, max: 0.35 },
  YOUTUBE: { min: 0.005, max: 0.2 },
};

/** ER = (like + comment + save + share) / reach. Reach yoksa null. */
export function engagementRate(m: CommonMetrics): number | null {
  if (!m.reach) return null;
  const interactions = (m.likes ?? 0) + (m.comments ?? 0) + (m.saves ?? 0) + (m.shares ?? 0);
  return interactions / m.reach;
}

export function isEngagementInRange(platform: Platform, er: number): boolean {
  const range = engagementSanityRanges[platform];
  return er >= range.min && er <= range.max;
}
