import type { Metadata } from "next";
import { prisma, type PayoutStatus } from "@infulancer/core/db";
import { contentTypeLabels, formatKurus, ledgerReasonLabels, payoutStatusLabels, platformLabels } from "@infulancer/core/domain/labels";
import { computeBalances, holdDays, minPayoutKurus } from "@infulancer/core/domain/ledger";
import { BalanceCards } from "@/components/finance/balance-cards";
import { PayoutRequestButton } from "@/components/finance/payout-forms";
import { Card, CardTitle } from "@/components/ui/card";
import { PageHeader, Stagger } from "@/components/ui/layout";
import { WorkHistory } from "@/components/history/work-history";
import { StatusDot, type StatusTone } from "@/components/ui/status";
import { requireActor } from "@/lib/auth-guard";
import { maskIban } from "@/lib/format";
import { fmtDate, fmtDateTime } from "@/lib/time";

export const metadata: Metadata = { title: "Ödemeler" };

const payoutTone: Record<PayoutStatus, StatusTone> = {
  TALEP_EDILDI: "muted",
  ONAYLANDI: "active",
  ODEME_LISTESINDE: "active",
  GONDERILDI: "passive",
  REDDEDILDI: "passive",
};

export default async function InfluencerPaymentsPage() {
  const actor = await requireActor("INFLUENCER");
  const influencerId = actor.influencerId!;
  const now = new Date();
  const [me, balances, payouts, entries] = await Promise.all([
    prisma.influencer.findUniqueOrThrow({ where: { id: influencerId }, select: { iban: true, ibanHolder: true } }),
    computeBalances(influencerId, now),
    prisma.payoutRequest.findMany({
      where: { influencerId },
      orderBy: { createdAt: "desc" },
      select: { id: true, amountKurus: true, status: true, adminNote: true, createdAt: true, sentAt: true, rejectedAt: true },
    }),
    prisma.ledgerEntry.findMany({
      where: { influencerId, account: "INFLUENCER_PAYABLE" },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: { id: true, amountKurus: true, direction: true, reason: true, referenceType: true, referenceId: true, createdAt: true },
    }),
  ]);

  // Hakediş satırları için kampanya/iş adı (yalnız kendi işleri).
  const deliverableIds = entries.filter((e) => e.referenceType === "Deliverable").map((e) => e.referenceId);
  const deliverables = deliverableIds.length
    ? await prisma.deliverable.findMany({
        where: { id: { in: deliverableIds }, assignment: { influencerId } },
        select: { id: true, platform: true, contentType: true, assignment: { select: { campaign: { select: { name: true } } } } },
      })
    : [];
  const byDeliverable = new Map(deliverables.map((d) => [d.id, d]));
  const minKurus = minPayoutKurus();

  return (
    <Stagger className="flex flex-col gap-6">
      <PageHeader title="Ödemeler" description="Bakiyeniz, çekim talepleriniz ve hakediş geçmişiniz." />
      <BalanceCards balances={balances} holdDays={holdDays()} />

      <Card interactive={false} className="flex flex-col gap-3">
        <CardTitle>Çekim</CardTitle>
        <p className="text-[13px] text-fg-muted">
          Talepler ajans onayından sonra banka talimatına eklenir. Minimum çekim tutarı {formatKurus(minKurus)}.
        </p>
        <PayoutRequestButton cekilebilirKurus={balances.cekilebilir} minKurus={minKurus} maskedIban={maskIban(me.iban)} holder={me.ibanHolder} />
      </Card>

      <Card interactive={false} className="flex flex-col gap-4">
        <CardTitle>Çekim talepleri</CardTitle>
        {payouts.length === 0 ? (
          <p className="text-sm text-fg-passive">Henüz çekim talebiniz yok.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {payouts.map((p) => (
              <li key={p.id} className="flex flex-col gap-1 py-3 first:pt-0 sm:flex-row sm:items-center sm:justify-between">
                <span className="flex flex-col">
                  <span className="text-sm tabular-nums text-fg">{formatKurus(p.amountKurus)}</span>
                  <span className="text-[13px] text-fg-passive tabular-nums">
                    Talep {fmtDate(p.createdAt)}
                    {p.sentAt ? ` · gönderildi ${fmtDate(p.sentAt)}` : ""}
                    {p.status === "REDDEDILDI" && p.adminNote ? ` · ${p.adminNote}` : ""}
                  </span>
                </span>
                <StatusDot tone={payoutTone[p.status]}>{payoutStatusLabels[p.status]}</StatusDot>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card interactive={false} className="flex flex-col gap-4">
        <CardTitle>Hesap hareketleri</CardTitle>
        {entries.length === 0 ? (
          <p className="text-sm text-fg-passive">Tamamlanan iş olduğunda hakedişler burada görünür.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {entries.map((e) => {
              const d = byDeliverable.get(e.referenceId);
              const signed = e.direction === "CREDIT" ? e.amountKurus : -e.amountKurus;
              return (
                <li key={e.id} className="flex items-start justify-between gap-4 py-3 first:pt-0">
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-sm text-fg">
                      {d ? d.assignment.campaign.name : e.reason === "ODEME" ? "Banka transferi" : ledgerReasonLabels[e.reason]}
                    </span>
                    <span className="text-[13px] text-fg-passive tabular-nums">
                      {fmtDateTime(e.createdAt)} · {ledgerReasonLabels[e.reason]}
                      {d ? ` · ${platformLabels[d.platform]} ${contentTypeLabels[d.contentType]}` : ""}
                    </span>
                  </span>
                  <span className={`shrink-0 text-sm tabular-nums ${signed < 0 ? "text-fg-muted" : "text-fg"}`}>
                    {signed > 0 ? "+" : "−"}
                    {formatKurus(Math.abs(signed))}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
      <Card interactive={false} className="flex flex-col gap-4">
        <CardTitle>İş ve ödeme geçmişi</CardTitle>
        <WorkHistory influencerId={actor.influencerId!} mode="influencer" />
      </Card>
    </Stagger>
  );
}
