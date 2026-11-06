import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@infulancer/core/db";
import { mapLinks } from "@infulancer/core/wallet/maps";
import { googleCalendarUrl } from "@infulancer/core/wallet/ical";
import { DateBadge, InfoRow, PersonIcon, PinIcon, Pill } from "@/components/luma/primitives";
import { dateLong, rangeLabel } from "@/lib/event-format";
import { getActor } from "@/lib/auth-guard";
import { mediaSrc } from "@/lib/media";

export const dynamic = "force-dynamic";
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const e = await prisma.event.findUnique({ where: { id }, select: { title: true } });
  return { title: e?.title ?? "Etkinlik" };
}

/** Herkese açık etkinlik sayfası (Luma düzeni). Giriş yapmış davetli kendi biletine ulaşır. */
export default async function PublicEventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const e = await prisma.event.findUnique({ where: { id }, include: { tickets: { where: { status: { not: "IPTAL" } }, select: { id: true } } } });
  if (!e) notFound();
  const [brand, actor] = await Promise.all([e.tenantId ? prisma.brand.findUnique({ where: { id: e.tenantId }, select: { name: true } }) : null, getActor().catch(() => null)]);
  const myInvite = actor?.influencerId ? await prisma.eventInvite.findFirst({ where: { eventId: e.id, influencerId: actor.influencerId }, include: { ticket: true } }) : null;
  const organizer = brand?.name ?? "Infulancer";
  const cover = mediaSrc(e.coverImageKey);
  const gallery = (e.imageKeys ?? []).map((k) => mediaSrc(k)).filter((x): x is string => !!x);
  const map = mapLinks({ latitude: e.latitude, longitude: e.longitude, address: e.address, venueName: e.venueName });
  const location = [e.venueName, e.address, e.city].filter(Boolean).join(", ");
  const gcal = googleCalendarUrl({ uid: e.id, title: e.title, description: e.description, location: location || null, startsAt: e.startsAt, endsAt: e.endsAt });
  const past = (e.endsAt ?? e.startsAt) < new Date();
  const full = e.capacity != null && e.tickets.length >= e.capacity;
  const myTicket = myInvite?.ticket && myInvite.ticket.status !== "IPTAL" ? myInvite.ticket : null;

  return (
    <main className="min-h-dvh bg-bg">
      <div className="mx-auto grid max-w-5xl grid-cols-1 gap-8 px-4 py-10 md:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="flex flex-col gap-5">
          <div className="aspect-square w-full overflow-hidden rounded-3xl border border-line">
            {cover ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={cover} alt={`${e.title} kapak görseli`} className="h-full w-full object-cover" />
            ) : (
              <div className="h-full w-full bg-[linear-gradient(135deg,var(--color-neon-violet),var(--color-neon-pink))] opacity-85" />
            )}
          </div>
          <div className="flex flex-col gap-2">
            <span className="border-b border-line pb-2 text-[13px] font-medium text-fg-muted">Düzenleyen</span>
            <span className="flex items-center gap-2 font-medium text-fg">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-surface-hover text-[12px] font-semibold" aria-hidden>{organizer.slice(0, 1).toLocaleUpperCase("tr")}</span>
              {organizer}
            </span>
          </div>
          {e.tickets.length ? <p className="text-[13px] text-fg-muted">{e.tickets.length} kişi katılıyor</p> : null}
        </aside>

        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-2">
              <Pill>{e.visibility === "HERKESE_ACIK" ? "Herkese açık" : "Davetli etkinlik"}</Pill>
              {e.status === "TASLAK" ? <Pill tone="amber">Taslak · henüz yayınlanmadı</Pill> : past ? <Pill tone="gray">Sona erdi</Pill> : e.status === "IPTAL" ? <Pill tone="red">İptal edildi</Pill> : null}
            </div>
            <h1 className="text-[34px] font-semibold leading-tight tracking-tight text-fg">{e.title}</h1>
          </div>

          <div className="flex flex-col gap-4">
            <InfoRow icon={<DateBadge date={e.startsAt} size="sm" />} title={rangeLabel(e.startsAt, e.endsAt)}>{dateLong(e.startsAt)}</InfoRow>
            <InfoRow icon={<PinIcon />} title={e.venueName || "Konum"}>{[e.address, e.city].filter(Boolean).join(", ") || "Ayrıntılar davetlilerle paylaşılır"}</InfoRow>
            <InfoRow icon={<PersonIcon />} title={e.capacity ? `${e.tickets.length}/${e.capacity} yer dolu` : "Sınırsız katılım"}>{full ? "Kapasite doldu" : null}</InfoRow>
          </div>

          <section className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-5" aria-label="Katılım">
            <h2 className="text-[13px] font-medium text-fg-muted">Katılım</h2>
            {myTicket ? (
              <>
                <p className="font-medium text-fg">Katılıyorsunuz. Biletiniz hazır.</p>
                <Link href={`/bilet/${myTicket.id}`} className="w-fit rounded-full bg-fg px-4 py-2 text-[14px] font-medium text-bg hover:opacity-90">Biletimi göster</Link>
              </>
            ) : myInvite ? (
              <>
                <p className="text-fg">Bu etkinliğe davetlisiniz.</p>
                <Link href="/influencer/davetlerim" className="w-fit rounded-full bg-fg px-4 py-2 text-[14px] font-medium text-bg hover:opacity-90">Katılımımı bildir</Link>
              </>
            ) : (
              <p className="text-[14px] text-fg-muted">{e.visibility === "KAPALI" ? "Bu etkinliğe katılım davet iledir. Davetliyseniz bilet bağlantınızı kullanın." : "Katılmak için düzenleyenin davetini bekleyin ya da hesabınızdan iletişime geçin."}</p>
            )}
            <div className="flex flex-wrap gap-2 border-t border-line pt-3 text-[13px]">
              <a href={gcal} target="_blank" rel="noreferrer" className="rounded-full border border-line px-3 py-1.5 text-fg hover:border-line-strong">Google Takvim</a>
              <a href={`/api/etkinlik/${e.id}/ics`} className="rounded-full border border-line px-3 py-1.5 text-fg hover:border-line-strong">Apple / Outlook</a>
            </div>
          </section>

          <section className="flex flex-col gap-2" aria-label="Etkinlik hakkında">
            <h2 className="border-b border-line pb-2 text-[13px] font-medium text-fg-muted">Hakkında</h2>
            <p className="whitespace-pre-line text-[15px] leading-relaxed text-fg">{e.description}</p>
          </section>

          {gallery.length ? (
            <section className="grid grid-cols-2 gap-3 sm:grid-cols-3" aria-label="Galeri">
              {gallery.map((g, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={i} src={g} alt={`Galeri görseli ${i + 1}`} className="aspect-square w-full rounded-2xl object-cover" />
              ))}
            </section>
          ) : null}

          {map.hasCoords || e.address ? (
            <section className="flex flex-col gap-3" aria-label="Konum">
              <h2 className="border-b border-line pb-2 text-[13px] font-medium text-fg-muted">Konum</h2>
              {location ? <p className="text-[14px] text-fg">{location}</p> : null}
              {map.osmEmbed ? <iframe title="Etkinlik konumu haritası" src={map.osmEmbed} className="h-60 w-full rounded-2xl border border-line" loading="lazy" /> : null}
              <div className="flex flex-wrap gap-2 text-[13px]">
                <a href={map.google} target="_blank" rel="noreferrer" className="rounded-full border border-line px-3 py-1.5 text-fg hover:border-line-strong">Google Haritalar&apos;da aç</a>
                <a href={map.apple} target="_blank" rel="noreferrer" className="rounded-full border border-line px-3 py-1.5 text-fg hover:border-line-strong">Apple Haritalar&apos;da aç</a>
              </div>
            </section>
          ) : null}
        </div>
      </div>
    </main>
  );
}
