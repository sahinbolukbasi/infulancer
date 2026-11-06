import { Prisma } from "../generated/prisma/client";
import { prisma, type Tx } from "../db";
import { notifyAdmins } from "../agents/common";
import { envInt } from "../env";

/**
 * Creative kredileri: submit'te HOLD, fal webhook'unda (başarılı çıktı) CHARGE.
 * Başarısız üretimde hold serbest bırakılır (fal sunucu hatasını faturalamaz, biz de faturalamayız).
 * Tüm geçişler idempotent: aynı hold ikinci kez tahsil/serbest edilemez.
 */
export class InsufficientCreditsError extends Error {}

const D = (n: number | string | Prisma.Decimal) => new Prisma.Decimal(n);

export async function placeHold(tenantId: string, credits: number, db: Tx = prisma) {
  await db.creditAccount.upsert({ where: { tenantId }, create: { tenantId }, update: {} });
  // Koşullu güncelleme: kullanılabilir bakiye yeterliyse hold'a al (yarış güvenli).
  const updated = await db.$executeRaw`
    UPDATE credit_accounts SET "heldCredits" = "heldCredits" + ${credits}, "updatedAt" = now()
    WHERE "tenantId" = ${tenantId} AND "balanceCredits" - "heldCredits" >= ${credits}`;
  if (updated !== 1) throw new InsufficientCreditsError("Yetersiz kredi bakiyesi.");
  return db.creditHold.create({ data: { tenantId, credits: D(credits) } });
}

export async function chargeHold(holdId: string, db: Tx = prisma): Promise<boolean> {
  const hold = await db.creditHold.findUnique({ where: { id: holdId } });
  if (!hold || hold.status !== "held") return false;
  const n = await db.creditHold.updateMany({ where: { id: holdId, status: "held" }, data: { status: "charged", settledAt: new Date() } });
  if (n.count !== 1) return false;
  await db.$executeRaw`
    UPDATE credit_accounts SET "heldCredits" = "heldCredits" - ${hold.credits}, "balanceCredits" = "balanceCredits" - ${hold.credits}, "updatedAt" = now()
    WHERE "tenantId" = ${hold.tenantId}`;
  const acc = await db.creditAccount.findUnique({ where: { tenantId: hold.tenantId } });
  if (acc && acc.balanceCredits.lessThan(acc.lowBalanceAlert)) {
    await notifyAdmins("Kredi bakiyesi düşük", `${hold.tenantId}: kalan ${acc.balanceCredits.toFixed(0)} kredi. (fal prepaid bakiyesi aynı zamanda eşzamanlılık limitidir.)`, "/creative");
  }
  return true;
}

export async function releaseHold(holdId: string, db: Tx = prisma): Promise<boolean> {
  const hold = await db.creditHold.findUnique({ where: { id: holdId } });
  if (!hold || hold.status !== "held") return false;
  const n = await db.creditHold.updateMany({ where: { id: holdId, status: "held" }, data: { status: "released", settledAt: new Date() } });
  if (n.count !== 1) return false;
  await db.$executeRaw`UPDATE credit_accounts SET "heldCredits" = "heldCredits" - ${hold.credits}, "updatedAt" = now() WHERE "tenantId" = ${hold.tenantId}`;
  return true;
}

export async function topUp(tenantId: string, credits: number) {
  return prisma.creditAccount.upsert({
    where: { tenantId },
    create: { tenantId, balanceCredits: D(credits) },
    update: { balanceCredits: { increment: D(credits) } },
  });
}

/**
 * Hoş geldin kredisi: hesabı hiç olmayan (ilk kez Creative açan) marka/influencer için
 * tek seferlik başlangıç bakiyesi açar. Hesap zaten varsa hiçbir şey yapmaz (idempotent).
 */
export async function ensureStarterCredits(tenantId: string, credits = envInt("CREATIVE_STARTER_CREDITS", 30)) {
  return prisma.creditAccount.upsert({ where: { tenantId }, create: { tenantId, balanceCredits: D(credits) }, update: {} });
}
