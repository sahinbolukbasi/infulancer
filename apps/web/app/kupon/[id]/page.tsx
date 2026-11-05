import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@infulancer/core/db";
import { couponValueLabel } from "@infulancer/core/coupons/service";
import { buildWalletLinks } from "@infulancer/core/wallet/passes";
import { QrImage, WalletButtons } from "@/components/wallet/pass-card";
import { CopyCode } from "@/components/wallet/copy-code";
import { mediaSrc } from "@/lib/media";
import { fmtDate } from "@/lib/time";

export const metadata: Metadata = { title: "Kupon" };
export const dynamic = "force-dynamic";

/** Modern kupon/hediye çeki kartı: marka rengi gradient, logo, büyük değer, QR + kod. */
export default async function CouponPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const grant = await prisma.couponGrant.findUnique({ where: { id }, include: { coupon: true } });
  const coupon = grant?.coupon ?? (await prisma.coupon.findUnique({ where: { id } }));
  if (!coupon) notFound();
  const code = coupon.sharedCode ?? grant?.code ?? "ÖNİZLEME";
  const qrCode = grant?.code ?? coupon.sharedCode ?? id;
  const links = await buildWalletLinks("coupon", id, qrCode);
  const logo = mediaSrc(coupon.logoKey);
  const hero = mediaSrc(coupon.heroImageKey);
  const accent = coupon.brandColor ?? "#ff2bd6";
  const kindTr = coupon.kind === "HEDIYE_CEKI" ? "Hediye çeki" : "İndirim kuponu";
  const statusTr: Record<string, string> = { GONDERILDI: "Aktif", GORULDU: "Aktif", KULLANILDI: "Kullanıldı", IPTAL: "İptal" };
  const expired = coupon.validUntil ? coupon.validUntil < new Date() : false;

  return (
    <main className="relative min-h-dvh overflow-hidden bg-bg">
      <div className="pointer-events-none absolute inset-0 opacity-40" style={{ background: `radial-gradient(60% 40% at 50% 0%, ${accent}66, transparent)` }} />
      <div className="relative mx-auto flex max-w-md flex-col gap-4 px-4 py-8">
        <div className="overflow-hidden rounded-[28px] border border-white/10 bg-black/40 shadow-2xl backdrop-blur-xl">
          {/* Üst gradient / hero */}
          <div className="relative h-36" style={{ background: `linear-gradient(135deg, ${accent} 0%, #05050a 120%)` }}>
            {hero ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={hero} alt="" className="h-full w-full object-cover opacity-70" />
            ) : null}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
            <div className="absolute left-5 top-5 flex items-center gap-3">
              {logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logo} alt="" className="h-12 w-12 rounded-2xl object-cover ring-2 ring-white/30" />
              ) : null}
              <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wider text-white backdrop-blur">{kindTr}</span>
            </div>
          </div>

          {/* Değer */}
          <div className="flex flex-col items-center gap-1 px-5 pb-4 pt-5 text-center">
            <h1 className="text-xl font-semibold text-white">{coupon.title}</h1>
            <span className="bg-gradient-to-r from-white to-white/60 bg-clip-text text-4xl font-bold tracking-tight text-transparent">{couponValueLabel(coupon.valueType, coupon.value)}</span>
            {grant ? <span className={`text-[12px] ${grant.status === "KULLANILDI" ? "text-fg-passive" : "text-neon-lime"}`}>{statusTr[grant.status]}</span> : <span className="text-[12px] text-white/50">Önizleme</span>}
          </div>

          {/* Perfore ayraç */}
          <div className="relative flex items-center">
            <div className="h-5 w-5 -translate-x-1/2 rounded-full bg-bg" />
            <div className="flex-1 border-t border-dashed border-white/20" />
            <div className="h-5 w-5 translate-x-1/2 rounded-full bg-bg" />
          </div>

          {/* QR + kod */}
          <div className="flex flex-col items-center gap-3 px-5 pb-6 pt-3">
            <QrImage dataUrl={links.qrDataUrl} alt={`Kupon kodu ${code}`} />
            <CopyCode code={code} label="Kupon kodu" />
            {coupon.validUntil ? <span className={`text-[12px] ${expired ? "text-critical" : "text-white/50"}`}>{expired ? "Süresi doldu" : `Son kullanım: ${fmtDate(coupon.validUntil)}`}</span> : null}
          </div>
        </div>

        <section className="rounded-3xl border border-white/10 bg-black/30 p-5 backdrop-blur-xl">
          <WalletButtons appleUrl={links.appleUrl} googleUrl={links.googleUrl} live={links.live} />
        </section>

        {coupon.description ? <p className="rounded-3xl border border-white/10 bg-black/30 p-5 text-sm text-white/70 backdrop-blur-xl">{coupon.description}</p> : null}
        {coupon.terms ? (
          <section className="rounded-3xl border border-white/10 bg-black/30 p-5 backdrop-blur-xl">
            <span className="text-[11px] uppercase tracking-wide text-white/50">Kullanım koşulları</span>
            <p className="mt-1 whitespace-pre-line text-[13px] text-white/70">{coupon.terms}</p>
          </section>
        ) : null}
      </div>
    </main>
  );
}
