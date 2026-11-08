import { getTT } from "@/lib/i18n/tt-server";
import type { Metadata } from "next";
import { prisma } from "@infulancer/core/db";
import { CouponCreateForm } from "@/components/coupons/coupon-forms";
import { BackLink } from "@/components/luma/primitives";
import { requireActor } from "@/lib/auth-guard";

export const metadata: Metadata = { title: "Yeni kupon" };
export const dynamic = "force-dynamic";

export default async function BrandNewCouponPage() {
  const tt = await getTT();
  const actor = await requireActor("BRAND");
  const brand = await prisma.brand.findUnique({ where: { id: actor.brandId! }, select: { name: true } });
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <BackLink href="/marka/kuponlar">{tt("Kuponlar")}</BackLink>
      <div className="flex flex-col gap-1">
        <h1 className="text-title text-fg">{tt("Yeni kupon")}</h1>
        <p className="text-[14px] text-fg-muted">{tt("Taslak olarak oluşturulur; yayına alıp alıcı seçmek için kupon sayfasına geçersiniz.")}</p>
      </div>
      <CouponCreateForm isAdmin={false} brandName={brand?.name ?? "Markanız"} />
    </div>
  );
}
