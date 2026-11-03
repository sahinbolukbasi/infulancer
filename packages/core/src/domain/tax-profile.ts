import { prisma, type Tx } from "../db";
import { DomainError } from "./errors";

/**
 * Influencer vergi durumu (mevcut ledger'a eklenti).
 * - istisna_20b: GVK mükerrer 20/B. Ödeme YALNIZ designated_iban'a; banka %15 stopaj yapar.
 *   Gelir başka hesaba ödenirse istisna KAYBEDİLİR → designated_iban dışına ödeme sistem
 *   düzeyinde İMKÂNSIZ (DB trigger payout_iban_guard + bu servis kontrolü).
 * - kayitli_mukellef: SMM/fatura; KDV ve stopaj normal akış.
 * - diger (fatura kesemeyen): VARSAYILAN KİLİTLİ — admin onayı + mali müşavir görüşü olmadan ödeme yok.
 */
export function normalizeIban(iban: string): string {
  return iban.replace(/\s+/g, "").toUpperCase();
}

export type PayoutTaxGate = { ok: true; iban: string; note: string | null } | { ok: false; reason: string };

export async function taxGateForPayout(influencerId: string, requestedIban: string, db: Tx = prisma): Promise<PayoutTaxGate> {
  const p = await db.influencerTaxProfile.findUnique({ where: { influencerId } });
  if (!p) {
    // Profil yoksa 'diger' gibi davranılır: kilitli.
    return { ok: false, reason: "Vergi profili tanımlı değil; ödeme kilitli. Admin vergi durumunu tanımlamalı." };
  }
  if (p.status === "istisna_20b") {
    if (!p.designatedIban || !p.istisnaBelgesiS3Key) return { ok: false, reason: "20/B istisna belgesi ve belirlenmiş IBAN yüklenmeden ödeme yapılamaz." };
    if (normalizeIban(requestedIban) !== normalizeIban(p.designatedIban)) {
      return { ok: false, reason: "20/B istisnası: ödeme yalnız belirlenmiş IBAN'a yapılabilir. Farklı hesaba ödeme istisnayı ortadan kaldırır." };
    }
    return { ok: true, iban: p.designatedIban, note: "20/B: banka transfer tarihinde %15 stopaj uygular; ayrıca GVK 94 stopajı uygulanmaz." };
  }
  if (p.status === "diger") {
    if (!p.adminUnlockedAt || !p.advisorOpinionS3Key) {
      return { ok: false, reason: "Fatura kesemeyen influencer: ödeme kilitli. Mali müşavir görüşü yüklenmeli ve admin onayı verilmeli." };
    }
    return { ok: true, iban: requestedIban, note: "Mali müşavir görüşüne göre gider pusulası/stopaj uygulanmalı." };
  }
  return { ok: true, iban: requestedIban, note: p.vatRegistered ? "Fatura (KDV dahil) bekleniyor." : "Serbest meslek makbuzu bekleniyor." };
}

export async function upsertTaxProfile(
  influencerId: string,
  input: { status: "istisna_20b" | "kayitli_mukellef" | "diger"; designatedIban?: string | null; istisnaBelgesiS3Key?: string | null; vatRegistered?: boolean; verifiedBy?: string },
) {
  if (input.status === "istisna_20b" && (!input.designatedIban || !input.istisnaBelgesiS3Key)) {
    throw new DomainError("DOGRULAMA", "20/B için istisna belgesi ve belirlenmiş IBAN zorunlu.");
  }
  const data = {
    status: input.status,
    designatedIban: input.designatedIban ? normalizeIban(input.designatedIban) : null,
    istisnaBelgesiS3Key: input.istisnaBelgesiS3Key ?? null,
    vatRegistered: input.vatRegistered ?? false,
    verifiedAt: input.verifiedBy ? new Date() : null,
    verifiedBy: input.verifiedBy ?? null,
  };
  return prisma.influencerTaxProfile.upsert({ where: { influencerId }, create: { influencerId, ...data }, update: data });
}

/** 'diger' kilidini açma: mali müşavir görüşü + admin. */
export async function unlockOtherStatus(influencerId: string, adminUserId: string, advisorOpinionS3Key: string) {
  if (!advisorOpinionS3Key.trim()) throw new DomainError("DOGRULAMA", "Mali müşavir görüşü yüklenmeli.");
  return prisma.influencerTaxProfile.update({
    where: { influencerId },
    data: { advisorOpinionS3Key, adminUnlockedAt: new Date(), adminUnlockedById: adminUserId },
  });
}

export const taxStatusLabels = {
  istisna_20b: "20/B istisna belgeli",
  kayitli_mukellef: "Kayıtlı mükellef",
  diger: "Fatura kesemiyor (kilitli)",
} as const;
