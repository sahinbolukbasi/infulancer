import { MULTIPART_THRESHOLD_BYTES, presignPut, presignTtlSeconds } from "@infulancer/core/storage/s3";
import { requireApiActor } from "@/lib/auth-guard";
import { errorResponse, jsonError, prepareAsset, readJson, uploadRequestSchema } from "@/lib/uploads";

export const runtime = "nodejs";

/** POST {target, kind, fileName, mime, size} → presigned PUT (15 dk). 50 MB üstü multipart ile. */
export async function POST(req: Request) {
  const auth = await requireApiActor();
  if (auth.response) return auth.response;
  try {
    const body = await readJson(req, uploadRequestSchema);
    if (body.size > MULTIPART_THRESHOLD_BYTES) {
      return jsonError(400, "50 MB üzeri dosyalar parçalı (multipart) yüklenmelidir.");
    }
    const asset = await prepareAsset(auth.actor, body);
    const url = await presignPut(asset.key, asset.mime);
    return Response.json(
      { assetId: asset.id, url, method: "PUT", headers: { "Content-Type": asset.mime }, expiresIn: presignTtlSeconds() },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    return errorResponse(err);
  }
}
