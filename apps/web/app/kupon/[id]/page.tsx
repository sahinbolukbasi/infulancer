import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@infulancer/core/db";
import { couponValueLabel } from "@infulancer/core/coupons/service";
import { buildWalletLinks } from "@infulancer/core/wallet/passes";
import { CouponCard } from "@/components/luma/pass-cards";
import { QrImage, WalletButtons } from "@/components/wallet/pass-card";
import { dateLong } from "@/lib/event-format";
import { mediaSrc } from "@/lib/media";

export const metadata: Metadata = { title: "Kupon" };
export const dynamic = "force-dynamic";

const grantStatus: Record<string, string> = { GONDERILDI: "Kullanılabilir", GORULDU: "Kullanılabilir", KULLANILDI: "Kullanıldı", IPTAL: "İptal" };

/**
 * Herkese açık kupon kartı. id bir gönderim (kişiye özel) ya da kupon şablonu (önizleme) olabilir.
 * Gösterilen kod: ortak kod varsa o, yoksa kişiye özel kod. QR her zaman takip kodunu taşır.
 */
export default async function CouponPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const grant = await prisma.couponGrant.findUnique({ where: { id }, include: { coupon: true } });
  const coupon = grant?.coupon ?? (await prisma.coupon.findUnique({ where: { id } }));
  if (!coupon) notFound();
  const brand = await prisma.brand.findUnique({ where: { id: coupon.tenantId }, select: { name: true } });
  const code = coupon.sharedCode ?? grant?.code ?? "ÖNİZLEME";
  const qrContent = grant?.code ?? coupon.sharedCode ?? id;
  const links = await buildWalletLinks("coupon", id, qrContent);
  const expired = !!coupon.validUntil && coupon.validUntil < new Date();
  const kind = coupon.kind === "HEDIYE_CEKI" ? "Hediye çeki" : "Kupon";

  return (
    <main className="min-h-dvh bg-bg">
      <div className="mx-auto flex max-w-md flex-col items-center gap-5 px-4 py-8">
        <CouponCard
          kindLabel={kind}
          title={coupon.title}
          brandName={brand?.name ?? "Marka"}
          valueLabel={couponValueLabel(coupon.valueType, coupon.value)}
          code={code}
          codeHint={grant ? "Ödeme sırasında bu kodu girin veya QR'ı okutun" : "Önizleme: alıcılar kendi kodunu görür"}
          validLabel={coupon.validUntil ? `Son kullanım: ${dateLong(coupon.validUntil)}` : "Süresiz"}
          expired={expired}
          statusLabel={grant ? grantStatus[grant.status] : "Önizleme"}
          logoSrc={mediaSrc(coupon.logoKey)}
          heroSrc={mediaSrc(coupon.heroImageKey)}
          accent={coupon.brandColor ?? "#ff2bd6"}
          qr={<QrImage dataUrl={links.qrDataUrl} alt={`Kupon QR kodu ${code}`} />}
        />

        <section className="w-full rounded-2xl border border-line bg-surface p-4" aria-label="Cüzdana ekle">
          <WalletButtons appleUrl={links.appleUrl} googleUrl={links.googleUrl} live={links.live} />
        </section>

        {coupon.description || coupon.terms ? (
          <section className="flex w-full flex-col gap-3 rounded-2xl border border-line bg-surface p-4" aria-label="Kupon ayrıntıları">
            {coupon.description ? <p className="text-[14px] text-fg">{coupon.description}</p> : null}
            {coupon.terms ? (
              <div>
                <h2 className="text-[12px] font-medium text-fg-muted">Kullanım koşulları</h2>
                <p className="mt-1 whitespace-pre-line text-[13px] text-fg-muted">{coupon.terms}</p>
              </div>
            ) : null}
          </section>
        ) : null}
      </div>
    </main>
  );
}
