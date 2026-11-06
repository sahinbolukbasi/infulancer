import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { Actor } from "@infulancer/core/access/actor";
import type { Role } from "@infulancer/core/enums";
import { auth } from "@/auth";
import { prisma } from "@infulancer/core/db";
import { DomainError } from "@infulancer/core/domain/errors";
import { isPathHiddenFor } from "@infulancer/core/access/page-permissions";
import { roleHome } from "./roles";

/** Oturumdaki kullanıcıyı core Actor'a çevirir; oturum yoksa null. */
export const getActor = cache(async (): Promise<Actor | null> => {
  const session = await auth();
  const user = session?.user;
  if (!user?.id || !user.role) return null;
  // Ajans çalışanı (AGENCY) operasyon ekranlarında ADMIN yetkisiyle çalışır; asıl rol staffRole'da.
  return {
    userId: user.id,
    role: user.role === "AGENCY" ? "ADMIN" : user.role,
    staffRole: user.role === "AGENCY" ? "AGENCY" : undefined,
    brandId: user.brandId ?? null,
    influencerId: user.influencerId ?? null,
  };
});

export const getSessionUser = cache(async () => (await auth())?.user ?? null);

/** Üyelik durumu her istekte veritabanından okunur (JWT'deki durum onaydan sonra eskiyebilir). */
export const getUserStatus = cache(async (userId: string) => {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { status: true, brandId: true, influencerId: true } });
  return u;
});

/**
 * Server Component ve Server Action'lar için: oturum yoksa /giris'e,
 * rol uymuyorsa kendi ana sayfasına yönlendirir.
 */
export async function requireActor(...roles: Role[]): Promise<Actor> {
  const sessionActor = await getActor();
  if (!sessionActor) redirect("/giris");
  const st = await getUserStatus(sessionActor.userId);
  if (!st) redirect("/giris");
  if (st.status !== "ACTIVE") redirect("/onay-bekliyor");
  // Onay sonrası profil bağları JWT'de olmayabilir; veritabanındaki değerler esas alınır.
  const actor: Actor = { ...sessionActor, brandId: st.brandId, influencerId: st.influencerId };
  if (roles.length > 0 && !roles.includes(actor.role)) redirect(roleHome[actor.role]);
  if (actor.role === "BRAND" && !actor.brandId) redirect("/giris");
  if (actor.role === "INFLUENCER" && !actor.influencerId) redirect("/giris");
  await assertPageVisible(actor);
  return actor;
}
/**
 * Yöneticinin ayarladığı sayfa görünürlük katmanı (daraltıcı). Middleware "x-pathname"
 * başlığını yazar; yol bu kullanıcı/rol için gizliyse kendi ana sayfasına yönlendirilir.
 * Koddaki rol kuralları zaten üstte uygulandığı için bu yalnız ek daraltmadır.
 */
async function assertPageVisible(actor: Actor): Promise<void> {
  const pathname = (await headers()).get("x-pathname");
  if (!pathname) return;
  if (await isPathHiddenFor(actor.role, actor.userId, pathname)) redirect(`${roleHome[actor.role]}?erisim=kapali`);
}

/** Yalnız platform yöneticisi (ADMIN): kullanıcılar, yetkiler, finans, tanıtım içeriği. Ajans çalışanı panel ana sayfasına döner. */
export async function requireAdmin(): Promise<Actor> {
  const actor = await requireActor("ADMIN");
  if (actor.staffRole) redirect("/admin?yetki=yok");
  return actor;
}
/** Server Action'larda: ajans çalışanını reddeder. */
export function assertPlatformAdmin(actor: Actor): void {
  if (actor.staffRole) throw new DomainError("YETKISIZ", "Bu işlem yalnız platform yöneticisine açık.");
}
/** Route Handler'lar için: yetkisizse 401/403 Response döner. */
export async function requireApiActor(
  ...roles: Role[]
): Promise<{ actor: Actor; response?: never } | { actor?: never; response: Response }> {
  const sessionActor = await getActor();
  if (!sessionActor) {
    return { response: Response.json({ error: "Oturum açmanız gerekiyor." }, { status: 401 }) };
  }
  const st = await getUserStatus(sessionActor.userId);
  if (!st || st.status !== "ACTIVE") {
    return { response: Response.json({ error: "Üyeliğiniz onay bekliyor." }, { status: 403 }) };
  }
  const actor: Actor = { ...sessionActor, brandId: st.brandId, influencerId: st.influencerId };
  if (roles.length > 0 && !roles.includes(actor.role)) {
    return { response: Response.json({ error: "Bu işlem için yetkiniz yok." }, { status: 403 }) };
  }
  return { actor };
}
