import type { Metadata } from "next";
import { CouponsIndex } from "@/components/luma/coupon-views";
import { requireActor } from "@/lib/auth-guard";
export const metadata: Metadata = { title: "Kuponlar" };
export const dynamic = "force-dynamic";
export default async function AdminCouponsPage({ searchParams }: { searchParams: Promise<{ filtre?: string; ara?: string; marka?: string; tur?: string }> }) {
  await requireActor("ADMIN");
  const { filtre, ara, marka, tur } = await searchParams;
  return (
    <CouponsIndex
      basePath="/admin/kuponlar"
      filter={filtre}
      query={ara}
      brandFilter={marka}
      kindFilter={tur}
      title="Kuponlar ve hediye çekleri"
      description="Tüm markaların kuponları. Gönderim, kullanım ve son kullanım tarihlerini izleyin."
    />
  );
}
