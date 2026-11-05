import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@infulancer/core/db";
import { buildWalletLinks } from "@infulancer/core/wallet/passes";
import { mapLinks } from "@infulancer/core/wallet/maps";
import { QrImage, WalletButtons } from "@/components/wallet/pass-card";
import { mediaSrc } from "@/lib/media";
import { fmtDateTime } from "@/lib/time";

export const metadata: Metadata = { title: "Etkinlik bileti" };
export const dynamic = "force-dynamic";

/** Herkese açık bilet görünümü: QR, katılımcı adı, etkinlik, konum (harita) ve cüzdan butonları. */
export default async function TicketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ticket = await prisma.eventTicket.findUnique({
    where: { id },
    include: { event: true },
  });
  if (!ticket) notFound();
  const e = ticket.event;
  const links = await buildWalletLinks("ticket", ticket.id, ticket.code);
  const map = mapLinks({ latitude: e.latitude, longitude: e.longitude, address: e.address, venueName: e.venueName });
  const cover = mediaSrc(e.coverImageKey);
  const statusTr: Record<string, string> = { GECERLI: "Geçerli", KULLANILDI: "Kullanıldı", IPTAL: "İptal" };
  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col gap-5 p-5">
      <div className="overflow-hidden rounded-3xl border border-line bg-glass">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover} alt="" className="h-40 w-full object-cover" />
        ) : (
          <div className="bg-neon h-24 w-full" />
        )}
        <div className="flex flex-col gap-1 p-5">
          <span className="text-[12px] uppercase tracking-wide text-fg-passive">Etkinlik bileti · {statusTr[ticket.status]}</span>
          <h1 className="text-2xl font-semibold">{e.title}</h1>
          <p className="text-fg-muted">{fmtDateTime(e.startsAt)}</p>
          {e.venueName || e.address ? <p className="text-[13px] text-fg-muted">{[e.venueName, e.address, e.city].filter(Boolean).join(" · ")}</p> : null}
        </div>
      </div>

      <div className="flex flex-col items-center gap-3 rounded-3xl border border-line bg-surface p-6">
        <span className="text-[13px] text-fg-muted">Bilet sahibi</span>
        <span className="text-xl font-semibold">{ticket.holderName}</span>
        <QrImage dataUrl={links.qrDataUrl} alt={`Bilet kodu ${ticket.code}`} />
        <span className="font-mono text-[13px] text-fg-muted">{ticket.code}</span>
      </div>

      <WalletButtons appleUrl={links.appleUrl} googleUrl={links.googleUrl} live={links.live} />

      {map.hasCoords || e.address ? (
        <div className="flex flex-col gap-2 rounded-3xl border border-line bg-glass p-5">
          <span className="text-label text-fg-muted">Konum</span>
          {map.osmEmbed ? <iframe title="Harita" src={map.osmEmbed} className="h-48 w-full rounded-xl border border-line" loading="lazy" /> : null}
          <div className="flex flex-wrap gap-2">
            <a href={map.google} target="_blank" rel="noreferrer" className="rounded-full border border-line px-3 py-1.5 text-[13px] hover:border-neon-pink">Google Haritalar&apos;da aç</a>
            <a href={map.apple} target="_blank" rel="noreferrer" className="rounded-full border border-line px-3 py-1.5 text-[13px] hover:border-neon-pink">Apple Haritalar&apos;da aç</a>
          </div>
        </div>
      ) : null}

      {e.description ? <p className="whitespace-pre-line rounded-3xl border border-line bg-glass p-5 text-sm text-fg-muted">{e.description}</p> : null}
    </main>
  );
}
