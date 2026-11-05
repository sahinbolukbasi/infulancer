import type { Metadata } from "next";
import { prisma } from "@infulancer/core/db";
import { EventForm } from "@/components/events/event-forms";
import { Card } from "@/components/ui/card";
import { DataTable, type DataTableRow } from "@/components/ui/data-table";
import { StatusCards } from "@/components/ui/status-cards";
import { PageHeader } from "@/components/ui/layout";
import { StatusDot } from "@/components/ui/status";
import { Tabs } from "@/components/ui/tabs";
import { requireActor } from "@/lib/auth-guard";
import { fmtDateTime } from "@/lib/time";

export const metadata: Metadata = { title: "Etkinlikler" };
export const dynamic = "force-dynamic";

const statusTr: Record<string, string> = { TASLAK: "Taslak", YAYINDA: "Yayında", IPTAL: "İptal", TAMAMLANDI: "Tamamlandı" };
const tone: Record<string, "active" | "muted" | "passive" | "critical"> = { TASLAK: "muted", YAYINDA: "active", IPTAL: "critical", TAMAMLANDI: "passive" };
const statusRank: Record<string, number> = { YAYINDA: 0, TASLAK: 1, TAMAMLANDI: 2, IPTAL: 3 };

export default async function AdminEventsPage() {
  await requireActor("ADMIN");
  const [events, brands] = await Promise.all([
    prisma.event.findMany({ orderBy: { startsAt: "desc" }, take: 100, include: { _count: { select: { invites: true, tickets: true } } } }),
    prisma.brand.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  // Analitik
  const now = new Date();
  const active = events.filter((e) => e.status === "YAYINDA").length;
  const upcoming = events.filter((e) => e.status === "YAYINDA" && e.startsAt > now).length;
  const totalTickets = events.reduce((s, e) => s + e._count.tickets, 0);
  const totalInvites = events.reduce((s, e) => s + e._count.invites, 0);
  const acceptRate = totalInvites ? Math.round((totalTickets / totalInvites) * 100) : 0;

  const rows: DataTableRow[] = events.map((e) => ({
    id: e.id,
    label: e.title,
    cells: {
      title: { display: <span className="font-medium">{e.title}</span>, sort: e.title },
      date: { display: fmtDateTime(e.startsAt), sort: e.startsAt.getTime() },
      visibility: e.visibility === "HERKESE_ACIK" ? "Herkese açık" : "Kapalı",
      invites: { display: <span className="tabular-nums">{e._count.invites}</span>, sort: e._count.invites },
      tickets: { display: <span className="tabular-nums">{e._count.tickets}</span>, sort: e._count.tickets },
      status: { display: <StatusDot tone={tone[e.status]}>{statusTr[e.status]}</StatusDot>, sort: statusRank[e.status] ?? 9 },
    },
    actions: [{ label: "Yönet", href: `/admin/etkinlikler/${e.id}`, icon: "open" }],
  }));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Etkinlikler" description="Etkinlik oluşturun, davet gönderin, QR'lı bilet üretin; konum haritaya eklenir." />
      <StatusCards
        items={[
          { title: "Aktif etkinlik", state: active ? "ok" : "warn", value: String(active), text: `${upcoming} yaklaşan` },
          { title: "Toplam bilet", state: "ok", value: String(totalTickets), text: "üretilen biletler" },
          { title: "Davet", state: "ok", value: String(totalInvites), text: "gönderilen davet" },
          { title: "Katılım oranı", state: acceptRate >= 50 ? "ok" : "warn", value: `%${acceptRate}`, text: "davet → bilet" },
        ]}
      />
      <Tabs
        label="Etkinlik bölümleri"
        tabs={[
          {
            id: "liste",
            label: `Etkinlikler (${events.length})`,
            content:
              events.length === 0 ? (
                <p className="text-sm text-fg-passive">Henüz etkinlik yok. &quot;Yeni etkinlik&quot; sekmesinden oluşturun.</p>
              ) : (
                <DataTable
                  caption="Etkinlikler"
                  columns={[
                    { key: "title", header: "Etkinlik", sortable: true },
                    { key: "date", header: "Tarih", sortable: true },
                    { key: "visibility", header: "Görünürlük" },
                    { key: "invites", header: "Davet", sortable: true, align: "right" },
                    { key: "tickets", header: "Bilet", sortable: true, align: "right" },
                    { key: "status", header: "Durum", sortable: true },
                  ]}
                  rows={rows}
                />
              ),
          },
          { id: "yeni", label: "Yeni etkinlik", content: <Card interactive={false}><EventForm isAdmin brands={brands} /></Card> },
        ]}
      />
    </div>
  );
}
