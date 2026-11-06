import type { Metadata } from "next";
import { prisma } from "@infulancer/core/db";
import { EventCreateForm } from "@/components/events/event-forms";
import { BackLink } from "@/components/luma/primitives";
import { requireActor } from "@/lib/auth-guard";

export const metadata: Metadata = { title: "Yeni etkinlik" };
export const dynamic = "force-dynamic";

export default async function AdminNewEventPage() {
  await requireActor("ADMIN");
  const brands = await prisma.brand.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } });
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <BackLink href="/admin/etkinlikler">Etkinlikler</BackLink>
      <div className="flex flex-col gap-1">
        <h1 className="text-title text-fg">Yeni etkinlik</h1>
        <p className="text-[14px] text-fg-muted">Taslak olarak oluşturulur; yayınlayıp misafir davet etmek için yönetim sayfasına geçersiniz.</p>
      </div>
      <EventCreateForm isAdmin brands={brands} organizerName="Infulancer" />
    </div>
  );
}
