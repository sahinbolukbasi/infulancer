import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@infulancer/core/db";
import { buildWalletLinks } from "@infulancer/core/wallet/passes";
import { mapLinks } from "@infulancer/core/wallet/maps";
import { googleCalendarUrl } from "@infulancer/core/wallet/ical";
import { QrImage, WalletButtons } from "@/components/wallet/pass-card";
import { CopyCode } from "@/components/wallet/copy-code";
import { prisma as db } from "@infulancer/core/db";
import { mediaSrc } from "@/lib/media";
import { fmtDateTime } from "@/lib/time";

export const metadata: Metadata = { title: "Etkinlik bileti" };
export const dynamic = "force-dynamic";

const statusTr: Record<string, string> = { GECERLI: "Geçerli", KULLANILDI: "Kullanıldı", IPTAL: "İptal" };
const statusColor: Record<string, string> = { GECERLI: "text-neon-lime", KULLANILDI: "text-fg-passive", IPTAL: "text-critical" };

/** Modern bilet kartı: gradient başlık, perfore ayraç, büyük QR, cüzdan + takvim + harita. */
export default async function TicketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ticket = await prisma.eventTicket.findUnique({ where: { id }, include: { event: true } });
  if (!ticket) notFound();
  const e = ticket.event;
  const links = await buildWalletLinks("ticket", ticket.id, ticket.code);
  const map = mapLinks({ latitude: e.latitude, longitude: e.longitude, address: e.address, venueName: e.venueName });
  const cover = mediaSrc(e.coverImageKey);
  const organizer = e.tenantId ? (await db.brand.findUnique({ where: { id: e.tenantId }, select: { name: true } }))?.name : null;
  const gcal = googleCalendarUrl({ uid: e.id, title: e.title, description: e.description, location: [e.venueName, e.address, e.city].filter(Boolean).join(", ") || null, startsAt: e.startsAt, endsAt: e.endsAt });

  return (
    <main className="relative min-h-dvh overflow-hidden bg-bg">
      {/* Arka plan: kapak görseli bulanık */}
      {cover ? (
        <div className="pointer-events-none absolute inset-0 opacity-20">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={cover} alt="" className="h-full w-full object-cover blur-2xl" />
        </div>
      ) : (
        <div className="pointer-events-none absolute inset-0 opacity-30 bg-[radial-gradient(60%_40%_at_50%_0%,rgba(255,43,214,0.35),transparent)]" />
      )}

      <div className="relative mx-auto flex max-w-md flex-col gap-4 px-4 py-8">
        {/* BİLET KARTI */}
        <div className="overflow-hidden rounded-[28px] border border-white/10 bg-black/40 shadow-2xl backdrop-blur-xl">
          {/* Üst: gradient + kapak */}
          <div className="relative h-44">
            {cover ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={cover} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="h-full w-full bg-[linear-gradient(135deg,#ff2bd6_0%,#7c3aed_55%,#05050a_100%)]" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 flex flex-col gap-1 p-5">
              <span className="w-fit rounded-full bg-white/15 px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wider text-white backdrop-blur">Etkinlik bileti</span>
              <h1 className="text-2xl font-semibold leading-tight text-white">{e.title}</h1>
              <p className="text-[13px] text-white/80">{e.endsAt ? `${fmtDateTime(e.startsAt)} – ${fmtDateTime(e.endsAt)}` : fmtDateTime(e.startsAt)}</p>
            </div>
          </div>

          {/* Bilgi satırı */}
          <div className="grid grid-cols-2 gap-px bg-white/5">
            <div className="bg-black/30 p-4">
              <span className="text-[11px] uppercase tracking-wide text-white/50">Katılımcı</span>
              <p className="truncate font-medium text-white">{ticket.holderName}</p>
            </div>
            <div className="bg-black/30 p-4">
              <span className="text-[11px] uppercase tracking-wide text-white/50">Durum</span>
              <p className={`font-medium ${statusColor[ticket.status]}`}>{statusTr[ticket.status]}</p>
            </div>
            <div className="col-span-2 bg-black/30 p-4">
              <span className="text-[11px] uppercase tracking-wide text-white/50">Düzenleyen</span>
              <p className="font-medium text-white">{organizer ?? "Infulancer"}</p>
            </div>
          </div>

          {/* Perfore ayraç */}
          <div className="relative flex items-center">
            <div className="h-5 w-5 -translate-x-1/2 rounded-full bg-bg" />
            <div className="flex-1 border-t border-dashed border-white/20" />
            <div className="h-5 w-5 translate-x-1/2 rounded-full bg-bg" />
          </div>

          {/* QR */}
          <div className="flex flex-col items-center gap-2 px-5 pb-6 pt-2">
            <QrImage dataUrl={links.qrDataUrl} alt={`Bilet kodu ${ticket.code}`} />
            <CopyCode code={ticket.code} label="Bilet kodu" />
            <span className="text-[11px] text-white/40">Girişte bu QR&apos;ı okutun</span>
          </div>
        </div>

        {/* Cüzdan */}
        <section className="rounded-3xl border border-white/10 bg-black/30 p-5 backdrop-blur-xl">
          <WalletButtons appleUrl={links.appleUrl} googleUrl={links.googleUrl} live={links.live} />
        </section>

        {/* Takvim */}
        <section className="flex flex-col gap-3 rounded-3xl border border-white/10 bg-black/30 p-5 backdrop-blur-xl">
          <span className="text-[11px] uppercase tracking-wide text-white/50">Takvime ekle</span>
          <div className="flex flex-wrap gap-2">
            <a href={gcal} target="_blank" rel="noreferrer" className="rounded-full border border-white/15 px-4 py-2 text-[13px] text-white hover:border-neon-pink">Google Takvim</a>
            <a href={`/api/etkinlik/${e.id}/ics`} className="rounded-full border border-white/15 px-4 py-2 text-[13px] text-white hover:border-neon-pink">Apple / Outlook</a>
          </div>
        </section>

        {/* Konum */}
        {map.hasCoords || e.address ? (
          <section className="flex flex-col gap-3 rounded-3xl border border-white/10 bg-black/30 p-5 backdrop-blur-xl">
            <span className="text-[11px] uppercase tracking-wide text-white/50">Konum</span>
            {e.venueName || e.address ? <p className="text-[13px] text-white/80">{[e.venueName, e.address, e.city].filter(Boolean).join(" · ")}</p> : null}
            {map.osmEmbed ? <iframe title="Harita" src={map.osmEmbed} className="h-44 w-full rounded-2xl border border-white/10" loading="lazy" /> : null}
            <div className="flex flex-wrap gap-2">
              <a href={map.google} target="_blank" rel="noreferrer" className="rounded-full border border-white/15 px-4 py-2 text-[13px] text-white hover:border-neon-pink">Google Haritalar</a>
              <a href={map.apple} target="_blank" rel="noreferrer" className="rounded-full border border-white/15 px-4 py-2 text-[13px] text-white hover:border-neon-pink">Apple Haritalar</a>
            </div>
          </section>
        ) : null}

        {e.description ? <p className="whitespace-pre-line rounded-3xl border border-white/10 bg-black/30 p-5 text-sm text-white/70 backdrop-blur-xl">{e.description}</p> : null}
      </div>
    </main>
  );
}
