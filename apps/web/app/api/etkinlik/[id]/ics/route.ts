import { prisma } from "@infulancer/core/db";
import { buildIcs } from "@infulancer/core/wallet/ical";

export const runtime = "nodejs";

/** Etkinlik takvim dosyası (.ics). Herkese açık; bilet/davet bağlantısından çağrılır. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const e = await prisma.event.findUnique({ where: { id }, select: { id: true, title: true, description: true, venueName: true, address: true, city: true, startsAt: true, endsAt: true } });
  if (!e) return new Response("Bulunamadı", { status: 404 });
  const ics = buildIcs({
    uid: e.id,
    title: e.title,
    description: e.description,
    location: [e.venueName, e.address, e.city].filter(Boolean).join(", ") || null,
    startsAt: e.startsAt,
    endsAt: e.endsAt,
  });
  return new Response(ics, {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": `attachment; filename="etkinlik-${e.id}.ics"`,
      "cache-control": "no-store",
    },
  });
}
