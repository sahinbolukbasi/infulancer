import { getTT } from "@/lib/i18n/tt-server";
import type { Metadata } from "next";
import { CouponsIndex } from "@/components/luma/coupon-views";
import { requireActor } from "@/lib/auth-guard";
export const metadata: Metadata = { title: "Kuponlar" };
export const dynamic = "force-dynamic";
export default async function BrandCouponsPage({ searchParams }: { searchParams: Promise<{ filtre?: string; ara?: string; tur?: string }> }) {
  const tt = await getTT();
  const actor = await requireActor("BRAND");
  const { filtre, ara, tur } = await searchParams;
  return (
    <CouponsIndex
      basePath="/marka/kuponlar"
      tenantId={actor.brandId!}
      filter={filtre}
      query={ara}
      kindFilter={tur}
      title={tt("Kuponlar ve hediye çekleri")}
      description={tt("Logolu kupon ve hediye çeki tasarlayın, içerik üreticilerine gönderin.")}
    />
  );
}
