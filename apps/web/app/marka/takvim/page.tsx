import { getTT } from "@/lib/i18n/tt-server";
import type { Metadata } from "next";
import { prisma } from "@infulancer/core/db";
import { CalendarScreen, parsePlatforms } from "@/components/calendar/calendar-screen";
import { PageHeader } from "@/components/ui/layout";
import { requireActor } from "@/lib/auth-guard";
import { buildCalendarRows, resolvePeriod, weekQueryRange } from "@/lib/calendar";
export const metadata: Metadata = { title: "Takvim" };
export const dynamic = "force-dynamic";
type SP = { tarih?: string | string[]; gorunum?: string | string[]; platform?: string | string[] };
/** Marka takvimi: yalnız kendi kampanyalarının paylaşımları (salt okunur). */
export default async function BrandCalendarPage({ searchParams }: { searchParams: Promise<SP> }) {
  const tt = await getTT();
  const actor = await requireActor("BRAND");
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const per = resolvePeriod(one(sp.gorunum) ?? "ay", one(sp.tarih));
  const platforms = parsePlatforms(sp.platform);
  const items = await prisma.deliverable.findMany({
    where: {
      plannedAt: weekQueryRange(per.days),
      platform: { in: platforms },
      status: { notIn: ["IPTAL", "TASLAK"] },
      assignment: { contractStatus: { not: "RED" }, campaign: { brandId: actor.brandId! } },
    },
    orderBy: { plannedAt: "asc" },
    select: {
      id: true,
      platform: true,
      contentType: true,
      status: true,
      plannedAt: true,
      approvalDeadline: true,
      contractViolation: true,
      assignment: { select: { campaignId: true, campaign: { select: { name: true } }, influencer: { select: { id: true, name: true, audienceTimezone: true } } } },
    },
  });
  const campaignOf = new Map(items.map((d) => [d.id, d.assignment.campaignId]));
  const rows = buildCalendarRows(
    per.days,
    // Marka ekranında sözleşme ihlali bayrağı gösterilmez (ajans iç bilgisi).
    items.map((d) => ({ ...d, contractViolation: false, campaignName: d.assignment.campaign.name, influencer: d.assignment.influencer })),
    (id) => `/marka/kampanyalar/${campaignOf.get(id)}#is-${id}`,
  );
  const total = rows.reduce((s, r) => s + r.cards.length, 0);
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={tt("Takvim")} description={`${total} paylaşım. Kampanyalarınızın yayın planı; saatler influencer kitlesinin saat dilimindedir.`} />
      <CalendarScreen basePath="/marka/takvim" per={per} platforms={platforms} rows={rows} />
    </div>
  );
}
