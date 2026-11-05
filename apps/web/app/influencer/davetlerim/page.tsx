import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@infulancer/core/db";
import { couponValueLabel } from "@infulancer/core/coupons/service";
import { InviteResponse } from "@/components/events/event-forms";
import { Card, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/layout";
import { StatusDot } from "@/components/ui/status";
import { Tabs } from "@/components/ui/tabs";
import { requireActor } from "@/lib/auth-guard";
import { fmtDateTime, fmtDate } from "@/lib/time";

export const metadata: Metadata = { title: "Davetlerim" };
export const dynamic = "force-dynamic";
const inviteTr: Record<string, string> = { DAVET_EDILDI: "Yanıt bekliyor", KATILIM_TALEBI: "Talebiniz iletildi", KABUL: "Katılıyorsunuz", RED: "Reddettiniz", IPTAL: "İptal" };

export default async function InfluencerInvitesPage() {
  const actor = await requireActor("INFLUENCER");
  const id = actor.influencerId!;
  const [invites, grants] = await Promise.all([
    prisma.eventInvite.findMany({ where: { influencerId: id }, orderBy: { createdAt: "desc" }, include: { event: { select: { id: true, title: true, startsAt: true, city: true } }, ticket: true } }),
    prisma.couponGrant.findMany({ where: { influencerId: id }, orderBy: { createdAt: "desc" }, include: { coupon: { select: { title: true, kind: true, valueType: true, value: true, validUntil: true } } } }),
  ]);
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Davetlerim" description="Etkinlik davetleriniz, biletleriniz ve markalardan gelen kupon/hediye çekleriniz." />
      <Tabs
        label="Davet bölümleri"
        tabs={[
          {
            id: "etkinlik",
            label: `Etkinlikler (${invites.length})`,
            content:
              invites.length === 0 ? (
                <p className="text-sm text-fg-passive">Henüz davet yok.</p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {invites.map((inv) => (
                    <li key={inv.id}>
                      <Card interactive={false} className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex flex-col">
                          <CardTitle>{inv.event.title}</CardTitle>
                          <span className="text-[13px] text-fg-muted">{fmtDateTime(inv.event.startsAt)}{inv.event.city ? ` · ${inv.event.city}` : ""} · {inviteTr[inv.status]}</span>
                        </div>
                        {inv.ticket ? (
                          <Link href={`/bilet/${inv.ticket.id}`} className="text-[13px] text-neon-pink hover:underline">Biletim →</Link>
                        ) : inv.status === "DAVET_EDILDI" ? (
                          <InviteResponse inviteId={inv.id} />
                        ) : null}
                      </Card>
                    </li>
                  ))}
                </ul>
              ),
          },
          {
            id: "kupon",
            label: `Kuponlar (${grants.length})`,
            content:
              grants.length === 0 ? (
                <p className="text-sm text-fg-passive">Henüz kupon yok.</p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {grants.map((g) => (
                    <li key={g.id}>
                      <Link href={`/kupon/${g.id}`} className="block">
                        <Card className="flex flex-wrap items-center justify-between gap-3">
                          <div className="flex flex-col">
                            <CardTitle>{g.coupon.title}</CardTitle>
                            <span className="text-[13px] text-fg-muted">{g.coupon.kind === "HEDIYE_CEKI" ? "Hediye çeki" : "Kupon"} · {couponValueLabel(g.coupon.valueType, g.coupon.value)}{g.coupon.validUntil ? ` · son ${fmtDate(g.coupon.validUntil)}` : ""}</span>
                          </div>
                          <StatusDot tone={g.status === "KULLANILDI" ? "passive" : "active"}>{g.status === "KULLANILDI" ? "Kullanıldı" : "Aktif"}</StatusDot>
                        </Card>
                      </Link>
                    </li>
                  ))}
                </ul>
              ),
          },
        ]}
      />
    </div>
  );
}
