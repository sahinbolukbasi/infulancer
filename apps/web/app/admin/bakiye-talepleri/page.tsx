import { getTT } from "@/lib/i18n/tt-server";
import type { Metadata } from "next";
import { prisma } from "@infulancer/core/db";
import { creditRequestStatusLabel, type CreditRequestStatus } from "@infulancer/core/creative/credit-requests";
import { PageHeader } from "@/components/ui/layout";
import { FilterTabs, Pill, StatStrip, type PillTone } from "@/components/luma/primitives";
import { CreditRequestActions } from "@/components/admin/credit-request-actions";
import { requireActor } from "@/lib/auth-guard";
import { fmtDateTime } from "@/lib/time";
import { fmtTl } from "@/lib/creative-models";

export const metadata: Metadata = { title: "Bakiye talepleri" };
export const dynamic = "force-dynamic";

const TONE: Record<CreditRequestStatus, PillTone> = { BEKLIYOR: "amber", ONAYLANDI: "green", RED: "red" };
const FILTERS = [
  { id: "bekleyen", label: "Bekleyen" },
  { id: "onaylanan", label: "Onaylanan" },
  { id: "reddedilen", label: "Reddedilen" },
  { id: "tumu", label: "Tümü" },
];
const FILTER_STATUS: Record<string, CreditRequestStatus | undefined> = { bekleyen: "BEKLIYOR", onaylanan: "ONAYLANDI", reddedilen: "RED", tumu: undefined };

/** Yönetici: Creative bakiye talepleri gelen kutusu. */
export default async function CreditRequestsPage({ searchParams }: { searchParams: Promise<{ filtre?: string }> }) {
  const tt = await getTT();
  await requireActor("ADMIN");
  const { filtre } = await searchParams;
  const active = FILTERS.some((f) => f.id === filtre) ? filtre! : "bekleyen";
  const reqs = await prisma.creditRequest.findMany({ orderBy: { createdAt: "desc" }, take: 400 });
  // Hesap adlarını (marka/influencer) çöz.
  const ids = [...new Set(reqs.map((r) => r.tenantId))];
  const [brands, influencers] = await Promise.all([
    prisma.brand.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } }),
    prisma.influencer.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } }),
  ]);
  const nameOf = new Map<string, string>([...brands.map((b) => [b.id, b.name] as const), ...influencers.map((i) => [i.id, i.name] as const)]);
  const counts = {
    bekleyen: reqs.filter((r) => r.status === "BEKLIYOR").length,
    onaylanan: reqs.filter((r) => r.status === "ONAYLANDI").length,
    reddedilen: reqs.filter((r) => r.status === "RED").length,
    tumu: reqs.length,
  };
  const wanted = FILTER_STATUS[active];
  const list = wanted ? reqs.filter((r) => r.status === wanted) : reqs;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={tt("Bakiye talepleri")} description={tt("Marka ve influencerların Creative bakiye (TL) talepleri. Onaylarsanız bakiye otomatik yüklenir.")} />
      {reqs.length ? (
        <StatStrip
          stats={[
            { label: "Bekleyen", value: String(counts.bekleyen) },
            { label: "Onaylanan", value: String(counts.onaylanan) },
            { label: "Reddedilen", value: String(counts.reddedilen) },
            { label: "Toplam talep", value: String(counts.tumu) },
            { label: "Bekleyen tutar", value: fmtTl(reqs.filter((r) => r.status === "BEKLIYOR").reduce((s, r) => s + r.amountTry, 0)) },
            { label: "Onaylanan tutar", value: fmtTl(reqs.filter((r) => r.status === "ONAYLANDI").reduce((s, r) => s + r.amountTry, 0)) },
          ]}
        />
      ) : null}
      <FilterTabs active={active} items={FILTERS.map((f) => ({ id: f.id, label: f.label, href: `/admin/bakiye-talepleri?filtre=${f.id}`, count: counts[f.id as keyof typeof counts] }))} />
      {list.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-3xl border border-dashed border-line px-6 py-14 text-center">
          <p className="font-medium text-fg">{reqs.length ? tt("Bu görünümde talep yok") : tt("Henüz bakiye talebi yok")}</p>
          <p className="max-w-sm text-[13px] text-fg-muted">{tt("Kullanıcılar Creative sayfasından bakiye talebi gönderdiğinde burada görünür.")}</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {list.map((r) => (
            <li key={r.id} className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[17px] font-semibold text-fg">{fmtTl(r.amountTry)}</span>
                  <Pill tone={TONE[r.status]}>{creditRequestStatusLabel[r.status]}</Pill>
                  <span className="text-[12px] text-fg-passive">{fmtDateTime(r.createdAt)}</span>
                </div>
                <span className="text-[13px] text-fg-muted">
                  {nameOf.get(r.tenantId) ?? r.tenantId.slice(-6)}
                  {r.role ? ` · ${r.role}` : ""}
                </span>
                {r.note ? <p className="text-[13px] text-fg-muted">{r.note}</p> : null}
              </div>
              {r.status === "BEKLIYOR" ? <CreditRequestActions id={r.id} /> : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
