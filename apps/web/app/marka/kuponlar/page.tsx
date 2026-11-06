import type { Metadata } from "next";
import { CouponsIndex } from "@/components/luma/coupon-views";
import { requireActor } from "@/lib/auth-guard";

export const metadata: Metadata = { title: "Kuponlar" };
export const dynamic = "force-dynamic";

export default async function BrandCouponsPage({ searchParams }: { searchParams: Promise<{ filtre?: string }> }) {
  const actor = await requireActor("BRAND");
  const { filtre } = await searchParams;
  return <CouponsIndex basePath="/marka/kuponlar" tenantId={actor.brandId!} filter={filtre} title="Kuponlar ve hediye çekleri" description="Logolu kupon ve hediye çeki tasarlayın, içerik üreticilerine gönderin." />;
}
