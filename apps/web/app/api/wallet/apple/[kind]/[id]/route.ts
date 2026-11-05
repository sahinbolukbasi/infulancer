import { prisma } from "@infulancer/core/db";
import { buildPkpass } from "@infulancer/core/wallet/apple-pass";
import { appleWalletConfigured, type PassData } from "@infulancer/core/wallet/passes";
import { couponValueLabel } from "@infulancer/core/coupons/service";
import { fmtDateTime } from "@/lib/time";

export const runtime = "nodejs";

/**
 * Apple Wallet .pkpass indirme. Sertifika tanımlıysa imzalı dosya indirilir (telefonda
 * doğrudan cüzdana eklenir). Tanımlı değilse şık web bilet/kupon görünümüne yönlendirir.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ kind: string; id: string }> }) {
  const { kind, id } = await params;
  if (!appleWalletConfigured()) {
    const path = kind === "ticket" ? "bilet" : "kupon";
    return Response.redirect(new URL(`/${path}/${id}`, process.env.APP_URL ?? "http://localhost:3000"), 307);
  }
  let data: PassData | null = null;
  if (kind === "ticket") {
    const t = await prisma.eventTicket.findUnique({ where: { id }, include: { event: true } });
    if (t) data = { kind: "ticket", title: t.event.title, subtitle: t.holderName, code: t.code, accentColor: "#ff2bd6", fields: [{ label: "Tarih", value: fmtDateTime(t.event.startsAt) }, { label: "Mekan", value: t.event.venueName ?? "-" }] };
  } else {
    const g = await prisma.couponGrant.findUnique({ where: { id }, include: { coupon: true } });
    const c = g?.coupon ?? (await prisma.coupon.findUnique({ where: { id } }));
    if (c) data = { kind: "coupon", title: c.title, subtitle: couponValueLabel(c.valueType, c.value), code: g?.code ?? c.sharedCode ?? id, accentColor: c.brandColor ?? "#ff2bd6", fields: c.validUntil ? [{ label: "Son kullanım", value: c.validUntil.toLocaleDateString("tr-TR") }] : [] };
  }
  if (!data) return new Response("Bulunamadı", { status: 404 });
  const pkpass = await buildPkpass(data, id);
  if (!pkpass) {
    const path = kind === "ticket" ? "bilet" : "kupon";
    return Response.redirect(new URL(`/${path}/${id}`, process.env.APP_URL ?? "http://localhost:3000"), 307);
  }
  return new Response(new Uint8Array(pkpass), {
    headers: { "content-type": "application/vnd.apple.pkpass", "content-disposition": `attachment; filename="${kind}-${id}.pkpass"`, "cache-control": "no-store" },
  });
}
