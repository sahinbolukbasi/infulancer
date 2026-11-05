import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@infulancer/core/db";
import { mapLinks } from "@infulancer/core/wallet/maps";
import { CheckInForm, EventStatusButton, InviteForm, InviteResponse } from "@/components/events/event-forms";
import { mediaSrc } from "@/lib/media";
import { Card, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/layout";
import { StatusDot } from "@/components/ui/status";
import { requireActor } from "@/lib/auth-guard";
import { fmtDateTime } from "@/lib/time";

export const metadata: Metadata = { title: "Etkinlik" };
export const dynamic = "force-dynamic";

const statusTr: Record<string, string> = { TASLAK: "Taslak", YAYINDA: "Yayında", IPTAL: "İptal", TAMAMLANDI: "Tamamlandı" };
const inviteTr: Record<string, string> = { DAVET_EDILDI: "Davet edildi", KATILIM_TALEBI: "Katılım talebi", KABUL: "Kabul", RED: "Ret", IPTAL: "İptal" };

export default async function AdminEventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireActor("ADMIN");
  const { id } = await params;
  const e = await prisma.event.findUnique({
    where: { id },
    include: {
      invites: { orderBy: { createdAt: "desc" }, include: { ticket: true } },
      tickets: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!e) notFound();
  const influencers = (await prisma.influencer.findMany({ where: { user: { status: "ACTIVE" } }, orderBy: { name: "asc" }, select: { id: true, name: true, category: true } }));
  const organizer = e.tenantId ? await prisma.brand.findUnique({ where: { id: e.tenantId }, select: { name: true } }) : null;
  const creator = e.createdByUserId ? await prisma.user.findUnique({ where: { id: e.createdByUserId }, select: { name: true } }) : null;
  const influencerNames = new Map(
    (await prisma.influencer.findMany({ where: { id: { in: e.invites.map((i) => i.influencerId).filter((x): x is string => !!x) } }, select: { id: true, name: true } })).map((x) => [x.id, x.name]),
  );
  const map = mapLinks({ latitude: e.latitude, longitude: e.longitude, address: e.address, venueName: e.venueName });
  const cover = mediaSrc(e.coverImageKey);
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={e.title}
        description={`${fmtDateTime(e.startsAt)} · ${e.visibility === "HERKESE_ACIK" ? "Herkese açık" : "Kapalı"}`}
        actions={<StatusDot tone={e.status === "YAYINDA" ? "active" : e.status === "IPTAL" ? "critical" : "muted"}>{statusTr[e.status]}</StatusDot>}
      />

      <div className="flex flex-wrap gap-2">
        {e.status === "TASLAK" ? <EventStatusButton id={e.id} to="YAYINDA" label="Yayına al" variant="primary" /> : null}
        {e.status === "YAYINDA" ? <EventStatusButton id={e.id} to="TAMAMLANDI" label="Tamamlandı işaretle" /> : null}
        {e.status !== "IPTAL" && e.status !== "TAMAMLANDI" ? <EventStatusButton id={e.id} to="IPTAL" label="İptal et" variant="ghost" /> : null}
      </div>

      {cover ? (
        <div className="overflow-hidden rounded-3xl border border-line">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={cover} alt="" className="h-48 w-full object-cover" />
        </div>
      ) : null}
      <Card interactive={false} className="flex flex-col gap-2">
        <CardTitle>Detaylar</CardTitle>
        <p className="whitespace-pre-line text-sm text-fg-muted">{e.description}</p>
        {e.venueName || e.address ? <p className="text-[13px] text-fg-muted">{[e.venueName, e.address, e.city].filter(Boolean).join(" · ")}</p> : null}
        {map.hasCoords || e.address ? (
          <div className="flex flex-wrap gap-2 pt-1">
            <a href={map.google} target="_blank" rel="noreferrer" className="rounded-full border border-line px-3 py-1 text-[12px] hover:border-neon-pink">Google Haritalar</a>
            <a href={map.apple} target="_blank" rel="noreferrer" className="rounded-full border border-line px-3 py-1 text-[12px] hover:border-neon-pink">Apple Haritalar</a>
          </div>
        ) : null}
      </Card>
      <Card interactive={false} className="flex flex-col gap-1">
        <CardTitle>Düzenleyen</CardTitle>
        <p className="text-sm text-fg-muted">{organizer?.name ?? "Ajans"}{creator ? ` · ${creator.name}` : ""}</p>
        <p className="text-[12px] text-fg-passive">{e.endsAt ? `${fmtDateTime(e.startsAt)} – ${fmtDateTime(e.endsAt)}` : fmtDateTime(e.startsAt)}</p>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card interactive={false} className="flex flex-col gap-3">
          <CardTitle>Davet gönder</CardTitle>
          <InviteForm eventId={e.id} influencers={influencers} />
        </Card>
        <Card interactive={false} className="flex flex-col gap-3">
          <CardTitle>Kapıda giriş (QR)</CardTitle>
          <CheckInForm />
        </Card>
      </div>

      <Card interactive={false} className="flex flex-col gap-3">
        <CardTitle>Davetler ve talepler ({e.invites.length})</CardTitle>
        {e.invites.length === 0 ? (
          <p className="text-sm text-fg-passive">Henüz davet yok.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-line">
            {e.invites.map((inv) => (
              <li key={inv.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <span className="flex flex-col">
                  <span className="text-sm">{inv.influencerId ? (influencerNames.get(inv.influencerId) ?? "Influencer") : inv.guestName ?? "Misafir"}</span>
                  <span className="text-[12px] text-fg-muted">{inviteTr[inv.status]}{inv.isRequest ? " (talep)" : ""}</span>
                </span>
                <span className="flex items-center gap-3">
                  {inv.ticket ? (
                    <Link href={`/bilet/${inv.ticket.id}`} className="text-[13px] text-neon-pink hover:underline">Bileti gör →</Link>
                  ) : inv.status === "DAVET_EDILDI" || inv.status === "KATILIM_TALEBI" ? (
                    <InviteResponse inviteId={inv.id} />
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card interactive={false} className="flex flex-col gap-3">
        <CardTitle>Biletler ({e.tickets.length})</CardTitle>
        {e.tickets.length === 0 ? (
          <p className="text-sm text-fg-passive">Henüz bilet üretilmedi.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-line">
            {e.tickets.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <span>{t.holderName}</span>
                <span className="flex items-center gap-3">
                  <span className="font-mono text-[12px] text-fg-muted">{t.code}</span>
                  <StatusDot tone={t.status === "KULLANILDI" ? "passive" : t.status === "IPTAL" ? "critical" : "active"}>
                    {t.status === "KULLANILDI" ? "Giriş yapıldı" : t.status === "IPTAL" ? "İptal" : "Geçerli"}
                  </StatusDot>
                  <Link href={`/bilet/${t.id}`} className="text-[13px] text-neon-pink hover:underline">Bilet →</Link>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
