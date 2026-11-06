import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "./auth.config";
import { isAdminOnlyPath, requiredRoleForPath, roleHome } from "./lib/roles";

const { auth } = NextAuth(authConfig);
const PUBLIC_PATHS = new Set(["/gizlilik", "/kullanim-kosullari", "/kvkk", "/cerez-politikasi", "/destek"]);
/** Tanıtım sayfası: ziyaretçiye açık; girişli kullanıcıyı sayfa kendi rol ana sayfasına yönlendirir. */
const LANDING = "/";

/**
 * Oturum ve rol öneki kontrolü. Herkese açık: /giris, /api/auth/*, yasal sayfalar (/gizlilik,
 * /kullanim-kosullari — App Review için girişsiz erişilebilir olmalı), /kvkk, /cerez-politikasi ve imzayla
 * doğrulanan webhook uçları (/api/webhooks/*).
 * Her sayfa/aksiyon ayrıca lib/auth-guard ile rolü yeniden doğrular (derinlemesine savunma).
 */
function withPath(res: NextResponse, pathname: string): NextResponse {
  res.headers.set("x-pathname", pathname);
  return res;
}
export default auth((req) => {
  const { pathname, search } = req.nextUrl;
  const user = req.auth?.user;

  if (PUBLIC_PATHS.has(pathname) || pathname.startsWith("/api/webhooks/")) return NextResponse.next();
  // Herkese açık bilet/kupon kartları ve görsel uçları (davetlilere gönderilen bağlantılar).
  if (pathname.startsWith("/bilet/") || pathname.startsWith("/kupon/") || pathname.startsWith("/etkinlik/") || pathname.startsWith("/api/media/") || pathname.startsWith("/api/bilet/") || pathname.startsWith("/api/kupon/") || pathname.startsWith("/api/etkinlik/") || pathname.startsWith("/api/wallet/") || pathname.startsWith("/l/") || pathname.startsWith("/brand/") || pathname === "/opengraph-image" || pathname === "/icon.svg" || pathname === "/apple-icon") return NextResponse.next();
  if (pathname === LANDING && !user?.role) return NextResponse.next();
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
  // Ajans çalışanı /admin ekranlarını kullanır, yalnız yönetici ekranlarına giremez.
  const effective = user.role === "AGENCY" ? "ADMIN" : user.role;
  if (user.role === "AGENCY" && isAdminOnlyPath(pathname)) {
    if (pathname.startsWith("/api/")) return NextResponse.json({ error: "Bu işlem için yetkiniz yok." }, { status: 403 });
    return NextResponse.redirect(new URL("/admin?yetki=yok", req.nextUrl));
  }
  if (required && required !== effective) {
    return NextResponse.redirect(new URL(roleHome[user.role], req.nextUrl));
  }
  return withPath(NextResponse.next(), pathname);
});

export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|ico|webp|mp4|webm)$).*)"],
};
