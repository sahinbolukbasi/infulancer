import { randomUUID } from "node:crypto";
import { audit, type AuditActor } from "../audit";
import { prisma, type Tx } from "../db";
import { envInt } from "../env";
import { DomainError } from "./errors";

/**
 * Çift kayıt defteri. Bakiye hiçbir yerde saklanmaz; burada türetilir.
 *
 * HAKEDIS: DEBIT AGENCY_EXPENSE / CREDIT INFLUENCER_PAYABLE (deliverable TAMAMLANDI olduğunda)
 * ODEME:   DEBIT INFLUENCER_PAYABLE / CREDIT AGENCY_BANK   (ödeme gönderildiğinde)
 */

export const DAY_MS = 24 * 60 * 60 * 1000;

export function holdDays(): number {
  return envInt("HOLD_DAYS", 14);
}

export function minPayoutKurus(): number {
  return envInt("MIN_PAYOUT_KURUS", 50_000);
}

export const OPEN_PAYOUT_STATUSES = ["TALEP_EDILDI", "ONAYLANDI", "ODEME_LISTESINDE"] as const;

export type Balances = {
  /** İş teslim edildi, henüz çekilemez. */
  hakedilen: number;
  /** Kampanya kapandı, marka ödemesi alındı, bekleme süresi geçti; açık talepler düşülmüş. */
  cekilebilir: number;
  /** Açık çekim talepleri toplamı. */
  islemde: number;
};

type CampaignMaturity = {
  status: string;
  closedAt: Date | null;
  brandPaymentReceivedAt: Date | null;
};

/** Hakedişin çekilebilir olacağı an; henüz belli değilse null. */
export function maturityDate(c: CampaignMaturity, hold = holdDays()): Date | null {
  if (c.status !== "KAPANDI" || !c.closedAt || !c.brandPaymentReceivedAt) return null;
  const base = Math.max(c.closedAt.getTime(), c.brandPaymentReceivedAt.getTime());
  return new Date(base + hold * DAY_MS);
}

type Db = Tx | typeof prisma;

export async function computeBalances(
  influencerId: string,
  now: Date = new Date(),
  db: Db = prisma,
): Promise<Balances> {
  const entries = await db.ledgerEntry.findMany({
    where: { influencerId, account: "INFLUENCER_PAYABLE" },
    select: { amountKurus: true, direction: true, reason: true, referenceType: true, referenceId: true },
  });

  const earningDeliverableIds = entries
    .filter((e) => e.reason === "HAKEDIS" && e.referenceType === "Deliverable")
    .map((e) => e.referenceId);

  const deliverables = earningDeliverableIds.length
    ? await db.deliverable.findMany({
        where: { id: { in: earningDeliverableIds } },
        select: {
          id: true,
          assignment: {
            select: {
              campaign: { select: { status: true, closedAt: true, brandPaymentReceivedAt: true } },
            },
          },
        },
      })
    : [];
  const campaignByDeliverable = new Map(deliverables.map((d) => [d.id, d.assignment.campaign]));

  const hold = holdDays();
  let hakedilen = 0;
  let matured = 0;
  let paidOut = 0;
  let adjustments = 0;

  for (const e of entries) {
    const signed = e.direction === "CREDIT" ? e.amountKurus : -e.amountKurus;
    if (e.reason === "HAKEDIS") {
      const campaign = campaignByDeliverable.get(e.referenceId);
      const maturesAt = campaign ? maturityDate(campaign, hold) : null;
      if (maturesAt && now >= maturesAt) matured += signed;
      else hakedilen += signed;
    } else if (e.reason === "ODEME") {
      paidOut += -signed;
    } else {
      adjustments += signed;
    }
  }

  const open = await db.payoutRequest.aggregate({
    where: { influencerId, status: { in: [...OPEN_PAYOUT_STATUSES] } },
    _sum: { amountKurus: true },
  });
  const islemde = open._sum.amountKurus ?? 0;

  return {
    hakedilen,
    cekilebilir: matured + adjustments - paidOut - islemde,
    islemde,
  };
}

/**
 * Deliverable için HAKEDIS çifti yazar. Atama bedeli, iptal edilmemiş
 * deliverable'lara bölünür (kalan kuruş son deliverable'a). Deliverable başına
 * idempotenttir: daha önce yazıldıysa null döner.
 */
export async function recordEarning(
  tx: Tx,
  deliverableId: string,
  actor: AuditActor = { id: null, role: "SYSTEM" },
): Promise<{ txId: string; amountKurus: number } | null> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`ledger:hakedis:${deliverableId}`}))`;

  const existing = await tx.ledgerEntry.findFirst({
    where: { reason: "HAKEDIS", referenceType: "Deliverable", referenceId: deliverableId },
    select: { id: true },
  });
  if (existing) return null;

  const deliverable = await tx.deliverable.findUnique({
    where: { id: deliverableId },
    select: {
      id: true,
      status: true,
      assignment: {
        select: {
          id: true,
          influencerId: true,
          feeKurus: true,
          deliverables: {
            where: { status: { not: "IPTAL" } },
            select: { id: true },
            orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          },
        },
      },
    },
  });
  if (!deliverable) throw new DomainError("BULUNAMADI", "Deliverable bulunamadı.");
  if (deliverable.status !== "TAMAMLANDI") {
    throw new DomainError("KURAL_IHLALI", "Hakediş yalnızca tamamlanan iş için yazılır.");
  }

  const { assignment } = deliverable;
  const count = Math.max(assignment.deliverables.length, 1);
  const base = Math.floor(assignment.feeKurus / count);
  const remainder = assignment.feeKurus - base * count;
  const isLast = assignment.deliverables[assignment.deliverables.length - 1]?.id === deliverableId;
  const amountKurus = base + (isLast ? remainder : 0);
  if (amountKurus <= 0) return null;

  const txId = randomUUID();
  const common = {
    txId,
    influencerId: assignment.influencerId,
    amountKurus,
    reason: "HAKEDIS" as const,
    referenceType: "Deliverable",
    referenceId: deliverableId,
  };
  await tx.ledgerEntry.createMany({
    data: [
      { ...common, account: "AGENCY_EXPENSE", direction: "DEBIT" },
      { ...common, account: "INFLUENCER_PAYABLE", direction: "CREDIT" },
    ],
  });

  await audit.append({
    actor,
    action: "LEDGER_HAKEDIS",
    entityType: "Deliverable",
    entityId: deliverableId,
    data: { txId, amountKurus, influencerId: assignment.influencerId, assignmentId: assignment.id },
  });

  return { txId, amountKurus };
}

/**
 * Ödeme gönderildi: talebi GONDERILDI yapar ve ODEME çiftini yazar.
 * Talep başına idempotenttir.
 */
export async function recordPayoutSent(
  tx: Tx,
  payoutId: string,
  actor: AuditActor,
): Promise<{ txId: string; amountKurus: number } | null> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`ledger:odeme:${payoutId}`}))`;

  const payout = await tx.payoutRequest.findUnique({ where: { id: payoutId } });
  if (!payout) throw new DomainError("BULUNAMADI", "Çekim talebi bulunamadı.");

  const existing = await tx.ledgerEntry.findFirst({
    where: { reason: "ODEME", referenceType: "PayoutRequest", referenceId: payoutId },
    select: { id: true },
  });
  if (existing || payout.status === "GONDERILDI") return null;

  if (payout.status !== "ONAYLANDI" && payout.status !== "ODEME_LISTESINDE") {
    throw new DomainError(
      "GECERSIZ_GECIS",
      "Yalnızca onaylanmış veya ödeme listesindeki talepler gönderildi olarak işaretlenebilir.",
    );
  }

  const sentAt = new Date();
  await tx.payoutRequest.update({
    where: { id: payoutId },
    data: { status: "GONDERILDI", sentAt },
  });

  const txId = randomUUID();
  const common = {
    txId,
    influencerId: payout.influencerId,
    amountKurus: payout.amountKurus,
    reason: "ODEME" as const,
    referenceType: "PayoutRequest",
    referenceId: payoutId,
  };
  await tx.ledgerEntry.createMany({
    data: [
      { ...common, account: "INFLUENCER_PAYABLE", direction: "DEBIT" },
      { ...common, account: "AGENCY_BANK", direction: "CREDIT" },
    ],
  });

  await audit.append({
    actor,
    action: "PAYOUT_GONDERILDI",
    entityType: "PayoutRequest",
    entityId: payoutId,
    data: { txId, amountKurus: payout.amountKurus, influencerId: payout.influencerId, from: payout.status },
  });

  return { txId, amountKurus: payout.amountKurus };
}
