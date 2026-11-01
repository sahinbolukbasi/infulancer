import { cache } from "react";
import { redirect } from "next/navigation";
import type { Actor } from "@infulancer/core/access/actor";
import type { Role } from "@infulancer/core/enums";
import { auth } from "@/auth";
import { roleHome } from "./roles";

/** Oturumdaki kullanıcıyı core Actor'a çevirir; oturum yoksa null. */
export const getActor = cache(async (): Promise<Actor | null> => {
  const session = await auth();
  const user = session?.user;
  if (!user?.id || !user.role) return null;
  return {
    userId: user.id,
    role: user.role,
    brandId: user.brandId ?? null,
    influencerId: user.influencerId ?? null,
  };
});

export const getSessionUser = cache(async () => (await auth())?.user ?? null);

/**
 * Server Component ve Server Action'lar için: oturum yoksa /giris'e,
 * rol uymuyorsa kendi ana sayfasına yönlendirir.
 */
export async function requireActor(...roles: Role[]): Promise<Actor> {
  const actor = await getActor();
  if (!actor) redirect("/giris");
  if (roles.length > 0 && !roles.includes(actor.role)) redirect(roleHome[actor.role]);
  if (actor.role === "BRAND" && !actor.brandId) redirect("/giris");
  if (actor.role === "INFLUENCER" && !actor.influencerId) redirect("/giris");
  return actor;
}

/** Route Handler'lar için: yetkisizse 401/403 Response döner. */
export async function requireApiActor(
  ...roles: Role[]
): Promise<{ actor: Actor; response?: never } | { actor?: never; response: Response }> {
  const actor = await getActor();
  if (!actor) {
    return { response: Response.json({ error: "Oturum açmanız gerekiyor." }, { status: 401 }) };
  }
  if (roles.length > 0 && !roles.includes(actor.role)) {
    return { response: Response.json({ error: "Bu işlem için yetkiniz yok." }, { status: 403 }) };
  }
  return { actor };
}
