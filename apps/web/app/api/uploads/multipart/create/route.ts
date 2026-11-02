import { prisma } from "@infulancer/core/db";
import { createMultipart, MULTIPART_PART_BYTES, MULTIPART_THRESHOLD_BYTES } from "@infulancer/core/storage/s3";
import { requireApiActor } from "@/lib/auth-guard";
import { errorResponse, jsonError, prepareAsset, readJson, uploadRequestSchema } from "@/lib/uploads";

export const runtime = "nodejs";

/** POST {target, kind, fileName, mime, size} → {assetId, uploadId, partSize, partCount} (10 MB parçalar). */
export async function POST(req: Request) {
  const auth = await requireApiActor();
  if (auth.response) return auth.response;
  try {
    const body = await readJson(req, uploadRequestSchema);
    if (body.size <= MULTIPART_THRESHOLD_BYTES) return jsonError(400, "50 MB ve altı dosyalar tek parça yüklenir.");
    const asset = await prepareAsset(auth.actor, body);
    try {
      const uploadId = await createMultipart(asset.key, asset.mime);
      return Response.json(
        {
          assetId: asset.id,
          uploadId,
          partSize: MULTIPART_PART_BYTES,
          partCount: Math.ceil(asset.size / MULTIPART_PART_BYTES),
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    } catch (err) {
      await prisma.asset.delete({ where: { id: asset.id } }).catch(() => undefined);
      throw err;
    }
  } catch (err) {
    return errorResponse(err);
  }
}
