import type { Metadata } from "next";
import { prisma } from "@infulancer/core/db";
import { contentTypeLabels, platformLabels } from "@infulancer/core/domain/labels";
import { CreatorShowcase } from "@/components/showcase/creator-showcase";
import { AddPortfolioForm, PortfolioList, ShowcaseSettingsForm } from "@/components/showcase/showcase-forms";
import { Card, CardTitle } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/form";
import { PageHeader } from "@/components/ui/layout";
import { Tabs } from "@/components/ui/tabs";
import { requireActor } from "@/lib/auth-guard";
import { fmtDate } from "@/lib/time";
export const metadata: Metadata = { title: "Vitrinim" };
export const dynamic = "force-dynamic";

/** İçerik üreticisinin markalara görünen profili: ayarlar, öne çıkan işler ve önizleme. */
export default async function ShowcasePage({ searchParams }: { searchParams: Promise<{ sekme?: string }> }) {
  const actor = await requireActor("INFLUENCER");
  const { sekme } = await searchParams;
  const id = actor.influencerId!;
  const [inf, items, published] = await Promise.all([
    prisma.influencer.findUniqueOrThrow({ where: { id }, select: { headline: true, bio: true, showcaseVisible: true, showPrices: true, showCollaborations: true } }),
    prisma.portfolioItem.findMany({ where: { influencerId: id }, orderBy: [{ sort: "asc" }, { createdAt: "desc" }] }),
    prisma.deliverable.findMany({
      where: { assignment: { influencerId: id }, postUrl: { not: null } },
      orderBy: { publishedAt: "desc" },
      take: 50,
      select: { id: true, platform: true, contentType: true, publishedAt: true, assignment: { select: { campaign: { select: { name: true, brand: { select: { name: true } } } } } } },
    }),
  ]);
  const used = new Set(items.map((i) => i.deliverableId).filter(Boolean));
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Vitrinim"
        description={inf.showcaseVisible ? "Markalar profilinizi bu haliyle görür." : "Profiliniz şu an markalara gizli."}
        actions={
          <ButtonLink href="/influencer/teklifler?sekme=fiyat" variant="secondary">
            Fiyat listemi düzenle
          </ButtonLink>
        }
      />
      <Tabs
        key={sekme ?? "duzenle"}
        label="Vitrin bölümleri"
        defaultTab={sekme}
        tabs={[
          {
            id: "duzenle",
            label: "Düzenle",
            content: (
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <Card interactive={false} className="flex flex-col gap-4">
                  <CardTitle>Profil ve görünürlük</CardTitle>
                  <ShowcaseSettingsForm v={inf} />
                </Card>
                <Card interactive={false} className="flex flex-col gap-4">
                  <CardTitle>Öne çıkan işler ({items.length}/24)</CardTitle>
                  <AddPortfolioForm
                    published={published
                      .filter((d) => !used.has(d.id))
                      .map((d) => ({ id: d.id, label: `${d.assignment.campaign.brand.name} · ${platformLabels[d.platform]} ${contentTypeLabels[d.contentType]}${d.publishedAt ? ` · ${fmtDate(d.publishedAt)}` : ""}` }))}
                  />
                  <PortfolioList items={items.map((i) => ({ id: i.id, title: i.title, url: i.url, platformLabel: platformLabels[i.platform], brandName: i.brandName }))} />
                </Card>
              </div>
            ),
          },
          { id: "onizleme", label: "Markaların gördüğü", content: <CreatorShowcase influencerId={id} /> },
        ]}
      />
    </div>
  );
}
