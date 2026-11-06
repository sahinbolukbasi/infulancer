import type { Role } from "../enums";
/**
 * Sayfa görünürlüğü — SAF mantık (DB yok, istemcide de çalışır).
 * DB erişimi için ayrı page-permissions.ts kullanılır.
 */
export type ScopeType = "ROLE" | "USER";
export type PagePermissionRow = {
  id: string;
  scopeType: string;
  scopeId: string;
  pathPrefix: string;
  allowed: boolean;
};

/**
 * Daraltıcı izin katmanı. Koddaki rol kuralları her zaman üstte kalır; bu yalnız
 * görünür alanı daraltır veya kişiye özel istisnayı geri açar.
 * Çözüm sırası: en uzun (en belirgin) önek, eşitlikte USER kuralı ROLE'den önce.
 */
export function isPathHidden(rows: PagePermissionRow[], role: Role, userId: string | null, pathname: string): boolean {
  const matches = rows.filter((r) => pathname === r.pathPrefix || pathname.startsWith(`${r.pathPrefix}/`));
  if (!matches.length) return false;
  matches.sort((a, b) => b.pathPrefix.length - a.pathPrefix.length || (a.scopeType === "USER" ? -1 : 1));
  for (const r of matches) {
    if (r.scopeType === "USER" && r.scopeId === userId) return !r.allowed;
    if (r.scopeType === "ROLE" && r.scopeId === role) {
      const userException = matches.find((m) => m.scopeType === "USER" && m.scopeId === userId && m.pathPrefix === r.pathPrefix);
      if (userException) return !userException.allowed;
      return !r.allowed;
    }
  }
  return false;
}
