import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@infulancer/core/db";
import { EventForm } from "@/components/events/event-forms";
import { Card, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/layout";
import { StatusDot } from "@/components/ui/status";
import { Tabs } from "@/components/ui/tabs";
import { requireActor } from "@/lib/auth-guard";
import { fmtDateTime } from "@/lib/time";

export const metadata: Metadata = { title: "Etkinlikler" };
export const dynamic = "force-dynamic";

const statusTr: Record<string, string> = { TASLAK: "Taslak", YAYINDA: "Yayında", IPTAL: "İptal", TAMAMLANDI: "Tamamlandı" };
const tone: Record<string, "active" | "muted" | "passive" | "critical"> = { TASLAK: "muted", YAYINDA: "active", IPTAL: "critical", TAMAMLANDI: "passive" };

export default async function AdminEventsPage() {
  await requireActor("ADMIN");
  const [events, brands] = await Promise.all([
    prisma.event.findMany({ orderBy: { startsAt: "desc" }, take: 60, include: { _count: { select: { invites: true, tickets: true } } } }),
    prisma.brand.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Etkinlikler" description="Etkinlik oluşturun, davet gönderin, QR'lı bilet üretin; konum haritaya eklenir." />
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
                <ul className="flex flex-col gap-3">
                  {events.map((e) => (
                    <li key={e.id}>
                      <Link href={`/admin/etkinlikler/${e.id}`} className="block">
                        <Card className="flex flex-wrap items-center justify-between gap-3">
                          <div className="flex flex-col">
                            <CardTitle>{e.title}</CardTitle>
                            <span className="text-[13px] text-fg-muted">{fmtDateTime(e.startsAt)}{e.city ? ` · ${e.city}` : ""} · {e._count.invites} davet · {e._count.tickets} bilet</span>
                          </div>
                          <StatusDot tone={tone[e.status]}>{statusTr[e.status]}</StatusDot>
                        </Card>
                      </Link>
                    </li>
                  ))}
                </ul>
              ),
          },
          { id: "yeni", label: "Yeni etkinlik", content: <Card interactive={false}><EventForm isAdmin brands={brands} /></Card> },
        ]}
      />
    </div>
  );
}
