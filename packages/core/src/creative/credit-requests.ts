import { prisma } from "../db";
import { DomainError } from "../domain/errors";
import { notifyAdmins } from "../agents/common";
import { topUp } from "./credits";

export type CreditRequestStatus = "BEKLIYOR" | "ONAYLANDI" | "RED";
export const creditRequestStatusLabel: Record<CreditRequestStatus, string> = {
  BEKLIYOR: "Bekliyor",
  ONAYLANDI: "Onaylandı",
  RED: "Reddedildi",
};

/** Kullanıcı Creative bakiyesi (TL) talebi oluşturur; yöneticilere bildirim gider. */
export async function createCreditRequest(input: { tenantId: string; requestedByUserId?: string | null; role?: string | null; amountTry: number; note?: string | null }) {
  const amount = Math.round(input.amountTry);
  if (!Number.isFinite(amount) || amount < 100) throw new DomainError("DOGRULAMA", "En az 100 TL talep edebilirsiniz.");
  if (amount > 1_000_000) throw new DomainError("DOGRULAMA", "Talep tutarı çok yüksek.");
  // Aynı hesap için bekleyen talep varsa yenisini engelle (tekrarları önler).
  const pending = await prisma.creditRequest.findFirst({ where: { tenantId: input.tenantId, status: "BEKLIYOR" }, select: { id: true } });
  if (pending) throw new DomainError("KURAL_IHLALI", "Zaten bekleyen bir bakiye talebiniz var.");
  const req = await prisma.creditRequest.create({
    data: { tenantId: input.tenantId, requestedByUserId: input.requestedByUserId ?? null, role: input.role ?? null, amountTry: amount, note: input.note?.slice(0, 500) ?? null },
  });
  await notifyAdmins("Yeni bakiye talebi", `${amount} TL Creative bakiyesi talep edildi.`, "/admin/bakiye-talepleri");
  return req;
}

/** Yönetici talebi onaylar: bakiye yüklenir (idempotent — yalnız BEKLIYOR işlenir). */
export async function approveCreditRequest(id: string, decidedByUserId: string) {
  const updated = await prisma.creditRequest.updateMany({ where: { id, status: "BEKLIYOR" }, data: { status: "ONAYLANDI", decidedByUserId, decidedAt: new Date() } });
  if (updated.count !== 1) throw new DomainError("KURAL_IHLALI", "Talep zaten sonuçlandırılmış.");
  const req = await prisma.creditRequest.findUniqueOrThrow({ where: { id } });
  await topUp(req.tenantId, req.amountTry, "Bakiye talebi onaylandı");
  return req;
}

/** Yönetici talebi reddeder (bakiye yüklenmez). */
export async function rejectCreditRequest(id: string, decidedByUserId: string) {
  const updated = await prisma.creditRequest.updateMany({ where: { id, status: "BEKLIYOR" }, data: { status: "RED", decidedByUserId, decidedAt: new Date() } });
  if (updated.count !== 1) throw new DomainError("KURAL_IHLALI", "Talep zaten sonuçlandırılmış.");
  return prisma.creditRequest.findUniqueOrThrow({ where: { id } });
}
