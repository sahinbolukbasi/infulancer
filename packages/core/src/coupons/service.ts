import { prisma } from "../db";
import { DomainError } from "../domain/errors";
import { uniqueCode } from "../wallet/maps";

/**
 * Kupon / hediye çeki yönetimi: marka şablon tasarlar, influencer'lara gönderir.
 * sharedCode tanımlıysa herkeste aynı kod; değilse her gönderimde benzersiz kod üretilir.
 */
export type CreateCouponInput = {
  tenantId: string;
  kind: "KUPON" | "HEDIYE_CEKI";
  title: string;
  description?: string | null;
  logoKey?: string | null;
  heroImageKey?: string | null;
  brandColor?: string | null;
  sharedCode?: string | null;
  valueType: "YUZDE" | "TUTAR";
  value: number;
  terms?: string | null;
  validFrom?: Date | null;
  validUntil?: Date | null;
  createdByUserId?: string | null;
};

export async function createCoupon(input: CreateCouponInput) {
  if (!(await prisma.brand.findUnique({ where: { id: input.tenantId }, select: { id: true } }))) throw new DomainError("BULUNAMADI", "Marka bulunamadı.");
  if (input.valueType === "YUZDE" && (input.value < 1 || input.value > 100)) throw new DomainError("DOGRULAMA", "Yüzde indirim 1-100 arasında olmalı.");
  if (input.valueType === "TUTAR" && input.value < 1) throw new DomainError("DOGRULAMA", "Tutar sıfırdan büyük olmalı.");
  if (input.validFrom && input.validUntil && input.validUntil < input.validFrom) throw new DomainError("DOGRULAMA", "Geçerlilik bitişi başlangıçtan önce olamaz.");
  return prisma.coupon.create({
    data: {
      tenantId: input.tenantId,
      kind: input.kind,
      title: input.title,
      description: input.description ?? null,
      logoKey: input.logoKey ?? null,
      heroImageKey: input.heroImageKey ?? null,
      brandColor: input.brandColor ?? null,
      sharedCode: input.sharedCode?.trim() || null,
      valueType: input.valueType,
      value: BigInt(Math.round(input.value)),
      terms: input.terms ?? null,
      validFrom: input.validFrom ?? null,
      validUntil: input.validUntil ?? null,
      createdByUserId: input.createdByUserId ?? null,
    },
  });
}

export async function setCouponStatus(tenantId: string, id: string, to: "TASLAK" | "YAYINDA" | "PASIF") {
  const c = await prisma.coupon.findFirst({ where: { id, tenantId }, select: { id: true } });
  if (!c) throw new DomainError("BULUNAMADI", "Kupon bulunamadı.");
  return prisma.coupon.update({ where: { id }, data: { status: to } });
}

/** Bir kuponu bir influencer'a gönderir (benzersiz veya paylaşılan kod). */
export async function grantCoupon(couponId: string, influencerId: string) {
  const coupon = await prisma.coupon.findUnique({ where: { id: couponId }, select: { id: true, sharedCode: true, status: true } });
  if (!coupon) throw new DomainError("BULUNAMADI", "Kupon bulunamadı.");
  if (coupon.status !== "YAYINDA") throw new DomainError("KURAL_IHLALI", "Yalnız yayında olan kupon gönderilebilir.");
  const dup = await prisma.couponGrant.findFirst({ where: { couponId, influencerId }, select: { id: true } });
  if (dup) throw new DomainError("CAKISMA", "Bu kişiye zaten gönderilmiş.");
  // Grant kodu her zaman benzersizdir (tekil takip). Paylaşılan kod (sharedCode) görüntülemede kullanılır.
  const code = uniqueCode("KPN");
  return prisma.couponGrant.create({ data: { couponId, influencerId, code } });
}

/** Toplu gönderim: seçili influencer listesi (veya tümü için çağıran id listesini verir). */
export async function grantCouponMany(couponId: string, influencerIds: string[]) {
  const results = [];
  for (const influencerId of [...new Set(influencerIds)]) {
    try {
      results.push(await grantCoupon(couponId, influencerId));
    } catch (e) {
      if (!(e instanceof DomainError && e.code === "CAKISMA")) throw e;
    }
  }
  return results;
}

/** Kupon kodunu kullanıldı olarak işaretler (idempotent). */
export async function redeemGrant(code: string) {
  const grant = await prisma.couponGrant.findUnique({ where: { code }, include: { coupon: { select: { title: true, validUntil: true, status: true } } } });
  if (!grant) throw new DomainError("BULUNAMADI", "Kupon kodu bulunamadı.");
  if (grant.status === "IPTAL") throw new DomainError("KURAL_IHLALI", "Kupon iptal edilmiş.");
  if (grant.coupon.validUntil && grant.coupon.validUntil < new Date()) throw new DomainError("KURAL_IHLALI", "Kuponun geçerlilik süresi dolmuş.");
  if (grant.status === "KULLANILDI") return { ok: false as const, alreadyUsed: true, grant };
  const updated = await prisma.couponGrant.update({ where: { id: grant.id }, data: { status: "KULLANILDI", redeemedAt: new Date() } });
  return { ok: true as const, alreadyUsed: false, grant: { ...grant, ...updated } };
}

/** İndirim değerini okunur metne çevirir. */
export function couponValueLabel(valueType: "YUZDE" | "TUTAR", value: bigint | number): string {
  const v = Number(value);
  return valueType === "YUZDE" ? `%${v} indirim` : `${(v / 100).toLocaleString("tr-TR")} TL değerinde`;
}
