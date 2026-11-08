import type { Role } from "@infulancer/core/enums";
/** Sihirbaz adres kökü: marka kendi alanında, ajans yönetim panelinde. */
export function wizardBase(role: Role, id: string): string {
  return role === "BRAND" ? `/marka/kampanyalar/${id}/olustur` : `/admin/kampanyalar/${id}/olustur`;
}
export function wizardNewPath(role: Role): string {
  return role === "BRAND" ? "/marka/kampanyalar/yeni" : "/admin/kampanyalar/yeni";
}
