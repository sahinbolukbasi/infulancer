import { prisma } from "@infulancer/core/db";
import { couponValueLabel } from "@infulancer/core/coupons/service";
import { buildWalletLinks } from "@infulancer/core/wallet/passes";
import { dateLong } from "@/lib/event-format";
import { renderPassPdf } from "@/lib/pdf/pass-pdf";
import { jsonError } from "@/lib/uploads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Herkese açık kupon/hediye çeki PDF'i (QR + kod). id bir gönderim veya şablon olabilir. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!id || id.length > 64) return jsonError(404, "Kupon bulunamadı.");
  const grant = await prisma.couponGrant.findUnique({ where: { id }, include: { coupon: true } });
  const coupon = grant?.coupon ?? (await prisma.coupon.findUnique({ where: { id } }));
  if (!coupon) return jsonError(404, "Kupon bulunamadı.");
  const brand = await prisma.brand.findUnique({ where: { id: coupon.tenantId }, select: { name: true } });
  const code = coupon.sharedCode ?? grant?.code ?? "ÖNİZLEME";
  const qrContent = grant?.code ?? coupon.sharedCode ?? id;
  const links = await buildWalletLinks("coupon", id, qrContent);
  const expired = !!coupon.validUntil && coupon.validUntil < new Date();
  const kind = coupon.kind === "HEDIYE_CEKI" ? "Hediye çeki" : "Kupon";

  const fields = [
    { label: "Marka", value: brand?.name ?? "Marka" },
    { label: "Değer", value: couponValueLabel(coupon.valueType, coupon.value) },
    { label: "Geçerlilik", value: coupon.validUntil ? `Son kullanım: ${dateLong(coupon.validUntil)}` : "Süresiz" },
  ];
  const sections: { title: string; body: string }[] = [];
  if (coupon.description) sections.push({ title: "Açıklama", body: coupon.description.slice(0, 500) });
  if (coupon.terms) sections.push({ title: "Kullanım koşulları", body: coupon.terms.slice(0, 800) });

  const pdf = await renderPassPdf({
    kicker: kind,
    title: coupon.title,
    org: brand?.name ?? "Marka",
    fields,
    code,
    codeHint: grant ? "Ödeme sırasında bu kodu girin veya QR'ı okutun" : "Önizleme: alıcılar kendi kodunu görür",
    qrDataUrl: links.qrDataUrl,
    statusLabel: expired ? "Süresi doldu" : grant ? "Kullanılabilir" : "Önizleme",
    statusColor: expired ? "#dc2626" : "#16a34a",
    sections,
  });
  const day = new Date().toISOString().slice(0, 10);
  const fileName = `kupon-${code}-${day}.pdf`.replace(/[^\w.-]/g, "_");
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
