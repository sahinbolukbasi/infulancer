import { presignAvatarGet } from "@infulancer/core/storage/s3";
import { requireApiActor } from "@/lib/auth-guard";

export const runtime = "nodejs";
/** Avatarı imzalı URL'e yönlendirir (bucket herkese açık değil). Giriş gerektirir. */
export async function GET(_req: Request, { params }: { params: Promise<{ key: string }> }) {
  const auth = await requireApiActor();
  if (auth.response) return auth.response;
  const { key } = await params;
  if (!/^[a-f0-9-]+\.(jpg|png|webp)$/.test(key)) return new Response("Bulunamadı", { status: 404 });
  const url = await presignAvatarGet(`avatars/${key}`);
  return Response.redirect(url, 307);
}
