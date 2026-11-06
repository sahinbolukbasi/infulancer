import type { Metadata } from "next";
import { EventsIndex } from "@/components/luma/event-views";
import { requireActor } from "@/lib/auth-guard";
export const metadata: Metadata = { title: "Etkinlikler" };
export const dynamic = "force-dynamic";
export default async function BrandEventsPage({ searchParams }: { searchParams: Promise<{ filtre?: string; ara?: string }> }) {
  const actor = await requireActor("BRAND");
  const { filtre, ara } = await searchParams;
  return <EventsIndex basePath="/marka/etkinlikler" tenantId={actor.brandId!} filter={filtre} query={ara} title="Etkinlikler" description="Etkinliklerinizi oluşturun, içerik üreticilerini davet edin; katılanlara QR'lı bilet gider." />;
}
