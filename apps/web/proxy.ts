import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "./auth.config";
import { requiredRoleForPath, roleHome } from "./lib/roles";

const { auth } = NextAuth(authConfig);

/**
 * Oturum ve rol öneki kontrolü. Yalnız /giris ve /api/auth/* herkese açıktır.
 * Her sayfa/aksiyon ayrıca lib/auth-guard ile rolü yeniden doğrular (derinlemesine savunma).
 */
export default auth((req) => {
  const { pathname, search } = req.nextUrl;
  const user = req.auth?.user;

  if (pathname === "/giris") {
    if (user?.role) return NextResponse.redirect(new URL(roleHome[user.role], req.nextUrl));
    return NextResponse.next();
  }

  if (!user?.role) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Oturum açmanız gerekiyor." }, { status: 401 });
    }
    const url = new URL("/giris", req.nextUrl);
    if (pathname !== "/") url.searchParams.set("next", pathname + search);
    return NextResponse.redirect(url);
  }

  const required = requiredRoleForPath(pathname);
  if (required && required !== user.role) {
    return NextResponse.redirect(new URL(roleHome[user.role], req.nextUrl));
  }
  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|ico|webp)$).*)"],
};
