import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { prisma } from "@infulancer/core/db";
import { LandingPage, type LandingStats } from "@/components/landing/landing-page";
import { getActor } from "@/lib/auth-guard";
import { getLandingContent, toReferences, toVideos } from "@/lib/landing-store";
import { roleHome } from "@/lib/roles";
export const metadata: Metadata = {
  title: { absolute: "Infulancer · Influencer marketing platformu" },
  description: "Influencer kampanyalarını brief'ten ödemeye kadar tek panelden yönetin: doğru içerik üreticisi, ölçülebilir sonuç.",
};
export const dynamic = "force-dynamic";
/** Girişli kullanıcı rol ana sayfasına gider; ziyaretçi tanıtım sayfasını görür. */
export default async function RootPage() {
  const actor = await getActor();
  if (actor) redirect(roleHome[actor.role]);
  const stats: LandingStats = await Promise.all([
    prisma.influencer.count(),
    prisma.socialAccount.aggregate({ _sum: { followers: true } }),
    prisma.campaign.count({ where: { status: { not: "IPTAL" } } }),
    prisma.deliverable.count({ where: { publishedAt: { not: null } } }),
  ])
    .then(([influencers, f, campaigns, published]) => ({ influencers, followers: f._sum.followers ?? 0, campaigns, published }))
    .catch(() => ({ influencers: 0, followers: 0, campaigns: 0, published: 0 }));
  const content = await getLandingContent();
  return <LandingPage stats={stats} data={{ videos: toVideos(content), references: toReferences(content), creators: content.creators }} />;
}
