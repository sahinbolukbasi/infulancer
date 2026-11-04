import type { Role } from "../generated/prisma/enums";
import { DomainError } from "../domain/errors";

/** Oturumdan türetilen işlem yapan kişi. */
export type Actor = {
  userId: string;
  role: Role;
  brandId?: string | null;
  influencerId?: string | null;
  /** AGENCY kullanıcıları core'da ADMIN yetkisiyle çalışır; asıl rol denetim kaydı ve kısıtlı ekranlar için burada. */
  staffRole?: "AGENCY";
};

/** Agent/zamanlanmış işler için audit aktörü (kullanıcı değildir). */
export const SYSTEM_AUDIT_ACTOR = { id: null, role: "SYSTEM" } as const;

export function toAuditActor(actor: Actor): { id: string; role: string } {
  return { id: actor.userId, role: actor.staffRole ?? actor.role };
}

/** Rol kontrolü; yetkisizse DomainError("YETKISIZ") fırlatır. */
export function requireRole(actor: Actor | null | undefined, ...roles: Role[]): Actor {
  if (!actor) throw new DomainError("YETKISIZ", "Oturum açmanız gerekiyor.");
  if (roles.length > 0 && !roles.includes(actor.role)) {
    throw new DomainError("YETKISIZ", "Bu işlem için yetkiniz yok.");
  }
  if (actor.role === "BRAND" && !actor.brandId) {
    throw new DomainError("YETKISIZ", "Marka hesabı bir markaya bağlı değil.");
  }
  if (actor.role === "INFLUENCER" && !actor.influencerId) {
    throw new DomainError("YETKISIZ", "Influencer hesabı bir profile bağlı değil.");
  }
  return actor;
}
