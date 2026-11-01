import type { Role } from "@infulancer/core/enums";

/** Her rolün ana sayfası. Proxy ve sunucu korumaları buradan okur. */
export const roleHome: Record<Role, string> = {
  ADMIN: "/admin",
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

/** Açık yönlendirme (open redirect) engeli: yalnız uygulama içi mutlak yollar. */
export function safeNextPath(next: unknown): string | null {
  if (typeof next !== "string") return null;
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return null;
  return next;
}
