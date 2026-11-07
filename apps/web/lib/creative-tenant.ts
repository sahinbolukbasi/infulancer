import { prisma } from "@infulancer/core/db";
import type { Actor } from "@infulancer/core/access/actor";
import { DomainError } from "@infulancer/core/domain/errors";

/**
 * Creative stüdyosunda işlemin hangi hesaba (marka/influencer) ait olduğu.
 * Marka ve influencer yalnız kendi hesabında çalışır; yönetici seçtiği hesapta.
 */
export async function creativeTenantFor(actor: Actor, requested?: string | null): Promise<string> {
  if (actor.role === "BRAND") return actor.brandId!;
  if (actor.role === "INFLUENCER") return actor.influencerId!;
  const id = (requested ?? "").trim();
  if (!id) throw new DomainError("DOGRULAMA", "Kimin adına çalışacağınızı seçin.");
  const [b, i] = await Promise.all([
    prisma.brand.findUnique({ where: { id }, select: { id: true } }),
    prisma.influencer.findUnique({ where: { id }, select: { id: true } }),
  ]);
  if (!b && !i) throw new DomainError("BULUNAMADI", "Marka veya influencer bulunamadı.");
  return id;
}

/** Yöneticiyse tenant filtresi yok (null), değilse kendi tenant'ı. */
export function ownTenantOrNull(actor: Actor): string | null {
  if (actor.role === "BRAND") return actor.brandId!;
  if (actor.role === "INFLUENCER") return actor.influencerId!;
  return null;
}
