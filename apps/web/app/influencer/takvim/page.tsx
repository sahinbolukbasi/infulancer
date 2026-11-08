import type { Metadata } from "next";
import { prisma } from "@infulancer/core/db";
import { CalendarScreen, parsePlatforms } from "@/components/calendar/calendar-screen";
import { PageHeader } from "@/components/ui/layout";
import { requireActor } from "@/lib/auth-guard";
import { buildCalendarRows, resolvePeriod, weekQueryRange } from "@/lib/calendar";
export const metadata: Metadata = { title: "Takvim" };
export const dynamic = "force-dynamic";
type SP = { tarih?: string | string[]; gorunum?: string | string[]; platform?: string | string[] };
/** Influencer takvimi: kendi paylaşım tarihleri (kabul ettiği ve teklif aşamasındaki işler). */
export default async function InfluencerCalendarPage({ searchParams }: { searchParams: Promise<SP> }) {
  const actor = await requireActor("INFLUENCER");
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const per = resolvePeriod(one(sp.gorunum) ?? "ay", one(sp.tarih));
  const platforms = parsePlatforms(sp.platform);
  const items = await prisma.deliverable.findMany({
    where: {
      plannedAt: weekQueryRange(per.days),
      platform: { in: platforms },
      status: { not: "IPTAL" },
      assignment: { influencerId: actor.influencerId!, contractStatus: { not: "RED" } },
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
      assignment: { select: { campaign: { select: { name: true } }, influencer: { select: { id: true, name: true, audienceTimezone: true } } } },
    },
  });
  const rows = buildCalendarRows(
    per.days,
    items.map((d) => ({ ...d, campaignName: d.assignment.campaign.name, influencer: d.assignment.influencer })),
    (id) => `/influencer/isler/${id}`,
  );
  const total = rows.reduce((s, r) => s + r.cards.length, 0);
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Takvim" description={`${total} paylaşım. Saatler kitlenizin saat dilimindedir; karta tıklayınca iş ayrıntısı açılır.`} />
      <CalendarScreen basePath="/influencer/takvim" per={per} platforms={platforms} rows={rows} labelBy="campaign" />
    </div>
  );
}
