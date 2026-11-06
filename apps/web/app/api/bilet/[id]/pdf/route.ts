import { prisma } from "@infulancer/core/db";
import { BRAND_NAME } from "@infulancer/core/brand";
import { buildWalletLinks } from "@infulancer/core/wallet/passes";
import { rangeLabel } from "@/lib/event-format";
import { renderPassPdf } from "@/lib/pdf/pass-pdf";
import { jsonError } from "@/lib/uploads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUS: Record<string, { label: string; color: string }> = {
  GECERLI: { label: "Geçerli bilet", color: "#16a34a" },
  KULLANILDI: { label: "Giriş yapıldı", color: "#737373" },
  IPTAL: { label: "İptal edildi", color: "#dc2626" },
};

/** Herkese açık bilet PDF'i (QR + kod). Davetliye gönderilen bağlantıyla indirilebilir. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!id || id.length > 64) return jsonError(404, "Bilet bulunamadı.");
  const ticket = await prisma.eventTicket.findUnique({ where: { id }, include: { event: true, invite: { select: { influencerId: true } } } });
  if (!ticket) return jsonError(404, "Bilet bulunamadı.");
  const e = ticket.event;
  const [brand, influencer] = await Promise.all([
    e.tenantId ? prisma.brand.findUnique({ where: { id: e.tenantId }, select: { name: true } }) : null,
    ticket.invite?.influencerId ? prisma.influencer.findUnique({ where: { id: ticket.invite.influencerId }, select: { name: true } }) : null,
  ]);
  const holder = influencer?.name ?? ticket.holderName;
  const organizer = brand?.name ?? BRAND_NAME;
  const location = [e.venueName, e.address, e.city].filter(Boolean).join(", ");
  const links = await buildWalletLinks("ticket", ticket.id, ticket.code);
  const st = STATUS[ticket.status] ?? { label: ticket.status, color: "#737373" };

  const fields = [
    { label: "Katılımcı", value: holder || "—" },
    { label: "Tarih", value: rangeLabel(e.startsAt, e.endsAt) },
    ...(location ? [{ label: "Konum", value: location }] : []),
    { label: "Düzenleyen", value: organizer },
  ];
  const pdf = await renderPassPdf({
    kicker: "Etkinlik bileti",
    title: e.title,
    org: organizer,
    fields,
    code: ticket.code,
    codeHint: "Girişte bu QR kodu okutun",
    qrDataUrl: links.qrDataUrl,
    statusLabel: st.label,
    statusColor: st.color,
    sections: e.description ? [{ title: "Etkinlik hakkında", body: e.description.slice(0, 800) }] : [],
  });
  const day = new Date().toISOString().slice(0, 10);
  const fileName = `bilet-${ticket.code}-${day}.pdf`.replace(/[^\w.-]/g, "_");
  return new Response(new Uint8Array(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Content-Length": String(pdf.length),
      "Cache-Control": "private, no-store",
    },
  });
}
