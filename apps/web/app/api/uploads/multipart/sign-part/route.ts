import { z } from "zod";
import { MULTIPART_PART_BYTES, presignPart, presignTtlSeconds } from "@infulancer/core/storage/s3";
import { requireApiActor } from "@/lib/auth-guard";
import { errorResponse, jsonError, loadPendingAsset, readJson } from "@/lib/uploads";

export const runtime = "nodejs";

const schema = z.object({
  assetId: z.string().min(1).max(64),
  uploadId: z.string().min(1).max(1024),
  partNumber: z.number().int().min(1).max(10_000),
});

/** POST {assetId, uploadId, partNumber} → presigned UploadPart URL. */
export async function POST(req: Request) {
  const auth = await requireApiActor();
  if (auth.response) return auth.response;
  try {
    const body = await readJson(req, schema);
    const asset = await loadPendingAsset(auth.actor, body.assetId);
    if (body.partNumber > Math.ceil(asset.size / MULTIPART_PART_BYTES)) return jsonError(400, "Parça numarası geçersiz.");
    const url = await presignPart(asset.key, body.uploadId, body.partNumber);
    return Response.json({ url, expiresIn: presignTtlSeconds() }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return errorResponse(err);
  }
}
