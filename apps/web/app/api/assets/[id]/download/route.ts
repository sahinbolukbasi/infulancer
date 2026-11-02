import { prisma } from "@infulancer/core/db";
import { presignGet } from "@infulancer/core/storage/s3";
import { requireApiActor } from "@/lib/auth-guard";
import { jsonError } from "@/lib/uploads";

export const runtime = "nodejs";

/**
 * GET → yetki kontrolü, ardından 15 dk geçerli presigned GET'e 302.
 * Dosya baytları uygulamadan geçmez (proxy yok).
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiActor();
  if (auth.response) return auth.response;
  const { actor } = auth;
  const { id } = await params;
  if (!id || id.length > 64) return jsonError(404, "Dosya bulunamadı.");

  const asset = await prisma.asset.findUnique({
    where: { id },
    select: {
      key: true,
      fileName: true,
      uploadStatus: true,
      direction: true,
      campaign: { select: { id: true, brandId: true } },
      deliverable: {
        select: { assignment: { select: { influencerId: true, campaignId: true, campaign: { select: { brandId: true } } } } },
      },
    },
  });
  if (!asset || asset.uploadStatus !== "TAMAM") return jsonError(404, "Dosya bulunamadı.");

  let allowed = actor.role === "ADMIN";
  if (actor.role === "BRAND") {
    const brandId = asset.campaign?.brandId ?? asset.deliverable?.assignment.campaign.brandId;
    allowed = !!actor.brandId && brandId === actor.brandId;
  } else if (actor.role === "INFLUENCER") {
    if (asset.deliverable) {
      allowed = asset.deliverable.assignment.influencerId === actor.influencerId;
    } else if (asset.campaign && asset.direction === "AJANS_TO_INFLUENCER") {
      const own = await prisma.assignment.findFirst({
        where: { campaignId: asset.campaign.id, influencerId: actor.influencerId ?? "__none__", contractStatus: { not: "RED" } },
        select: { id: true },
      });
      allowed = !!own;
    }
  }
  // Varlık sızdırmamak için yetkisiz erişim de 404.
  if (!allowed) return jsonError(404, "Dosya bulunamadı.");

  const url = await presignGet(asset.key, asset.fileName);
  return new Response(null, { status: 302, headers: { Location: url, "Cache-Control": "no-store" } });
}
