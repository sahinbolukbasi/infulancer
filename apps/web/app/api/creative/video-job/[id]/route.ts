import { prisma } from "@infulancer/core/db";
import { processVideoQueue } from "@infulancer/core/creative/video-edit";
import { requireApiActor } from "@/lib/auth-guard";
import { ownTenantOrNull } from "@/lib/creative-tenant";
import { jsonError } from "@/lib/uploads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Video düzenleme işinin durumu (tarayıcı birkaç saniyede bir sorar; kuyruğu da dürter). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiActor("ADMIN", "BRAND", "INFLUENCER");
  if (auth.response) return auth.response;
  const { id } = await params;
  const job = await prisma.videoEditJob.findUnique({ where: { id } });
  const own = ownTenantOrNull(auth.actor);
  if (!job || (own !== null && job.tenantId !== own)) return jsonError(404, "Bulunamadı.");
  if (job.status === "QUEUED") void processVideoQueue();
  return Response.json({ status: job.status, error: job.error, outputUploadId: job.outputUploadId }, { headers: { "Cache-Control": "no-store" } });
}
