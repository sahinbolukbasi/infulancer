"use server";
import { cookies } from "next/headers";
import { prisma } from "@infulancer/core/db";
import { isLocale, isRegion } from "@infulancer/core/i18n/regions";
import { auth } from "@/auth";
import type { ActionState } from "@/lib/action-state";
import { revalidateAll, str } from "@/lib/action-utils";
import { COUNTRY_COOKIE, LOCALE_COOKIE } from "@/lib/i18n/server";

/** Dil ve ülke tercihini kaydeder (çerez + girişliyse hesap). Ülke para birimini belirler. */
export async function setRegionAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const locale = str(fd, "locale");
  const country = str(fd, "country").toUpperCase();
  if (!isLocale(locale) || !isRegion(country)) return { error: "Geçersiz dil veya ülke." };
  const jar = await cookies();
  const opts = { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production" };
  jar.set(LOCALE_COOKIE, locale, opts);
  jar.set(COUNTRY_COOKIE, country, opts);
  const session = await auth().catch(() => null);
  if (session?.user?.id) await prisma.user.update({ where: { id: session.user.id }, data: { locale, country } });
  revalidateAll();
  return { ok: true, message: "Kaydedildi." };
}
