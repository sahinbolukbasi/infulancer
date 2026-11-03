import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "./auth.config";
import { requiredRoleForPath, roleHome } from "./lib/roles";

const { auth } = NextAuth(authConfig);
const PUBLIC_PATHS = new Set(["/gizlilik", "/kullanim-kosullari", "/fiyatlandirma"]);

/**
 * Oturum ve rol öneki kontrolü. Herkese açık: /giris, /api/auth/*, yasal sayfalar (/gizlilik,
 * /kullanim-kosullari — App Review için girişsiz erişilebilir olmalı), /fiyatlandirma ve imzayla
 * doğrulanan webhook uçları (/api/webhooks/*).
 * Her sayfa/aksiyon ayrıca lib/auth-guard ile rolü yeniden doğrular (derinlemesine savunma).
 */
export default auth((req) => {
  const { pathname, search } = req.nextUrl;
  const user = req.auth?.user;

  if (PUBLIC_PATHS.has(pathname) || pathname.startsWith("/api/webhooks/")) return NextResponse.next();
  const pending = !!user?.role && user.status && user.status !== "ACTIVE";
  if (pathname === "/onay-bekliyor") return user?.role ? NextResponse.next() : NextResponse.redirect(new URL("/giris", req.nextUrl));
  if (pathname === "/kayit") return user?.role ? NextResponse.redirect(new URL(pending ? "/onay-bekliyor" : roleHome[user.role], req.nextUrl)) : NextResponse.next();
  if (pathname === "/giris") {
    if (user?.role) return NextResponse.redirect(new URL(pending ? "/onay-bekliyor" : roleHome[user.role], req.nextUrl));
    return NextResponse.next();
  }
  // Onay bekleyen/reddedilen kullanıcı panele giremez (sayfa korumaları ayrıca veritabanından doğrular).
  if (pending) {
    if (pathname.startsWith("/api/")) return NextResponse.json({ error: "Üyeliğiniz onay bekliyor." }, { status: 403 });
    return NextResponse.redirect(new URL("/onay-bekliyor", req.nextUrl));
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
