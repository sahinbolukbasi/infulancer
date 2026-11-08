import { getTT } from "@/lib/i18n/tt-server";
import type { Metadata } from "next";
import { EventsIndex } from "@/components/luma/event-views";
import { requireActor } from "@/lib/auth-guard";
export const metadata: Metadata = { title: "Etkinlikler" };
export const dynamic = "force-dynamic";
export default async function AdminEventsPage({ searchParams }: { searchParams: Promise<{ filtre?: string; ara?: string; marka?: string }> }) {
  const tt = await getTT();
  await requireActor("ADMIN");
  const { filtre, ara, marka } = await searchParams;
  return <EventsIndex basePath="/admin/etkinlikler" filter={filtre} query={ara} brandFilter={marka} title={tt("Etkinlikler")} description={tt("Tüm markaların ve ajansın etkinlikleri. Misafir davet edin, bilet ve girişleri yönetin.")} />;
}
