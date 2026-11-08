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
