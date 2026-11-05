import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@infulancer/core/db";
import { campaignStatusLabels, formatKurus } from "@infulancer/core/domain/labels";
import { DataTable } from "@/components/ui/data-table";
import { ButtonLink } from "@/components/ui/form";
import { PageHeader, Stagger } from "@/components/ui/layout";
import { StatusDot } from "@/components/ui/status";
import { requireActor } from "@/lib/auth-guard";
import { pct } from "@/lib/format";
import { loadCampaignScores } from "@/lib/queries";
import { campaignTone } from "@/lib/status-tone";
import { fmtDate } from "@/lib/time";

export const metadata: Metadata = { title: "Kampanyalar" };

const statusRank = { AKTIF: 0, TASLAK: 1, KAPANDI: 2, IPTAL: 3 } as const;

const FILTERS = [
  { id: "", label: "Tümü" },
  { id: "AKTIF", label: "Aktif" },
  { id: "TASLAK", label: "Taslak" },
  { id: "KAPANDI", label: "Kapandı" },
  { id: "IPTAL", label: "İptal" },
] as const;
type StatusKey = keyof typeof statusRank;
export default async function CampaignsPage({ searchParams }: { searchParams: Promise<{ durum?: string }> }) {
  await requireActor("ADMIN");
  const { durum } = await searchParams;
  const filter = durum && durum in statusRank ? (durum as StatusKey) : undefined;
  const all = await prisma.campaign.findMany({
    orderBy: { startsAt: "desc" },
    select: {
      id: true,
      name: true,
      status: true,
      startsAt: true,
      endsAt: true,
      budgetKurus: true,
      brand: { select: { name: true } },
      brandPaymentReceivedAt: true,
      brandTotalFeeKurus: true,
      _count: { select: { assignments: { where: { contractStatus: { not: "RED" } } } } },
    },
  });
  const counts = Object.fromEntries(FILTERS.map((f) => [f.id, f.id ? all.filter((c) => c.status === f.id).length : all.length]));
  const campaigns = filter ? all.filter((c) => c.status === filter) : all;
  const now = new Date();
  const scores = await loadCampaignScores(campaigns.map((c) => c.id));
  return (
    <Stagger className="flex flex-col gap-8">
      <PageHeader
        title="Kampanyalar"
        description="Kampanyayı açın, satırdaki ikonlarla influencer ekleyin, brief yazın veya kurulumu tamamlayın."
        actions={<ButtonLink href="/admin/kampanyalar/yeni">Yeni kampanya</ButtonLink>}
      />
      <nav aria-label="Durum filtresi" className="flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const active = (filter ?? "") === f.id;
          return (
            <Link
              key={f.id || "all"}
              href={f.id ? `/admin/kampanyalar?durum=${f.id}` : "/admin/kampanyalar"}
              aria-current={active ? "page" : undefined}
              className={`rounded-full border px-3 py-1 text-[13px] tabular-nums transition-standard ${active ? "border-fg text-fg" : "border-border text-fg-muted hover:text-fg"}`}
            >
              {f.label} · {counts[f.id]}
            </Link>
          );
        })}
      </nav>
      <DataTable
        caption="Kampanyalar"
        emptyText={filter ? "Bu durumda kampanya yok." : "Henüz kampanya yok."}
        initialSort={{ key: "status", dir: "asc" }}
        columns={[
          { key: "name", header: "Kampanya", sortable: true },
          { key: "brand", header: "Marka", sortable: true },
          { key: "status", header: "Durum", sortable: true },
          { key: "score", header: "Skor", align: "right", sortable: true },
          { key: "dates", header: "Tarih", sortable: true },
          { key: "influencers", header: "Influencer", align: "right", sortable: true },
          { key: "budget", header: "Bütçe", align: "right", sortable: true },
          { key: "progress", header: "Süre", align: "right", sortable: true },
          { key: "payment", header: "Tahsilat", sortable: true },
        ]}
        rows={campaigns.map((c) => {
          const score = scores.get(c.id)?.score ?? null;
          const span = c.endsAt.getTime() - c.startsAt.getTime();
          const progress = span > 0 ? Math.min(1, Math.max(0, (now.getTime() - c.startsAt.getTime()) / span)) : 0;
          const open = c.status === "AKTIF" || c.status === "TASLAK";
          return {
            id: c.id,
            label: c.name,
            cells: {
              name: {
                display: (
                  <Link href={`/admin/kampanyalar/${c.id}`} className="text-fg hover:underline">
                    {c.name}
                  </Link>
                ),
                sort: c.name,
              },
              brand: { display: c.brand.name, sort: c.brand.name },
              status: { display: <StatusDot tone={campaignTone(c.status)}>{campaignStatusLabels[c.status]}</StatusDot>, sort: statusRank[c.status] },
              score: { display: score == null ? "—" : pct.format(score), sort: score },
              dates: { display: `${fmtDate(c.startsAt)} – ${fmtDate(c.endsAt)}`, sort: c.startsAt.getTime() },
              influencers: { display: c._count.assignments, sort: c._count.assignments },
              budget: { display: formatKurus(Number(c.budgetKurus)), sort: Number(c.budgetKurus) },
              progress: {
                display: (
                  <span className="inline-flex items-center gap-2">
                    <span className="h-1.5 w-16 overflow-hidden rounded-full bg-border" aria-hidden>
                      <span className="block h-full bg-fg" style={{ width: `${Math.round(progress * 100)}%` }} />
                    </span>
                    {pct.format(progress)}
                  </span>
                ),
                sort: progress,
              },
              payment: {
                display:
                  c.status === "IPTAL" ? "—" : c.brandPaymentReceivedAt ? (
                    <StatusDot tone="active">Alındı</StatusDot>
                  ) : (
                    <StatusDot tone={c.status === "KAPANDI" ? "critical" : "muted"}>{c.status === "KAPANDI" ? "Bekliyor" : "Açık"}</StatusDot>
                  ),
                sort: c.brandPaymentReceivedAt ? 2 : c.status === "KAPANDI" ? 0 : 1,
              },
            },
            actions: [
              { label: "Kampanyayı aç", href: `/admin/kampanyalar/${c.id}`, icon: "open" as const },
              ...(open ? [{ label: "Influencer ekle", href: `/admin/kampanyalar/${c.id}?sekme=influencerlar`, icon: "add" as const }] : []),
              { label: "Brief", href: `/admin/kampanyalar/${c.id}/brief`, icon: "file" as const },
              ...(open ? [{ label: "Kurulum adımları", href: `/admin/kampanyalar/${c.id}/kurulum`, icon: "settings" as const }] : []),
              ...(c.status !== "KAPANDI" ? [{ label: "Düzenle", href: `/admin/kampanyalar/${c.id}/duzenle`, icon: "edit" as const }] : []),
            ],
          };
        })}
      />
    </Stagger>
  );
}
