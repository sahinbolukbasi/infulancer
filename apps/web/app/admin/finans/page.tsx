import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@infulancer/core/db";
import { formatKurus, payoutStatusLabels, taxStatusLabels } from "@infulancer/core/domain/labels";
import { computeBalances, holdDays, minPayoutKurus } from "@infulancer/core/domain/ledger";
import { ApprovedPayouts, BatchPayouts, PayoutDecision, TaxWarning, type PayoutRow } from "@/components/finance/payout-forms";
import { Card, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { PageHeader, Stagger } from "@/components/ui/layout";
import { MetricCard } from "@/components/ui/metric-card";
import { StatusDot } from "@/components/ui/status";
import { Tabs } from "@/components/ui/tabs";
import { requireActor } from "@/lib/auth-guard";
import { AGENCY_TZ, fmtDate, fmtDateTime, localDay, zonedToUtc } from "@/lib/time";

export const metadata: Metadata = { title: "Finans" };

type Tax = { taxStatus: "FATURA" | "SERBEST_MESLEK_MAKBUZU" | "STOPAJLI"; canIssueInvoice: boolean };
const needsTaxWarning = (i: Tax) => i.taxStatus !== "FATURA" || !i.canIssueInvoice;

export default async function FinancePage() {
  await requireActor("ADMIN");
  const now = new Date();
  const monthStart = zonedToUtc(`${localDay(now, AGENCY_TZ).slice(0, 7)}-01`, "00:00", AGENCY_TZ);

  const [payouts, influencers, paidThisMonth] = await Promise.all([
    prisma.payoutRequest.findMany({
      orderBy: { createdAt: "asc" },
      include: {
        influencer: { select: { id: true, name: true, taxStatus: true, canIssueInvoice: true } },
        batch: { select: { id: true, createdAt: true, createdBy: { select: { name: true } } } },
      },
    }),
    prisma.influencer.findMany({ select: { id: true } }),
    prisma.ledgerEntry.aggregate({
      where: { account: "INFLUENCER_PAYABLE", reason: "ODEME", direction: "DEBIT", createdAt: { gte: monthStart } },
      _sum: { amountKurus: true },
    }),
  ]);

  const balances = await Promise.all(influencers.map((i) => computeBalances(i.id, now).then((b) => [i.id, b] as const)));
  const balanceBy = new Map(balances);
  const totals = balances.reduce(
    (s, [, b]) => ({ hakedilen: s.hakedilen + b.hakedilen, cekilebilir: s.cekilebilir + Math.max(b.cekilebilir, 0), islemde: s.islemde + b.islemde }),
    { hakedilen: 0, cekilebilir: 0, islemde: 0 },
  );

  const toRow = (p: (typeof payouts)[number], date: Date): PayoutRow => ({
    id: p.id,
    influencer: p.influencer.name,
    amountKurus: p.amountKurus,
    iban: p.ibanSnapshot,
    holder: p.ibanHolderSnapshot,
    taxLabel: taxStatusLabels[p.influencer.taxStatus],
    taxWarning: needsTaxWarning(p.influencer),
    note: p.adminNote,
    dateLabel: fmtDate(date),
  });

  const requested = payouts.filter((p) => p.status === "TALEP_EDILDI");
  const approved = payouts.filter((p) => p.status === "ONAYLANDI");
  const listed = payouts.filter((p) => p.status === "ODEME_LISTESINDE" && p.batch);
  const history = payouts.filter((p) => p.status === "GONDERILDI" || p.status === "REDDEDILDI").reverse();

  const batches = new Map<string, { id: string; createdAt: Date; by: string; rows: PayoutRow[] }>();
  for (const p of listed) {
    const b = p.batch!;
    const entry = batches.get(b.id) ?? { id: b.id, createdAt: b.createdAt, by: b.createdBy.name, rows: [] };
    entry.rows.push(toRow(p, p.approvedAt ?? p.createdAt));
    batches.set(b.id, entry);
  }

  const requestsTab = (
    <DataTable
      caption="Çekim talepleri"
      emptyText="Bekleyen çekim talebi yok."
      columns={[
        { key: "influencer", header: "Influencer", sortable: true },
        { key: "amount", header: "Tutar", align: "right", sortable: true },
        { key: "available", header: "Kalan çekilebilir", align: "right", sortable: true },
        { key: "tax", header: "Vergi durumu" },
        { key: "date", header: "Talep", sortable: true },
        { key: "decision", header: "Karar" },
      ]}
      rows={requested.map((p) => {
        const b = balanceBy.get(p.influencer.id);
        return {
          id: p.id,
          cells: {
            influencer: {
              display: (
                <Link href={`/admin/influencerlar/${p.influencer.id}`} className="flex flex-col hover:underline">
                  {p.influencer.name}
                  <span className="font-mono text-[12px] text-fg-passive">{p.ibanSnapshot}</span>
                </Link>
              ),
              sort: p.influencer.name,
            },
            amount: { display: formatKurus(p.amountKurus), sort: p.amountKurus },
            available: { display: b ? formatKurus(b.cekilebilir) : "—", sort: b?.cekilebilir ?? null },
            tax: (
              <span className="flex flex-col gap-1">
                {taxStatusLabels[p.influencer.taxStatus]}
                {needsTaxWarning(p.influencer) ? <TaxWarning /> : null}
              </span>
            ),
            date: { display: fmtDateTime(p.createdAt), sort: p.createdAt.getTime() },
            decision: <PayoutDecision id={p.id} />,
          },
        };
      })}
    />
  );

  const listTab = (
    <div className="flex flex-col gap-6">
      <Card interactive={false} className="flex flex-col gap-4">
        <CardTitle>Onaylanan talepler</CardTitle>
        <ApprovedPayouts rows={approved.map((p) => toRow(p, p.approvedAt ?? p.createdAt))} />
      </Card>
      {batches.size === 0 ? (
        <p className="text-sm text-fg-passive">Açık ödeme listesi yok. Onaylanan talepleri seçip listeye ekleyin.</p>
      ) : (
        [...batches.values()].map((b) => (
          <Card key={b.id} interactive={false} className="flex flex-col gap-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <CardTitle>Ödeme listesi · {fmtDateTime(b.createdAt)}</CardTitle>
              <span className="text-[13px] text-fg-passive tabular-nums">
                {b.rows.length} talep · {formatKurus(b.rows.reduce((s, r) => s + r.amountKurus, 0))} · {b.by} · <span className="font-mono">{b.id}</span>
              </span>
            </div>
            <BatchPayouts batchId={b.id} rows={b.rows} />
          </Card>
        ))
      )}
    </div>
  );

  const historyTab = (
    <DataTable
      caption="Ödeme geçmişi"
      emptyText="Henüz gönderilmiş ödeme yok."
      initialSort={{ key: "date", dir: "desc" }}
      columns={[
        { key: "influencer", header: "Influencer", sortable: true },
        { key: "amount", header: "Tutar", align: "right", sortable: true },
        { key: "status", header: "Durum", sortable: true },
        { key: "iban", header: "IBAN" },
        { key: "note", header: "Not" },
        { key: "date", header: "Tarih", sortable: true },
        { key: "file", header: "Dosya" },
      ]}
      rows={history.map((p) => {
        const at = p.sentAt ?? p.rejectedAt ?? p.updatedAt;
        return {
          id: p.id,
          cells: {
            influencer: { display: p.influencer.name, sort: p.influencer.name },
            amount: { display: formatKurus(p.amountKurus), sort: p.amountKurus },
            status: {
              display: <StatusDot tone={p.status === "GONDERILDI" ? "active" : "passive"}>{payoutStatusLabels[p.status]}</StatusDot>,
              sort: p.status,
            },
            iban: <span className="font-mono text-[13px]">{p.ibanSnapshot}</span>,
            note: <span className="text-[13px] text-fg-muted">{p.adminNote ?? "—"}</span>,
            date: { display: fmtDateTime(at), sort: at.getTime() },
            file: p.batchId ? (
              <span className="flex gap-3 text-[13px]">
                <a className="text-fg-muted hover:text-fg" href={`/api/finans/odeme-dosyasi?batch=${p.batchId}&format=csv`} download>
                  CSV
                </a>
                <a className="text-fg-muted hover:text-fg" href={`/api/finans/odeme-dosyasi?batch=${p.batchId}&format=xml`} download>
                  XML
                </a>
              </span>
            ) : (
              "—"
            ),
          },
        };
      })}
    />
  );

  return (
    <Stagger className="flex flex-col gap-8">
      <PageHeader
        title="Finans"
        description={`Platform ödeme talimatı üretir, transferi banka yapar. Hakediş kampanya kapanışı ve marka ödemesinden ${holdDays()} gün sonra çekilebilir; minimum çekim ${formatKurus(minPayoutKurus())}.`}
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Toplam hakedilen" value={totals.hakedilen} format="currency-kurus" hint="Henüz çekilemeyen hakedişler" />
        <MetricCard label="Çekilebilir" value={totals.cekilebilir} format="currency-kurus" hint="Talep edilebilir bakiye" />
        <MetricCard label="İşlemde" value={totals.islemde} format="currency-kurus" hint="Açık çekim talepleri" />
        <MetricCard label="Bu ay ödenen" value={paidThisMonth._sum.amountKurus ?? 0} format="currency-kurus" hint="Gönderildi olarak işaretlenen" />
      </div>
      <Tabs
        label="Finans bölümleri"
        tabs={[
          { id: "talepler", label: `Çekim talepleri (${requested.length})`, content: requestsTab },
          { id: "liste", label: `Ödeme listesi (${approved.length + listed.length})`, content: listTab },
          { id: "gecmis", label: "Geçmiş", content: historyTab },
        ]}
      />
    </Stagger>
  );
}
