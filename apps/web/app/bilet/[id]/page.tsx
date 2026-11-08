import { getTT } from "@/lib/i18n/tt-server";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@infulancer/core/db";
import { buildWalletLinks } from "@infulancer/core/wallet/passes";
import { mapLinks } from "@infulancer/core/wallet/maps";
import { googleCalendarUrl } from "@infulancer/core/wallet/ical";
import { TicketCard } from "@/components/luma/pass-cards";
import { QrImage, WalletButtons } from "@/components/wallet/pass-card";
import { rangeLabel } from "@/lib/event-format";
import { mediaSrc } from "@/lib/media";
import { BRAND_NAME } from "@/lib/brand";

export const metadata: Metadata = { title: "Etkinlik bileti" };
export const dynamic = "force-dynamic";

const statusView: Record<string, { label: string; tone: "ok" | "used" | "void" }> = {
  GECERLI: { label: "Geçerli", tone: "ok" },
  KULLANILDI: { label: "Giriş yapıldı", tone: "used" },
  IPTAL: { label: "İptal", tone: "void" },
};

/** Herkese açık bilet: beyaz bilet kartı (QR + kopyalanabilir kod), cüzdan, takvim, konum. */
export default async function TicketPage({ params }: { params: Promise<{ id: string }> }) {
  const tt = await getTT();
  const { id } = await params;
  const ticket = await prisma.eventTicket.findUnique({ where: { id }, include: { event: true, invite: { select: { influencerId: true } } } });
  if (!ticket) notFound();
  const e = ticket.event;
  // Sahip adı sistemdeki influencer adından; yoksa bilete yazılan ad.
  const [brand, influencer] = await Promise.all([
    e.tenantId ? prisma.brand.findUnique({ where: { id: e.tenantId }, select: { name: true } }) : null,
    ticket.invite?.influencerId ? prisma.influencer.findUnique({ where: { id: ticket.invite.influencerId }, select: { name: true } }) : null,
  ]);
  const holder = influencer?.name ?? ticket.holderName;
  const organizer = brand?.name ?? BRAND_NAME;
  const links = await buildWalletLinks("ticket", ticket.id, ticket.code);
  const map = mapLinks({ latitude: e.latitude, longitude: e.longitude, address: e.address, venueName: e.venueName });
  const location = [e.venueName, e.address, e.city].filter(Boolean).join(", ");
  const gcal = googleCalendarUrl({ uid: e.id, title: e.title, description: e.description, location: location || null, startsAt: e.startsAt, endsAt: e.endsAt });
  const st = statusView[ticket.status] ?? { label: ticket.status, tone: "ok" as const };

  return (
    <main className="min-h-dvh bg-bg">
      <div className="mx-auto flex max-w-md flex-col items-center gap-5 px-4 py-8">
        <TicketCard
          title={e.title}
          organizer={organizer}
          holderName={holder}
          dateLabel={rangeLabel(e.startsAt, e.endsAt)}
          venueLabel={location || null}
          code={ticket.code}
          statusLabel={st.label}
          statusTone={st.tone}
          coverSrc={mediaSrc(e.coverImageKey)}
          qr={<QrImage dataUrl={links.qrDataUrl} alt={`Bilet QR kodu ${ticket.code}`} />}
        />

        <section className="w-full rounded-2xl border border-line bg-surface p-4" aria-label={tt("Cüzdana ekle")}>
          <WalletButtons appleUrl={links.appleUrl} googleUrl={links.googleUrl} live={links.live} />
          <a href={`/api/bilet/${ticket.id}/pdf`} className="mt-3 flex w-full items-center justify-center gap-2 rounded-full border border-line px-4 py-2.5 text-[13px] font-medium text-fg hover:border-line-strong">{tt("PDF olarak indir")}</a>
        </section>

        <section className="flex w-full flex-col gap-3 rounded-2xl border border-line bg-surface p-4" aria-label={tt("Takvim ve konum")}>
          <div className="flex flex-wrap gap-2 text-[13px]">
            <a href={gcal} target="_blank" rel="noreferrer" className="rounded-full border border-line px-3 py-1.5 text-fg hover:border-line-strong">{tt("Google Takvim'e ekle")}</a>
            <a href={`/api/etkinlik/${e.id}/ics`} className="rounded-full border border-line px-3 py-1.5 text-fg hover:border-line-strong">{tt("Apple / Outlook (.ics)")}</a>
            {map.hasCoords || e.address ? (
              <>
                <a href={map.google} target="_blank" rel="noreferrer" className="rounded-full border border-line px-3 py-1.5 text-fg hover:border-line-strong">{tt("Google Haritalar")}</a>
                <a href={map.apple} target="_blank" rel="noreferrer" className="rounded-full border border-line px-3 py-1.5 text-fg hover:border-line-strong">{tt("Apple Haritalar")}</a>
              </>
            ) : null}
          </div>
          <Link href={`/etkinlik/${e.id}`} className="w-fit text-[13px] font-medium text-fg underline-offset-4 hover:underline">{tt("Etkinlik sayfasını görüntüle →")}</Link>
        </section>
      </div>
    </main>
  );
}
