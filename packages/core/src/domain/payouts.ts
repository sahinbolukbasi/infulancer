import { audit } from "../audit";
import { taxGateForPayout } from "./tax-profile";
import { requireRole, toAuditActor, type Actor } from "../access/actor";
import { prisma, type PayoutStatus, type Tx } from "../db";
import { DomainError } from "./errors";
import { formatKurus, payoutStatusLabels } from "./labels";
import { computeBalances, minPayoutKurus, recordPayoutSent } from "./ledger";

/**
 * Çekim talebi akışı (tek yönlü zincir):
 *   TALEP_EDILDI → ONAYLANDI → ODEME_LISTESINDE → GONDERILDI
 *   TALEP_EDILDI → REDDEDILDI
 * Zincir dışındaki her geçiş reddedilir. Her adım audit'e yazılır ve
 * influencer'a uygulama içi bildirim gider. Platform para transferi yapmaz;
 * yalnızca banka talimat dosyası üretir.
 */

export const PAYOUT_TRANSITIONS: Record<PayoutStatus, PayoutStatus[]> = {
  TALEP_EDILDI: ["ONAYLANDI", "REDDEDILDI"],
  ONAYLANDI: ["ODEME_LISTESINDE"],
  ODEME_LISTESINDE: ["GONDERILDI"],
  GONDERILDI: [],
  REDDEDILDI: [],
};

export function canTransitionPayout(from: PayoutStatus, to: PayoutStatus): boolean {
  return PAYOUT_TRANSITIONS[from].includes(to);
}

const MAX_NOTE = 1000;
const INFLUENCER_HREF = "/influencer/odemeler";
const ADMIN_HREF = "/admin/finans";

type Message = { title: string; body: string; href: string };

async function notifyInfluencerUser(tx: Tx, influencerId: string, msg: Message) {
  const user = await tx.user.findUnique({ where: { influencerId }, select: { id: true } });
  if (user) await tx.notification.create({ data: { userId: user.id, ...msg } });
}

async function notifyAdminUsers(tx: Tx, msg: Message) {
  const admins = await tx.user.findMany({ where: { role: "ADMIN" }, select: { id: true } });
  if (admins.length) await tx.notification.createMany({ data: admins.map((a) => ({ userId: a.id, ...msg })) });
}

function cleanNote(note: string | null | undefined): string | null {
  const v = (note ?? "").trim();
  if (v.length > MAX_NOTE) throw new DomainError("DOGRULAMA", `Not en fazla ${MAX_NOTE} karakter olabilir.`);
  return v === "" ? null : v;
}

function assertTransition(id: string, from: PayoutStatus, to: PayoutStatus) {
  if (!canTransitionPayout(from, to)) {
    throw new DomainError(
      "GECERSIZ_GECIS",
      `Talep "${payoutStatusLabels[from]}" durumundan "${payoutStatusLabels[to]}" durumuna geçemez.`,
      { id, from, to },
    );
  }
}

function uniqueIds(ids: string[]): string[] {
  const out = [...new Set(ids.map((s) => s.trim()).filter(Boolean))];
  if (out.length === 0) throw new DomainError("DOGRULAMA", "En az bir talep seçin.");
  if (out.length > 500) throw new DomainError("DOGRULAMA", "Tek seferde en fazla 500 talep işlenebilir.");
  return out;
}

/** Seçilen taleplerin tamamının beklenen durumda olduğunu doğrular (satırları kilitler). */
async function loadForTransition(tx: Tx, ids: string[], to: PayoutStatus) {
  await tx.$queryRaw`SELECT id FROM "PayoutRequest" WHERE id = ANY(${ids}) FOR UPDATE`;
  const rows = await tx.payoutRequest.findMany({
    where: { id: { in: ids } },
    select: { id: true, status: true, influencerId: true, amountKurus: true },
  });
  if (rows.length !== ids.length) throw new DomainError("BULUNAMADI", "Seçilen taleplerden biri bulunamadı.");
  for (const r of rows) assertTransition(r.id, r.status, to);
  return rows;
}

/** Influencer çekim talebi: en az MIN_PAYOUT_KURUS, en çok çekilebilir bakiye. */
export async function requestPayout(actorIn: Actor, amountKurus: number) {
  const actor = requireRole(actorIn, "INFLUENCER");
  const influencerId = actor.influencerId!;
  if (!Number.isInteger(amountKurus) || amountKurus <= 0) {
    throw new DomainError("DOGRULAMA", "Geçerli bir tutar girin.");
  }
  const min = minPayoutKurus();
  if (amountKurus < min) {
    throw new DomainError("DOGRULAMA", `En az ${formatKurus(min)} çekim talebi oluşturabilirsiniz.`);
  }

  return prisma.$transaction(
    async (tx) => {
      // Aynı influencer için eşzamanlı talepler sırayla değerlendirilir.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`payout:request:${influencerId}`}))`;
      const balances = await computeBalances(influencerId, new Date(), tx);
      if (amountKurus > balances.cekilebilir) {
        throw new DomainError(
          "YETERSIZ_BAKIYE",
          `Çekilebilir bakiyeniz ${formatKurus(Math.max(balances.cekilebilir, 0))}; bu tutarda talep oluşturulamaz.`,
        );
      }
      const influencer = await tx.influencer.findUniqueOrThrow({
        where: { id: influencerId },
        select: { name: true, iban: true, ibanHolder: true },
      });
      if (!influencer.iban.trim() || !influencer.ibanHolder.trim()) {
        throw new DomainError("KURAL_IHLALI", "Kayıtlı IBAN bilgisi eksik; ajansınızla iletişime geçin.");
      }
      // Vergi kapısı: 20/B → yalnız belirlenmiş IBAN; 'diger' → admin + mali müşavir onayı olmadan kilitli.
      const taxGate = await taxGateForPayout(influencerId, influencer.iban, tx);
      if (!taxGate.ok) throw new DomainError("KURAL_IHLALI", taxGate.reason);
      const payout = await tx.payoutRequest.create({
        data: {
          influencerId,
          amountKurus,
          status: "TALEP_EDILDI",
          ibanSnapshot: taxGate.iban,
          ibanHolderSnapshot: influencer.ibanHolder,
        },
        select: { id: true, amountKurus: true, status: true },
      });
      await audit.append({
        actor: toAuditActor(actor),
        action: "PAYOUT_TALEP_EDILDI",
        entityType: "PayoutRequest",
        entityId: payout.id,
        data: { influencerId, amountKurus, cekilebilirBefore: balances.cekilebilir },
      });
      await notifyInfluencerUser(tx, influencerId, {
        title: "Çekim talebiniz alındı",
        body: `${formatKurus(amountKurus)} tutarındaki talebiniz ajans onayını bekliyor.`,
        href: INFLUENCER_HREF,
      });
      await notifyAdminUsers(tx, {
        title: "Yeni çekim talebi",
        body: `${influencer.name} · ${formatKurus(amountKurus)}`,
        href: ADMIN_HREF,
      });
      return payout;
    },
    { isolationLevel: "Serializable" },
  );
}

/** Admin onayı: TALEP_EDILDI → ONAYLANDI. */
export async function approvePayout(actorIn: Actor, id: string, note?: string | null) {
  const actor = requireRole(actorIn, "ADMIN");
  const adminNote = cleanNote(note);
  return prisma.$transaction(async (tx) => {
    const [row] = await loadForTransition(tx, [id], "ONAYLANDI");
    const updated = await tx.payoutRequest.update({
      where: { id },
      data: { status: "ONAYLANDI", approvedAt: new Date(), ...(adminNote ? { adminNote } : {}) },
      select: { id: true, status: true },
    });
    await audit.append({
      actor: toAuditActor(actor),
      action: "PAYOUT_ONAYLANDI",
      entityType: "PayoutRequest",
      entityId: id,
      data: { from: row!.status, note: adminNote, amountKurus: row!.amountKurus },
    });
    await notifyInfluencerUser(tx, row!.influencerId, {
      title: "Çekim talebiniz onaylandı",
      body: `${formatKurus(row!.amountKurus)} ödeme listesine alınacak.${adminNote ? ` Not: ${adminNote}` : ""}`,
      href: INFLUENCER_HREF,
    });
    return updated;
  });
}

/** Admin reddi: TALEP_EDILDI → REDDEDILDI (gerekçe zorunlu). Tutar çekilebilire geri döner. */
export async function rejectPayout(actorIn: Actor, id: string, note: string) {
  const actor = requireRole(actorIn, "ADMIN");
  const adminNote = cleanNote(note);
  if (!adminNote) throw new DomainError("DOGRULAMA", "Ret gerekçesi yazın; influencer'a iletilir.");
  return prisma.$transaction(async (tx) => {
    const [row] = await loadForTransition(tx, [id], "REDDEDILDI");
    const updated = await tx.payoutRequest.update({
      where: { id },
      data: { status: "REDDEDILDI", rejectedAt: new Date(), adminNote },
      select: { id: true, status: true },
    });
    await audit.append({
      actor: toAuditActor(actor),
      action: "PAYOUT_REDDEDILDI",
      entityType: "PayoutRequest",
      entityId: id,
      data: { from: row!.status, note: adminNote, amountKurus: row!.amountKurus },
    });
    await notifyInfluencerUser(tx, row!.influencerId, {
      title: "Çekim talebiniz reddedildi",
      body: `${formatKurus(row!.amountKurus)} · Gerekçe: ${adminNote}`,
      href: INFLUENCER_HREF,
    });
    return updated;
  });
}

/** ONAYLANDI → ODEME_LISTESINDE; seçilenler için tek bir PayoutBatch açılır. */
export async function addToPaymentList(actorIn: Actor, ids: string[]) {
  const actor = requireRole(actorIn, "ADMIN");
  const list = uniqueIds(ids);
  return prisma.$transaction(async (tx) => {
    const rows = await loadForTransition(tx, list, "ODEME_LISTESINDE");
    const batch = await tx.payoutBatch.create({
      data: { createdById: actor.userId, format: "CSV/XML" },
      select: { id: true, createdAt: true },
    });
    await tx.payoutRequest.updateMany({
      where: { id: { in: list } },
      data: { status: "ODEME_LISTESINDE", batchId: batch.id },
    });
    const total = rows.reduce((s, r) => s + r.amountKurus, 0);
    await audit.append({
      actor: toAuditActor(actor),
      action: "PAYOUT_BATCH_OLUSTURULDU",
      entityType: "PayoutBatch",
      entityId: batch.id,
      data: { payoutIds: list, totalKurus: total },
    });
    for (const r of rows) {
      await audit.append({
        actor: toAuditActor(actor),
        action: "PAYOUT_ODEME_LISTESINDE",
        entityType: "PayoutRequest",
        entityId: r.id,
        data: { from: r.status, batchId: batch.id, amountKurus: r.amountKurus },
      });
      await notifyInfluencerUser(tx, r.influencerId, {
        title: "Ödemeniz listeye alındı",
        body: `${formatKurus(r.amountKurus)} banka talimatına eklendi.`,
        href: INFLUENCER_HREF,
      });
    }
    return { batchId: batch.id, count: rows.length, totalKurus: total };
  });
}

/**
 * ODEME_LISTESINDE → GONDERILDI. Her talep için ODEME çift kaydı yazılır
 * (DEBIT INFLUENCER_PAYABLE / CREDIT AGENCY_BANK). Banka transferini yapan bankadır;
 * bu adım yalnızca transferin gerçekleştiğini kaydeder.
 */
export async function markSent(actorIn: Actor, ids: string[]) {
  const actor = requireRole(actorIn, "ADMIN");
  const list = uniqueIds(ids);
  return prisma.$transaction(
    async (tx) => {
      const rows = await loadForTransition(tx, list, "GONDERILDI");
      let total = 0;
      for (const r of rows) {
        const res = await recordPayoutSent(tx, r.id, toAuditActor(actor));
        if (!res) throw new DomainError("GECERSIZ_GECIS", "Talep zaten gönderildi olarak işaretlenmiş.");
        total += res.amountKurus;
        await notifyInfluencerUser(tx, r.influencerId, {
          title: "Ödemeniz gönderildi",
          body: `${formatKurus(r.amountKurus)} kayıtlı IBAN'ınıza gönderildi.`,
          href: INFLUENCER_HREF,
        });
      }
      return { count: rows.length, totalKurus: total };
    },
    { timeout: 60_000 },
  );
}
