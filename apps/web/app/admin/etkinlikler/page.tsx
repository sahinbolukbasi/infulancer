import type { Metadata } from "next";
import { EventsIndex } from "@/components/luma/event-views";
import { requireActor } from "@/lib/auth-guard";

export const metadata: Metadata = { title: "Etkinlikler" };
export const dynamic = "force-dynamic";

export default async function AdminEventsPage({ searchParams }: { searchParams: Promise<{ filtre?: string }> }) {
  await requireActor("ADMIN");
  const { filtre } = await searchParams;
  return <EventsIndex basePath="/admin/etkinlikler" filter={filtre} title="Etkinlikler" description="Tüm markaların ve ajansın etkinlikleri. Misafir davet edin, bilet ve girişleri yönetin." />;
}
