import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@infulancer/core/db";
import { formatKurus } from "@infulancer/core/domain/labels";
import { ConvertOffer } from "@/components/offers/offer-forms";
import { PageHeader } from "@/components/ui/layout";
import { StatusDot } from "@/components/ui/status";
import { requireActor } from "@/lib/auth-guard";
import { itemsSummary, statusLabel, statusTone } from "@/lib/offers-view";
import { cn } from "@/lib/cn";
import { fmtDate } from "@/lib/time";
export const metadata: Metadata = { title: "Teklifler" };
export const dynamic = "force-dynamic";
const FILTERS = [
  { id: "KABUL", label: "Kampanyaya eklenecek" },
  { id: "GONDERILDI", label: "Yanıt bekleyen" },
  { id: "KAMPANYAYA_EKLENDI", label: "Eklendi" },
  { id: "RED", label: "Reddedilen" },
  { id: "", label: "Tümü" },
];

/** Ajans: markaların gönderdiği teklifler; kabul edilenler tek tıkla kampanyaya eklenir. */
export default async function AdminOffersPage({ searchParams }: { searchParams: Promise<{ durum?: string; sonuc?: string; kampanya?: string }> }) {
  await requireActor("ADMIN");
  const { durum, sonuc, kampanya } = await searchParams;
  const status = FILTERS.find((f) => f.id === (durum ?? "KABUL"))?.id ?? "KABUL";
  const [offers, counts] = await Promise.all([
    prisma.offer.findMany({ where: status ? { status } : {}, orderBy: { updatedAt: "desc" }, take: 200 }),
    prisma.offer.groupBy({ by: ["status"], _count: true }),
  ]);
  const [brands, infs, camps] = await Promise.all([
    prisma.brand.findMany({ where: { id: { in: [...new Set(offers.map((o) => o.brandId))] } }, select: { id: true, name: true } }),
    prisma.influencer.findMany({ where: { id: { in: [...new Set(offers.map((o) => o.influencerId))] } }, select: { id: true, name: true } }),
    prisma.campaign.findMany({ where: { brandId: { in: [...new Set(offers.map((o) => o.brandId))] }, status: { in: ["TASLAK", "AKTIF"] } }, select: { id: true, name: true, brandId: true } }),
  ]);
  const bName = new Map(brands.map((b) => [b.id, b.name]));
  const iName = new Map(infs.map((i) => [i.id, i.name]));
  const n = (s: string) => (s ? (counts.find((c) => c.status === s)?._count ?? 0) : counts.reduce((x, c) => x + c._count, 0));
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Teklifler" description="Kabul edilen teklifleri kampanyaya ekleyin; brief ve içerik planı oradan devam eder." />
      {sonuc === "eklendi" ? (
        <p role="status" className="flex flex-wrap items-center gap-3 rounded-2xl border border-neon-lime/50 bg-neon-lime/10 px-4 py-3 text-sm">
          ✓ Kampanyaya eklendi. İçerik planı ve brief için kampanyaya geçin.
          {kampanya ? (
            <Link href={`/admin/kampanyalar/${kampanya}?sekme=influencerlar`} className="font-medium underline underline-offset-4">
              Kampanyayı aç →
            </Link>
          ) : null}
        </p>
      ) : null}
      <nav aria-label="Durum" className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Link key={f.id || "all"} href={`/admin/teklifler?durum=${f.id}`} aria-current={status === f.id ? "page" : undefined} className={cn("rounded-full border px-3 py-1 text-[13px] tabular-nums", status === f.id ? "border-fg text-fg" : "border-line text-fg-muted hover:text-fg")}>
            {f.label} · {n(f.id)}
          </Link>
        ))}
      </nav>
      {offers.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line p-10 text-center text-sm text-fg-passive">Bu durumda teklif yok.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {offers.map((o) => (
            <li key={o.id} className="flex flex-wrap items-center gap-4 rounded-3xl border border-line bg-glass p-4">
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="font-medium">
                  {bName.get(o.brandId) ?? "Marka"} → <Link href={`/admin/influencerlar/${o.influencerId}`} className="hover:underline">{iName.get(o.influencerId) ?? "Üretici"}</Link>
                </span>
                <span className="text-[13px]">{o.title}</span>
                <span className="truncate text-[12px] text-fg-muted">{itemsSummary(o.items).join(" · ")}</span>
                <span className="text-[11px] text-fg-passive">
                  {fmtDate(o.createdAt)}
                  {o.publishBy ? ` · yayın ${fmtDate(o.publishBy)}` : ""}
                  {o.responseNote ? ` · not: ${o.responseNote}` : ""}
                </span>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className="text-lg font-semibold tabular-nums">{formatKurus(o.totalKurus)}</span>
                <StatusDot tone={statusTone(o.status)}>{statusLabel(o.status)}</StatusDot>
              </div>
              {o.status === "KABUL" ? <ConvertOffer offerId={o.id} campaigns={camps.filter((c) => c.brandId === o.brandId)} defaultCampaignId={o.campaignId} /> : null}
              {o.status === "KAMPANYAYA_EKLENDI" && o.campaignId ? (
                <Link href={`/admin/kampanyalar/${o.campaignId}?sekme=influencerlar`} className="text-[13px] text-fg-muted hover:text-fg">
                  Kampanyaya git →
                </Link>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
