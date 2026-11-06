import { prisma } from "../db";
import type { Role } from "../enums";
import { isPathHidden, type PagePermissionRow, type ScopeType } from "./page-visibility";
export { isPathHidden } from "./page-visibility";
export type { PagePermissionRow, ScopeType } from "./page-visibility";

/** İlgili kapsamların tüm izin kayıtlarını getirir (menü ve middleware için). */
export async function loadPagePermissions(role: Role, userId: string | null): Promise<PagePermissionRow[]> {
  const or: { scopeType: string; scopeId: string }[] = [{ scopeType: "ROLE", scopeId: role }];
  if (userId) or.push({ scopeType: "USER", scopeId: userId });
  return prisma.pagePermission.findMany({ where: { OR: or }, select: { id: true, scopeType: true, scopeId: true, pathPrefix: true, allowed: true } });
}

/** Bir yolun verilen kullanıcı/rol için gizli olup olmadığını tek sorguda döndürür. */
export async function isPathHiddenFor(role: Role, userId: string | null, pathname: string): Promise<boolean> {
  const rows = await loadPagePermissions(role, userId);
  return isPathHidden(rows, role, userId, pathname);
}

/** Yönetici: bir kapsam+yol için izni ayarlar (allowed=false gizler, true geri açar). */
export async function setPagePermission(input: { scopeType: ScopeType; scopeId: string; pathPrefix: string; allowed: boolean; updatedByUserId?: string | null }) {
  return prisma.pagePermission.upsert({
    where: { scopeType_scopeId_pathPrefix: { scopeType: input.scopeType, scopeId: input.scopeId, pathPrefix: input.pathPrefix } },
    create: { scopeType: input.scopeType, scopeId: input.scopeId, pathPrefix: input.pathPrefix, allowed: input.allowed, updatedByUserId: input.updatedByUserId ?? null },
    update: { allowed: input.allowed, updatedByUserId: input.updatedByUserId ?? null },
  });
}

/** Yönetici: bir izin kaydını siler (yola varsayılan=görünür davranışına döner). */
export async function clearPagePermission(scopeType: ScopeType, scopeId: string, pathPrefix: string) {
  await prisma.pagePermission.deleteMany({ where: { scopeType, scopeId, pathPrefix } });
}
