import type { Metadata } from "next";
import { CouponManage } from "@/components/luma/coupon-views";
import { requireActor } from "@/lib/auth-guard";

export const metadata: Metadata = { title: "Kupon" };
export const dynamic = "force-dynamic";

export default async function AdminCouponManagePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ sekme?: string }> }) {
  await requireActor("ADMIN");
  const [{ id }, { sekme }] = await Promise.all([params, searchParams]);
  return <CouponManage id={id} basePath="/admin/kuponlar" tab={sekme} />;
}
