import { z } from "zod";
import { completeMultipart } from "@infulancer/core/storage/s3";
import { requireApiActor } from "@/lib/auth-guard";
import { errorResponse, finalizeAsset, loadPendingAsset, readJson } from "@/lib/uploads";

export const runtime = "nodejs";

const schema = z.object({
  assetId: z.string().min(1).max(64),
  uploadId: z.string().min(1).max(1024),
  parts: z
    .array(z.object({ partNumber: z.number().int().min(1).max(10_000), etag: z.string().min(1).max(200) }))
    .min(1)
    .max(10_000),
});

/** POST {assetId, uploadId, parts[]} → multipart'ı birleştirir ve yüklemeyi tamamlar. */
export async function POST(req: Request) {
  const auth = await requireApiActor();
  if (auth.response) return auth.response;
  try {
    const body = await readJson(req, schema);
    const asset = await loadPendingAsset(auth.actor, body.assetId);
    await completeMultipart(asset.key, body.uploadId, body.parts);
    const { asset: done, status } = await finalizeAsset(auth.actor, asset.id);
    return Response.json({ assetId: done.id, fileName: done.fileName, deliverableStatus: status }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return errorResponse(err);
  }
}
