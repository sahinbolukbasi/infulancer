import { z } from "zod";
import { prisma } from "@infulancer/core/db";
import { abortMultipart } from "@infulancer/core/storage/s3";
import { requireApiActor } from "@/lib/auth-guard";
import { errorResponse, loadPendingAsset, readJson } from "@/lib/uploads";

export const runtime = "nodejs";

const schema = z.object({ assetId: z.string().min(1).max(64), uploadId: z.string().min(1).max(1024) });

/** POST {assetId, uploadId} → multipart iptal; bekleyen Asset satırı silinir. */
export async function POST(req: Request) {
  const auth = await requireApiActor();
  if (auth.response) return auth.response;
  try {
    const body = await readJson(req, schema);
    const asset = await loadPendingAsset(auth.actor, body.assetId);
    await abortMultipart(asset.key, body.uploadId).catch((err) => console.warn("[uploads] abort", err));
    await prisma.asset.delete({ where: { id: asset.id } });
    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return errorResponse(err);
  }
}
