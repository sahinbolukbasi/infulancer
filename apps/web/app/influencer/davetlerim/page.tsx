import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@infulancer/core/db";
import { couponValueLabel } from "@infulancer/core/coupons/service";
import { InviteResponse } from "@/components/events/event-forms";
import { Card, CardTitle } from "@/components/ui/card";
import { mediaSrc } from "@/lib/media";
import { PageHeader } from "@/components/ui/layout";
import { StatusDot } from "@/components/ui/status";
import { Tabs } from "@/components/ui/tabs";
import { requireActor } from "@/lib/auth-guard";
import { fmtDateTime, fmtDate } from "@/lib/time";

export const metadata: Metadata = { title: "Davetlerim" };
export const dynamic = "force-dynamic";
const inviteTr: Record<string, string> = { DAVET_EDILDI: "Yanıt bekliyor", KATILIM_TALEBI: "Talebiniz iletildi", KABUL: "Katılıyorum", RED: "Katılmıyorum", IPTAL: "İptal" };

export default async function InfluencerInvitesPage() {
  const actor = await requireActor("INFLUENCER");
  const id = actor.influencerId!;
  const [invites, grants] = await Promise.all([
    prisma.eventInvite.findMany({ where: { influencerId: id }, orderBy: { createdAt: "desc" }, include: { event: { select: { id: true, title: true, startsAt: true, endsAt: true, city: true, tenantId: true } }, ticket: true } }),
    prisma.couponGrant.findMany({ where: { influencerId: id }, orderBy: { createdAt: "desc" }, include: { coupon: { select: { title: true, kind: true, valueType: true, value: true, validUntil: true, logoKey: true } } } }),
  ]);
  const orgNames = new Map(
    (await prisma.brand.findMany({ where: { id: { in: invites.map((i) => i.event.tenantId).filter((x): x is string => !!x) } }, select: { id: true, name: true } })).map((b) => [b.id, b.name]),
  );
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
                  {invites.map((inv) => {
                    const hasTicket = !!inv.ticket && inv.ticket.status !== "IPTAL";
                    return (
                    <li key={inv.id}>
                      <Card interactive={false} className="flex flex-col gap-3">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="flex flex-col">
                            <CardTitle>{inv.event.title}</CardTitle>
                            <span className="text-[13px] text-fg-muted">{inv.event.tenantId ? `${orgNames.get(inv.event.tenantId) ?? "Marka"} · ` : "Ajans · "}{fmtDateTime(inv.event.startsAt)}{inv.event.endsAt ? ` – ${fmtDateTime(inv.event.endsAt)}` : ""}{inv.event.city ? ` · ${inv.event.city}` : ""}</span>
                          </div>
                          <StatusDot tone={inv.status === "KABUL" ? "active" : inv.status === "RED" ? "critical" : "muted"}>{inviteTr[inv.status]}</StatusDot>
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
                          <span className="flex items-center gap-3 text-[13px]">
                            {hasTicket ? <Link href={`/bilet/${inv.ticket!.id}`} className="font-medium text-neon-pink hover:underline">Etkinlik sayfası ve biletim →</Link> : null}
                            {hasTicket ? <a href={`/api/etkinlik/${inv.event.id}/ics`} className="text-fg-muted hover:text-fg">Takvime ekle</a> : null}
                          </span>
                          {inv.status !== "IPTAL" ? (
                            <span className="flex flex-col items-end gap-1">
                              <span className="text-[11px] text-fg-passive">Katılım durumu</span>
                              <InviteResponse inviteId={inv.id} />
                            </span>
                          ) : null}
                        </div>
                      </Card>
                    </li>
                    );
                  })}
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
                          <div className="flex items-center gap-3">
                            {mediaSrc(g.coupon.logoKey) ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={mediaSrc(g.coupon.logoKey)!} alt="" className="h-11 w-11 rounded-xl object-cover ring-1 ring-line" />
                            ) : null}
                            <div className="flex flex-col">
                              <CardTitle>{g.coupon.title}</CardTitle>
                              <span className="text-[13px] text-fg-muted">{g.coupon.kind === "HEDIYE_CEKI" ? "Hediye çeki" : "Kupon"} · {couponValueLabel(g.coupon.valueType, g.coupon.value)}{g.coupon.validUntil ? ` · son ${fmtDate(g.coupon.validUntil)}` : ""}</span>
                              <span className="text-[12px] text-neon-pink">Kodu ve kullanım detaylarını gör →</span>
                            </div>
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
