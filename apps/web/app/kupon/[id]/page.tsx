import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@infulancer/core/db";
import { couponValueLabel } from "@infulancer/core/coupons/service";
import { buildWalletLinks } from "@infulancer/core/wallet/passes";
import { QrImage, WalletButtons } from "@/components/wallet/pass-card";
import { mediaSrc } from "@/lib/media";
import { fmtDate } from "@/lib/time";

export const metadata: Metadata = { title: "Kupon" };
export const dynamic = "force-dynamic";

/**
 * Herkese açık kupon/hediye çeki görünümü. id hem CouponGrant (gönderim) hem Coupon (önizleme)
 * olabilir; önce gönderim aranır (kişiye özel kod), yoksa kupon şablonu gösterilir.
 */
export default async function CouponPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const grant = await prisma.couponGrant.findUnique({ where: { id }, include: { coupon: true } });
  const coupon = grant?.coupon ?? (await prisma.coupon.findUnique({ where: { id } }));
  if (!coupon) notFound();
  // Gösterilecek kod: paylaşılan kod varsa o, yoksa kişiye özel grant kodu.
  const code = coupon.sharedCode ?? grant?.code ?? "ÖNİZLEME";
  // QR her zaman benzersiz grant kodunu taşır (tekil doğrulama); yoksa şablon id.
  const qrCode = grant?.code ?? coupon.sharedCode ?? id;
  const links = await buildWalletLinks("coupon", id, qrCode);
  const logo = mediaSrc(coupon.logoKey);
  const hero = mediaSrc(coupon.heroImageKey);
  const accent = coupon.brandColor ?? "#ff2bd6";
  const kindTr = coupon.kind === "HEDIYE_CEKI" ? "Hediye çeki" : "İndirim kuponu";
  const statusTr: Record<string, string> = { GONDERILDI: "Aktif", GORULDU: "Aktif", KULLANILDI: "Kullanıldı", IPTAL: "İptal" };
  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col gap-5 p-5">
      <div className="overflow-hidden rounded-3xl border border-line bg-glass">
        <div className="h-28 w-full" style={{ background: `linear-gradient(135deg, ${accent}, #05050a)` }}>
          {hero ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={hero} alt="" className="h-28 w-full object-cover opacity-80" />
          ) : null}
        </div>
        <div className="flex items-center gap-3 p-5">
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} alt="" className="h-12 w-12 rounded-xl object-cover ring-1 ring-line" />
          ) : null}
          <div className="flex flex-col">
            <span className="text-[12px] uppercase tracking-wide text-fg-passive">{kindTr}{grant ? ` · ${statusTr[grant.status]}` : " · önizleme"}</span>
            <h1 className="text-2xl font-semibold">{coupon.title}</h1>
          </div>
        </div>
      </div>

      <div className="flex flex-col items-center gap-3 rounded-3xl border border-line bg-surface p-6">
        <span className="text-gradient text-3xl font-semibold">{couponValueLabel(coupon.valueType, coupon.value)}</span>
        <QrImage dataUrl={links.qrDataUrl} alt={`Kupon kodu ${code}`} />
        <span className="font-mono text-lg tracking-wider">{code}</span>
        {coupon.validUntil ? <span className="text-[12px] text-fg-muted">Son kullanım: {fmtDate(coupon.validUntil)}</span> : null}
      </div>

      <WalletButtons appleUrl={links.appleUrl} googleUrl={links.googleUrl} live={links.live} />

      {coupon.description ? <p className="rounded-3xl border border-line bg-glass p-5 text-sm text-fg-muted">{coupon.description}</p> : null}
      {coupon.terms ? (
        <div className="rounded-3xl border border-line bg-glass p-5">
          <span className="text-label text-fg-muted">Kullanım koşulları</span>
          <p className="mt-1 whitespace-pre-line text-[13px] text-fg-muted">{coupon.terms}</p>
        </div>
      ) : null}
    </main>
  );
}
