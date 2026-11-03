import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { requireApiActor } from "@/lib/auth-guard";

export const runtime = "nodejs";

/**
 * TikTok Login Kit — influencer kendi hesabını bağlar (takipçi/video verisi için tek resmî yol).
 * TIKTOK_CLIENT_KEY tanımlı değilse kullanıcıyı açıklamayla geri gönderir.
 */
export async function GET(req: Request) {
  const guard = await requireApiActor("INFLUENCER");
  if (guard.response) return guard.response;
  const appUrl = process.env.APP_URL ?? new URL(req.url).origin;
  const clientKey = process.env.TIKTOK_CLIENT_KEY;
  if (!clientKey) return Response.redirect(`${appUrl}/influencer/hesaplar?tiktok=yapilandirilmadi`, 302);
  const state = randomBytes(24).toString("hex");
  (await cookies()).set("tt_oauth_state", state, { httpOnly: true, secure: appUrl.startsWith("https"), sameSite: "lax", path: "/api/tiktok/oauth", maxAge: 600 });
  const q = new URLSearchParams({
    client_key: clientKey,
    scope: "user.info.basic,user.info.stats,video.list",
    response_type: "code",
    redirect_uri: `${appUrl}/api/tiktok/oauth/callback`,
    state,
  });
  return Response.redirect(`https://www.tiktok.com/v2/auth/authorize/?${q}`, 302);
}
