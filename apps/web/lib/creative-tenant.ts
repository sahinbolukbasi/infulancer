import type { Actor } from "@infulancer/core/access/actor";
import { AGENCY_TENANT } from "@infulancer/core/creative/tenant";
/**
 * Creative işleminin hangi hesaba (bakiye + kitaplık) ait olduğu. Her kullanıcı yalnız kendi
 * hesabında çalışır: marka → marka hesabı, influencer → kendi hesabı, ajans → ajans hesabı.
 * İstemciden gelen hesap kimliği yok sayılır (başka hesabın bakiyesi harcanamaz).
 */
export async function creativeTenantFor(actor: Actor): Promise<string> {
  return ownTenant(actor);
}
export function ownTenant(actor: Actor): string {
  if (actor.role === "BRAND") return actor.brandId!;
  if (actor.role === "INFLUENCER") return actor.influencerId!;
  return AGENCY_TENANT;
}
/** Yöneticiyse tenant filtresi yok (null; dosya görüntüleme/destek için), değilse kendi tenant'ı. */
export function ownTenantOrNull(actor: Actor): string | null {
  if (actor.role === "BRAND") return actor.brandId!;
  if (actor.role === "INFLUENCER") return actor.influencerId!;
  return null;
}
