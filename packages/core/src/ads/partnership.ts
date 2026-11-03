import { prisma } from "../db";
import { notifyAdmins, recordRun } from "../agents/common";

/**
 * Partnership Ads (creator içeriğiyle reklam). Kod creator'ın KENDİ OAuth'u ile üretilir:
 * instagram_branded_content_creator izni creator'ın IG hesabına scope'ludur; markanın token'ıyla
 * üretilemez → iki taraflı (creator-app + brand-app) yapı. Creator kodu istediği an iptal edebilir
 * (DELETE /{ig-media-id}/partnership_ad_code) → kod DEĞİŞKEN DURUMDUR, lansmandan hemen önce
 * yeniden doğrulanır. Süre dolumu belgesiz; varsayılmaz.
 */
export const CREATOR_SCOPES = ["instagram_basic", "business_management", "instagram_branded_content_creator"];

export interface PartnershipProvider {
  createCode(igMediaId: string, creatorToken: string): Promise<string>;
  /** Kodun hâlâ geçerli olup olmadığı (creator iptal etmiş olabilir). */
  isCodeActive(igMediaId: string, creatorToken: string): Promise<boolean>;
}

export const mockPartnership: PartnershipProvider & { revoked: Set<string> } = {
  revoked: new Set(),
  async createCode(igMediaId) {
    return `pac_${igMediaId}`;
  },
  async isCodeActive(igMediaId) {
    return !this.revoked.has(igMediaId);
  },
};

export function assertCreatorScopes(scopes: string[]) {
  const missing = CREATOR_SCOPES.filter((s) => !scopes.includes(s));
  if (missing.length) throw new Error(`Creator OAuth izinleri eksik: ${missing.join(", ")} (marka token'ı ile üretilemez).`);
}

export async function issuePartnershipCode(input: { tenantId: string; influencerId: string; igMediaId: string; creatorToken: string; creatorScopes: string[] }, p: PartnershipProvider = mockPartnership) {
  assertCreatorScopes(input.creatorScopes);
  const code = await p.createCode(input.igMediaId, input.creatorToken);
  return prisma.partnershipAdCode.upsert({
    where: { tenantId_igMediaId: { tenantId: input.tenantId, igMediaId: input.igMediaId } },
    create: { tenantId: input.tenantId, influencerId: input.influencerId, igMediaId: input.igMediaId, adCode: code, state: "issued", lastVerifiedAt: new Date() },
    update: { adCode: code, state: "issued", lastVerifiedAt: new Date(), revokedAt: null },
  });
}

/** Lansman öncesi zorunlu yeniden doğrulama. */
export async function verifyBeforeLaunch(tenantId: string, igMediaId: string, creatorToken: string, p: PartnershipProvider = mockPartnership) {
  const row = await prisma.partnershipAdCode.findUnique({ where: { tenantId_igMediaId: { tenantId, igMediaId } } });
  if (!row?.adCode) return { ok: false as const, reason: "Partnership kodu yok." };
  const active = await p.isCodeActive(igMediaId, creatorToken);
  await prisma.partnershipAdCode.update({
    where: { id: row.id },
    data: active ? { lastVerifiedAt: new Date(), state: "verified" } : { state: "revoked", revokedAt: new Date() },
  });
  if (!active) {
    // Kod iptali: Kritik bulgu + reklamın durdurulması için admin talimatı.
    await recordRun({
      checkType: "YAYIN_KONTROL",
      targetType: "PartnershipAdCode",
      targetId: row.id,
      bucket: `iptal:${row.adCode}`,
      severity: "KRITIK",
      summary: `Creator partnership kodunu iptal etti (medya ${igMediaId}); bu koda bağlı reklam durdurulmalı.`,
      findings: { igMediaId, adCode: row.adCode },
      model: "kod",
      promptVersion: "kod@1",
    });
    await notifyAdmins("Partnership kodu iptal edildi", `Medya ${igMediaId} için kod iptal edildi; ilgili reklamı Ads Manager'dan durdurun.`, "/admin/reklam");
    return { ok: false as const, reason: "Creator partnership kodunu iptal etmiş; reklam yayınlanamaz." };
  }
  return { ok: true as const };
}

export const partnershipNotes = [
  "Zaten boost edilmiş içerik düzenlenemez ama yeniden boost edilebilir; iterasyon yeni reklam oluşturularak yapılır.",
  "İçerik branded content ise partner ücretli ortak olarak etiketlenir ve mevcut ücretli ortağın YERİNE geçer.",
  "Reklam creator'ın profilinde görünmez ama creator hesabından paylaşılmış gibi görünebilir.",
  "Aktif branded content reklamları Meta Ad Library'de herkese açık listelenir.",
];
