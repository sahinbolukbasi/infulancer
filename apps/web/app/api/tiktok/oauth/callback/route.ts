import { timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { prisma } from "@infulancer/core/db";
import { vault } from "@infulancer/core/channels/vault";
import { syncSocialAccount } from "@infulancer/core/social/sync";
import { requireApiActor } from "@/lib/auth-guard";

export const runtime = "nodejs";

/** TikTok OAuth geri dönüşü: state doğrula → kodu token'a çevir → token kasaya → hesabı bağla ve senkronla. */
export async function GET(req: Request) {
  const guard = await requireApiActor("INFLUENCER");
  if (guard.response) return guard.response;
  const actor = guard.actor;
  const appUrl = process.env.APP_URL ?? new URL(req.url).origin;
  const back = (r: string) => Response.redirect(`${appUrl}/influencer/hesaplar?tiktok=${r}`, 302);
  const u = new URL(req.url);
  const code = u.searchParams.get("code");
  const state = u.searchParams.get("state") ?? "";
  const jar = await cookies();
  const expected = jar.get("tt_oauth_state")?.value ?? "";
  jar.delete({ name: "tt_oauth_state", path: "/api/tiktok/oauth" });
  if (!code || !expected || state.length !== expected.length || !timingSafeEqual(Buffer.from(state), Buffer.from(expected))) return back("hata");
  const res = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_key: process.env.TIKTOK_CLIENT_KEY ?? "",
      client_secret: process.env.TIKTOK_CLIENT_SECRET ?? "",
      code,
      grant_type: "authorization_code",
      redirect_uri: `${appUrl}/api/tiktok/oauth/callback`,
    }),
    signal: AbortSignal.timeout(15_000),
  }).catch(() => null);
  const json = (await res?.json().catch(() => null)) as { access_token?: string; open_id?: string } | null;
  if (!res?.ok || !json?.access_token) return back("hata");
  const influencerId = actor.influencerId!;
  const tokenRef = await vault().put(`inf_${influencerId}`, "tiktok", json.access_token);
  const existing = await prisma.socialAccount.findUnique({ where: { influencerId_platform: { influencerId, platform: "TIKTOK" } } });
  const acc = existing
    ? await prisma.socialAccount.update({ where: { id: existing.id }, data: { tokenRef, externalId: json.open_id ?? null, syncSource: "tiktok_oauth" } })
    : await prisma.socialAccount.create({
        data: { influencerId, platform: "TIKTOK", handle: "@tiktok", followers: 0, engagementRate: 0, demographics: {}, tokenRef, externalId: json.open_id ?? null, syncSource: "tiktok_oauth" },
      });
  await syncSocialAccount(acc.id);
  return back("baglandi");
}
