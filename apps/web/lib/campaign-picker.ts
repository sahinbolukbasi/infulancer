import { prisma } from "@infulancer/core/db";
import { REGIONS } from "@infulancer/core/i18n/regions";
import { categoryLabel } from "@infulancer/core/domain/categories";
import type { PickerInfluencer } from "@/components/campaign/influencer-picker";
import { pickAvatar } from "@/components/ui/avatar";
/**
 * Kampanyaya eklenebilecek influencer havuzu (InfluencerPicker verisi).
 * Kampanya detay ve kurulum sayfaları aynı veriyi kullanır.
 */
export const pickerInfluencerSelect = {
  id: true,
  name: true,
  category: true,
  city: true,
  categories: { include: { category: { include: { parent: { select: { name: true } } } } }, orderBy: { primary: "desc" } },
  socialAccounts: { select: { platform: true, handle: true, followers: true, engagementRate: true, avatarUrl: true } },
  assignments: {
    where: { contractStatus: { not: "RED" } },
    orderBy: { createdAt: "desc" },
    select: { feeKurus: true, campaign: { select: { brandId: true } } },
  },
} as const;

export async function pickerPool(campaignId: string) {
  // Ülke ayrımı: kampanyanın hedef ülkelerinde kayıtlı influencerlar (para birimi kampanyayla aynı).
  const c = await prisma.campaign.findUnique({ where: { id: campaignId }, select: { targetCountries: true, currency: true } });
  const countries = c?.targetCountries.length ? c.targetCountries : REGIONS.filter((r) => r.currency === (c?.currency ?? "TRY")).map((r) => r.code);
  return prisma.influencer.findMany({
    where: { country: { in: countries }, assignments: { none: { campaignId, contractStatus: { not: "RED" } } } },
    orderBy: { name: "asc" },
    select: pickerInfluencerSelect,
  });
}

type PoolRow = Awaited<ReturnType<typeof pickerPool>>[number];

export function toPickerInfluencers(rows: PoolRow[], brandId: string, suggested: Map<string, string | undefined>): PickerInfluencer[] {
  return rows.map((i) => {
    const accounts = i.socialAccounts.map((a) => ({ platform: a.platform, handle: a.handle, followers: a.followers, er: Number(a.engagementRate) }));
    return {
      id: i.id,
      name: i.name,
      city: i.city,
      primaryCategory: i.categories[0] ? categoryLabel(i.categories[0].category) : i.category,
      categories: [...new Set(i.categories.flatMap((c) => [c.category.name, c.category.parent?.name].filter((x): x is string => !!x)).concat(i.category ? [i.category] : []))],
      accounts,
      totalFollowers: accounts.reduce((s, a) => s + a.followers, 0),
      bestEr: accounts.reduce((m, a) => Math.max(m, a.er), 0),
      lastFeeTl: i.assignments[0] ? Math.round(i.assignments[0].feeKurus / 100) : null,
      brandHistory: i.assignments.filter((a) => a.campaign.brandId === brandId).length,
      suggested: suggested.has(i.id),
      rationale: suggested.get(i.id),
      avatarUrl: pickAvatar(i.socialAccounts),
    };
  });
}
