/**
 * Creative hesabı (bakiye, kitaplık, galeri) kime aittir:
 *  - Marka kullanıcıları → markanın hesabı (brandId)
 *  - Influencer → kendi hesabı (influencerId)
 *  - Ajans/yönetici → ajansın kendi hesabı (AGENCY_TENANT)
 * Her işlem yalnız işlemi yapanın hesabından düşer; ajans başka hesabın bakiyesini harcamaz.
 */
export const AGENCY_TENANT = "ajans";
export function isAgencyTenant(id: string): boolean {
  return id === AGENCY_TENANT;
}

/** Creative hesabının para birimi: marka/influencer kayıtlı ülkesinin para birimi; ajans TRY. */
export async function tenantCurrency(tenantId: string): Promise<string> {
  if (isAgencyTenant(tenantId)) return "TRY";
  const { prisma } = await import("../db");
  const { currencyOf } = await import("../i18n/regions");
  const acc = await prisma.creditAccount.findUnique({ where: { tenantId }, select: { currency: true } });
  if (acc) return acc.currency;
  const [b, i] = await Promise.all([
    prisma.brand.findUnique({ where: { id: tenantId }, select: { country: true } }),
    prisma.influencer.findUnique({ where: { id: tenantId }, select: { country: true } }),
  ]);
  return currencyOf(b?.country ?? i?.country ?? "TR");
}
