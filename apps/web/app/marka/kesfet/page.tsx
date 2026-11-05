import type { Metadata } from "next";
import { prisma, type ContentType, type Platform } from "@infulancer/core/db";
import { categoryLabel } from "@infulancer/core/domain/categories";
import { contentTypeLabels, platformLabels } from "@infulancer/core/domain/labels";
import { platformRules } from "@infulancer/core/domain/platform-rules";
import { BrandDiscover, type ContentOption, type DiscoverCreator } from "@/components/offers/brand-discover";
import { pickAvatar } from "@/components/ui/avatar";
import { PageHeader } from "@/components/ui/layout";
import { requireActor } from "@/lib/auth-guard";
export const metadata: Metadata = { title: "Influencer bul" };
export const dynamic = "force-dynamic";

/** Marka: içerik üreticisi keşfi ve teklif gönderimi. Yalnız herkese açık profil bilgisi ve fiyat listesi gösterilir. */
export default async function BrandDiscoverPage({ searchParams }: { searchParams: Promise<{ sec?: string }> }) {
  const actor = await requireActor("BRAND");
  const { sec } = await searchParams;
  const [rows, cards, campaigns] = await Promise.all([
    prisma.influencer.findMany({
      where: { user: { status: "ACTIVE" }, showcaseVisible: true },
      orderBy: { name: "asc" },
      take: 500,
      select: {
        id: true,
        name: true,
        city: true,
        category: true,
        headline: true,
        showPrices: true,
        categories: { include: { category: { include: { parent: { select: { name: true } } } } }, orderBy: { primary: "desc" } },
        socialAccounts: { select: { platform: true, handle: true, followers: true, engagementRate: true, avatarUrl: true } },
      },
    }),
    prisma.rateCard.findMany({ where: { active: true } }),
    prisma.campaign.findMany({ where: { brandId: actor.brandId!, status: { in: ["TASLAK", "AKTIF"] } }, select: { id: true, name: true }, orderBy: { startsAt: "desc" } }),
  ]);
  const creators: DiscoverCreator[] = rows.map((i) => {
    const accounts = i.socialAccounts.map((a) => ({ platform: a.platform, handle: a.handle, followers: a.followers, er: Number(a.engagementRate) }));
    return {
      id: i.id,
      name: i.name,
      city: i.city,
      avatarUrl: pickAvatar(i.socialAccounts),
      categories: [...new Set(i.categories.flatMap((c) => [c.category.name, c.category.parent?.name].filter((x): x is string => !!x)))],
      primaryCategory: i.categories[0] ? categoryLabel(i.categories[0].category) : i.category,
      accounts,
      totalFollowers: accounts.reduce((s, a) => s + a.followers, 0),
      headline: i.headline,
      rates: (i.showPrices ? cards : []).filter((c) => c.influencerId === i.id).map((c) => ({ platform: c.platform, contentType: c.contentType, label: `${platformLabels[c.platform]} ${contentTypeLabels[c.contentType]}`, priceKurus: c.priceKurus })),
    };
  });
  const options: ContentOption[] = (Object.entries(platformRules) as [Platform, { contentTypes: readonly ContentType[] }][]).flatMap(([p, r]) =>
    r.contentTypes.map((ct) => ({ platform: p, contentType: ct, label: contentTypeLabels[ct] })),
  );
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Influencer bul" description="Seçin, içerikleri belirleyin, tek tıkla teklif gönderin." />
      <BrandDiscover creators={creators} options={options} campaigns={campaigns} initialSelected={sec && creators.some((c) => c.id === sec) ? [sec] : []} />
    </div>
  );
}
