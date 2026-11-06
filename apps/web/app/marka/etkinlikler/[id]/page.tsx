import type { Metadata } from "next";
import { EventManage } from "@/components/luma/event-views";
import { requireActor } from "@/lib/auth-guard";

export const metadata: Metadata = { title: "Etkinlik" };
export const dynamic = "force-dynamic";

export default async function BrandEventManagePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ sekme?: string }> }) {
  const actor = await requireActor("BRAND");
  const [{ id }, { sekme }] = await Promise.all([params, searchParams]);
  return <EventManage id={id} basePath="/marka/etkinlikler" tenantId={actor.brandId!} tab={sekme} />;
}
