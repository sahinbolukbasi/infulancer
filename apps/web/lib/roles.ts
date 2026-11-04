import type { Role } from "@infulancer/core/enums";

/** Her rolün ana sayfası. Proxy ve sunucu korumaları buradan okur. */
export const roleHome: Record<Role, string> = {
  ADMIN: "/admin",
  AGENCY: "/admin",
  BRAND: "/marka",
  INFLUENCER: "/influencer",
};

/** Yol önekinin gerektirdiği rol (yoksa null: rol serbest). */
export function requiredRoleForPath(pathname: string): Role | null {
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return "ADMIN";
  if (pathname === "/marka" || pathname.startsWith("/marka/")) return "BRAND";
  if (pathname === "/influencer" || pathname.startsWith("/influencer/")) return "INFLUENCER";
  return null;
}

/** Ajans çalışanının (AGENCY) giremeyeceği yönetici ekranları. */
export const ADMIN_ONLY_PREFIXES = ["/admin/kullanicilar", "/admin/yetkiler", "/admin/tanitim", "/admin/finans", "/api/finans"];
export function isAdminOnlyPath(pathname: string): boolean {
  return ADMIN_ONLY_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}
/** Açık yönlendirme (open redirect) engeli: yalnız uygulama içi mutlak yollar. */
export function safeNextPath(next: unknown): string | null {
  if (typeof next !== "string") return null;
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return null;
  return next;
}
