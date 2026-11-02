import { z } from "zod";
import { requireApiActor } from "@/lib/auth-guard";
import { errorResponse, finalizeAsset, readJson } from "@/lib/uploads";

export const runtime = "nodejs";

const schema = z.object({ assetId: z.string().min(1).max(64) });

/** POST {assetId} — tek parça yükleme bitti: doğrula, TAMAM işaretle, olay yayınla. */
export async function POST(req: Request) {
  const auth = await requireApiActor();
  if (auth.response) return auth.response;
  try {
    const { assetId } = await readJson(req, schema);
    const { asset, status } = await finalizeAsset(auth.actor, assetId);
    return Response.json({ assetId: asset.id, fileName: asset.fileName, deliverableStatus: status }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return errorResponse(err);
  }
}
