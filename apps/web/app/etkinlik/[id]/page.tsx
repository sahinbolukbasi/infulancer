import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@infulancer/core/db";
import { mapLinks } from "@infulancer/core/wallet/maps";
import { googleCalendarUrl } from "@infulancer/core/wallet/ical";
import { mediaSrc } from "@/lib/media";
import { fmtDateTime } from "@/lib/time";

export const dynamic = "force-dynamic";
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const e = await prisma.event.findUnique({ where: { id }, select: { title: true } });
  return { title: e?.title ?? "Etkinlik" };
}

/** Herkese açık etkinlik sayfası: tüm detaylar, görseller, konum/harita, takvim. */
export default async function PublicEventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const e = await prisma.event.findUnique({ where: { id }, include: { _count: { select: { tickets: true } } } });
  if (!e) notFound();
  const organizer = e.tenantId ? (await prisma.brand.findUnique({ where: { id: e.tenantId }, select: { name: true } }))?.name : "Infulancer";
  const cover = mediaSrc(e.coverImageKey);
  const gallery = (e.imageKeys ?? []).map((k) => mediaSrc(k)).filter((x): x is string => !!x);
  const map = mapLinks({ latitude: e.latitude, longitude: e.longitude, address: e.address, venueName: e.venueName });
  const gcal = googleCalendarUrl({ uid: e.id, title: e.title, description: e.description, location: [e.venueName, e.address, e.city].filter(Boolean).join(", ") || null, startsAt: e.startsAt, endsAt: e.endsAt });
  const past = e.startsAt < new Date();

  return (
    <main className="relative min-h-dvh bg-bg">
      <div className="pointer-events-none absolute inset-0 opacity-25 bg-[radial-gradient(70%_40%_at_50%_0%,rgba(124,58,237,0.4),transparent)]" />
      <div className="relative mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8">
        {/* Hero */}
        <div className="overflow-hidden rounded-[28px] border border-white/10 shadow-2xl">
          <div className="relative h-56">
            {cover ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={cover} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="h-full w-full bg-[linear-gradient(135deg,#ff2bd6,#7c3aed,#05050a)]" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
            <div className="absolute bottom-0 flex flex-col gap-2 p-6">
              <span className="w-fit rounded-full bg-white/15 px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wider text-white backdrop-blur">{e.visibility === "HERKESE_ACIK" ? "Herkese açık etkinlik" : "Özel etkinlik"}</span>
              <h1 className="text-3xl font-semibold leading-tight text-white">{e.title}</h1>
              <p className="text-white/80">{organizer} · {e.endsAt ? `${fmtDateTime(e.startsAt)} – ${fmtDateTime(e.endsAt)}` : fmtDateTime(e.startsAt)}</p>
            </div>
          </div>
        </div>

        <section className="rounded-3xl border border-white/10 bg-black/30 p-6 backdrop-blur-xl">
          <h2 className="mb-2 text-sm font-medium text-white/60">Etkinlik hakkında</h2>
          <p className="whitespace-pre-line text-white/90">{e.description}</p>
          <dl className="mt-4 grid grid-cols-2 gap-4 text-sm">
            {e.venueName ? <div><dt className="text-white/40">Mekan</dt><dd className="text-white">{e.venueName}</dd></div> : null}
            {e.city ? <div><dt className="text-white/40">Şehir</dt><dd className="text-white">{e.city}</dd></div> : null}
            {e.capacity ? <div><dt className="text-white/40">Kapasite</dt><dd className="text-white">{e._count.tickets}/{e.capacity}</dd></div> : null}
            <div><dt className="text-white/40">Durum</dt><dd className="text-white">{past ? "Geçti" : e.status === "YAYINDA" ? "Yayında" : e.status}</dd></div>
          </dl>
        </section>

        {gallery.length ? (
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {gallery.map((g, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={i} src={g} alt="" className="aspect-square w-full rounded-2xl object-cover" />
            ))}
          </section>
        ) : null}

        <section className="flex flex-col gap-3 rounded-3xl border border-white/10 bg-black/30 p-6 backdrop-blur-xl">
          <h2 className="text-sm font-medium text-white/60">Takvime ekle</h2>
          <div className="flex flex-wrap gap-2">
            <a href={gcal} target="_blank" rel="noreferrer" className="rounded-full border border-white/15 px-4 py-2 text-[13px] text-white hover:border-neon-pink">Google Takvim</a>
            <a href={`/api/etkinlik/${e.id}/ics`} className="rounded-full border border-white/15 px-4 py-2 text-[13px] text-white hover:border-neon-pink">Apple / Outlook</a>
          </div>
        </section>

        {map.hasCoords || e.address ? (
          <section className="flex flex-col gap-3 rounded-3xl border border-white/10 bg-black/30 p-6 backdrop-blur-xl">
            <h2 className="text-sm font-medium text-white/60">Konum</h2>
            {e.venueName || e.address ? <p className="text-[13px] text-white/80">{[e.venueName, e.address, e.city].filter(Boolean).join(" · ")}</p> : null}
            {map.osmEmbed ? <iframe title="Harita" src={map.osmEmbed} className="h-56 w-full rounded-2xl border border-white/10" loading="lazy" /> : null}
            <div className="flex flex-wrap gap-2">
              <a href={map.google} target="_blank" rel="noreferrer" className="rounded-full border border-white/15 px-4 py-2 text-[13px] text-white hover:border-neon-pink">Google Haritalar</a>
              <a href={map.apple} target="_blank" rel="noreferrer" className="rounded-full border border-white/15 px-4 py-2 text-[13px] text-white hover:border-neon-pink">Apple Haritalar</a>
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}
