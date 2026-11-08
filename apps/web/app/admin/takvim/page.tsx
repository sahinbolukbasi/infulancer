import { getTT } from "@/lib/i18n/tt-server";
import type { Metadata } from "next";
import { prisma } from "@infulancer/core/db";
import { CalendarScreen, parsePlatforms } from "@/components/calendar/calendar-screen";
import { PageHeader } from "@/components/ui/layout";
import { requireActor } from "@/lib/auth-guard";
import { buildCalendarRows, resolvePeriod, weekQueryRange } from "@/lib/calendar";
export const metadata: Metadata = { title: "Takvim" };
type SP = { hafta?: string | string[]; tarih?: string | string[]; gorunum?: string | string[]; platform?: string | string[] };
export default async function CalendarPage({ searchParams }: { searchParams: Promise<SP> }) {
  const tt = await getTT();
  await requireActor("ADMIN");
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const per = resolvePeriod(one(sp.gorunum), one(sp.tarih) ?? one(sp.hafta));
  const platforms = parsePlatforms(sp.platform);
  const items = await prisma.deliverable.findMany({
    where: { plannedAt: weekQueryRange(per.days), platform: { in: platforms }, status: { not: "IPTAL" }, assignment: { contractStatus: { not: "RED" } } },
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
    (id) => `/admin/teslimler/${id}`,
  );
  const total = rows.reduce((s, r) => s + r.cards.length, 0);
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={tt("Takvim")} description={`${total} paylaşım planlı. Haftalık görünümde kartı sürükleyerek tarih değiştirin.`} />
      <CalendarScreen basePath="/admin/takvim" per={per} platforms={platforms} rows={rows} editable />
    </div>
  );
}
