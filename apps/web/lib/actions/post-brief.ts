"use server";
import { prisma } from "@infulancer/core/db";
import { generatePost, generateBrief, type BriefDraft, type PostDraft } from "@infulancer/core/creative/post-brief";
import { DomainError } from "@infulancer/core/domain/errors";
import type { ActionState } from "@/lib/action-state";
import { str, toErrorState } from "@/lib/action-utils";
import { requireActor } from "@/lib/auth-guard";

export type PostBriefState = ActionState & { post?: PostDraft; brief?: BriefDraft };

type CreativeActor = Awaited<ReturnType<typeof requireActor>>;
/** Varlığın istemini döndürür; marka/influencer yalnız kendi varlığını kullanabilir. */
async function promptForAsset(actor: CreativeActor, assetId: string, fallback: string): Promise<{ prompt: string; brandName?: string }> {
  const asset = await prisma.generatedAsset.findUnique({ where: { id: assetId }, select: { tenantId: true, jobId: true } });
  const own = actor.role === "ADMIN" || asset?.tenantId === (actor.role === "BRAND" ? actor.brandId : actor.influencerId);
  if (!asset || !own) throw new DomainError("BULUNAMADI", "Görsel bulunamadı.");
  const job = asset.jobId ? await prisma.creativeJob.findUnique({ where: { id: asset.jobId }, select: { prompt: true } }) : null;
  const [brand, inf] = await Promise.all([
    prisma.brand.findUnique({ where: { id: asset.tenantId }, select: { name: true } }),
    prisma.influencer.findUnique({ where: { id: asset.tenantId }, select: { name: true } }),
  ]);
  return { prompt: job?.prompt ?? fallback, brandName: brand?.name ?? inf?.name };
}

/** Üretilen görselden (veya serbest istemden) post metni üretir. */
export async function generatePostAction(_p: PostBriefState, fd: FormData): Promise<PostBriefState> {
  const actor = await requireActor("ADMIN", "BRAND", "INFLUENCER");
  try {
    const assetId = str(fd, "assetId");
    const freePrompt = str(fd, "prompt");
    const tone = (str(fd, "tone") || "samimi") as "samimi" | "profesyonel" | "enerjik";
    const base = assetId ? await promptForAsset(actor, assetId, freePrompt) : { prompt: freePrompt };
    if (!base.prompt.trim()) throw new DomainError("DOGRULAMA", "Bir görsel seçin veya konu yazın.");
    const post = await generatePost({ ...base, tone });
    return { ok: true, message: "Post metni hazır (düzenleyebilirsiniz).", post };
  } catch (e) {
    return toErrorState(e);
  }
}

/** Üretilen görselden (veya serbest istemden) kampanya brief taslağı üretir. */
export async function generateBriefAction(_p: PostBriefState, fd: FormData): Promise<PostBriefState> {
  const actor = await requireActor("ADMIN", "BRAND", "INFLUENCER");
  try {
    const assetId = str(fd, "assetId");
    const freePrompt = str(fd, "prompt");
    const goal = str(fd, "goal") || undefined;
    const base = assetId ? await promptForAsset(actor, assetId, freePrompt) : { prompt: freePrompt };
    if (!base.prompt.trim()) throw new DomainError("DOGRULAMA", "Bir görsel seçin veya konu yazın.");
    const brief = await generateBrief({ ...base, goal });
    return { ok: true, message: "Brief taslağı hazır (düzenleyebilirsiniz).", brief };
  } catch (e) {
    return toErrorState(e);
  }
}
