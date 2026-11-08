import { audit, type AuditActor } from "../audit";
import { prisma } from "../db";
import { publish } from "../events";

const SYSTEM: AuditActor = { id: null, role: "SYSTEM" };

/**
 * Bitiş tarihi geçen AKTIF kampanyaları otomatik kapatır (KAPANDI + closedAt = bitiş).
 * Kapanınca influencer hakedişleri bekleme süresi (HOLD_DAYS, varsayılan 0) sonunda çekilebilir olur
 * ve influencerlara bildirim gider. Idempotent: yalnız AKTIF olanlar kapanır.
 */
export async function closeEndedCampaigns(now: Date = new Date()): Promise<number> {
  const ended = await prisma.campaign.findMany({ where: { status: "AKTIF", endsAt: { lte: now } }, select: { id: true, name: true, endsAt: true }, take: 200 });
  let closed = 0;
  for (const c of ended) {
    const n = await prisma.campaign.updateMany({ where: { id: c.id, status: "AKTIF" }, data: { status: "KAPANDI", closedAt: c.endsAt } });
    if (n.count !== 1) continue;
    closed++;
    await audit.append({ actor: SYSTEM, action: "CAMPAIGN_CLOSED", entityType: "Campaign", entityId: c.id, data: { from: "AKTIF", to: "KAPANDI", closedAt: c.endsAt.toISOString(), auto: true } });
    const people = await prisma.assignment.findMany({ where: { campaignId: c.id, contractStatus: "KABUL" }, select: { influencer: { select: { user: { select: { id: true } } } } } });
    const userIds = people.map((p) => p.influencer.user?.id).filter((x): x is string => !!x);
    if (userIds.length) {
      await prisma.notification.createMany({
        data: userIds.map((userId) => ({ userId, title: "Kampanya tamamlandı", body: `"${c.name}" bitti. Tamamlanan işlerinizin hakedişi Ödemeler sayfasında çekilebilir bakiyeye geçti.`, href: "/influencer/odemeler" })),
      });
    }
    await publish({ type: "CAMPAIGN_CLOSED", campaignId: c.id }).catch(() => undefined);
  }
  return closed;
}
