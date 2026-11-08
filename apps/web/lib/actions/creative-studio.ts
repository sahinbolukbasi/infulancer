"use server";
import { prisma } from "@infulancer/core/db";
import { audit } from "@infulancer/core/audit";
import { toAuditActor } from "@infulancer/core/access/actor";
import { submitEditPipeline, type EditAction } from "@infulancer/core/creative/edit";
import { planVideoEditFromBrief } from "@infulancer/core/creative/video-brief";
import { handleFalWebhook, CreativeRejectedError } from "@infulancer/core/creative/fal";
import { InsufficientCreditsError } from "@infulancer/core/creative/credits";
import { ModelUnavailableError } from "@infulancer/core/creative/registry";
import { enqueueVideoEdit } from "@infulancer/core/creative/video-edit";
import { getOwnedUpload, importGeneratedAsset } from "@infulancer/core/creative/uploads";
import { redirect } from "next/navigation";
import { deleteObject } from "@infulancer/core/storage/s3";
import { DomainError } from "@infulancer/core/domain/errors";
import type { ActionState } from "@/lib/action-state";
import { attempt, revalidateAll, str } from "@/lib/action-utils";
import { requireActor } from "@/lib/auth-guard";
import { creativeTenantFor, ownTenantOrNull } from "@/lib/creative-tenant";

/**
 * Yüklenen görsel üzerinde ücretli AI düzenlemesi. Birden çok düzenleme seçilebilir (actions[]);
 * adımlar sırayla zincirlenir ve her adım kendi tutarını öder. İlk işin kimliği data.jobId ile döner
 * (ilerleme ekranı bunu izler).
 */
export async function imageEditAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const actor = await requireActor("ADMIN", "BRAND", "INFLUENCER");
  return attempt(async () => {
    const tenantId = await creativeTenantFor(actor);
    const actions = (fd.getAll("actions").length ? fd.getAll("actions") : [fd.get("action")]).map(String).filter(Boolean) as EditAction[];
    const prompt = str(fd, "prompt") || null;
    const videoPrompt = str(fd, "videoPrompt") || prompt;
    const seconds = Number(str(fd, "seconds") || "5");
    const portrait = str(fd, "portrait") === "on";
    let jobId = "";
    try {
      const job = await submitEditPipeline({
        tenantId,
        uploadId: str(fd, "uploadId"),
        steps: actions.map((a) => ({ action: a, prompt: a.startsWith("videoya") ? videoPrompt : prompt, seconds, portrait })),
      });
      jobId = job.id;
      // Demo (mock) modunda fal webhook'u beklenmeden sonuç simüle edilir (zincir de devam eder).
      if ((process.env.FAL_MODE ?? "mock") === "mock" && job.requestId) {
        const video = job.modelKey.includes("i2v");
        await handleFalWebhook({ request_id: job.requestId, status: "OK", payload: video ? { video: { url: "https://example.invalid/mock.mp4" } } : { image: { url: "https://example.invalid/mock.png" } } });
      }
      await audit.append({ actor: toAuditActor(actor), action: "CREATIVE_EDIT_SUBMITTED", entityType: "CreativeJob", entityId: job.id, data: { tenantId, actions } });
    } catch (e) {
      if (e instanceof CreativeRejectedError || e instanceof ModelUnavailableError || e instanceof InsufficientCreditsError) throw new DomainError("KURAL_IHLALI", e.message);
      throw e;
    }
    revalidateAll();
    return { ok: true, message: actions.length > 1 ? `${actions.length} adımlı AI düzenleme başladı.` : "AI düzenlemesi başladı.", data: { jobId } };
  });
}
/**
 * Brief ile AI video düzenleme: yazılan istek düzenleme adımlarına çevrilir (metin modeli; yoksa kural
 * çözümleyici) ve ffmpeg kuyruğuna alınır. Ücretsizdir (fal kullanılmaz).
 */
export async function videoBriefAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const actor = await requireActor("ADMIN", "BRAND", "INFLUENCER");
  return attempt(async () => {
    const tenantId = await creativeTenantFor(actor);
    const brief = str(fd, "brief");
    if (brief.length < 5) throw new DomainError("DOGRULAMA", "Videoya ne yapılsın? En az 5 karakter yazın (ör. ilk 15 saniye, story formatı, canlı renkler).");
    const upload = await getOwnedUpload(tenantId, str(fd, "uploadId"));
    const plan = await planVideoEditFromBrief(brief, upload.durationSec ?? (Number(str(fd, "duration")) || null));
    const job = await enqueueVideoEdit({ tenantId, uploadId: upload.id, ops: plan.ops });
    return { ok: true, message: `Plan: ${plan.summary.join(" · ")}`, data: { jobId: job.id, source: plan.source } };
  });
}
/** Video düzenlemeyi kuyruğa alır (ffmpeg, ücretsiz). İş kimliği data.jobId ile döner. */
export async function videoEditAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const actor = await requireActor("ADMIN", "BRAND", "INFLUENCER");
  return attempt(async () => {
    const tenantId = await creativeTenantFor(actor);
    const num = (k: string) => (str(fd, k) === "" ? null : Number(str(fd, k)));
    const job = await enqueueVideoEdit({
      tenantId,
      uploadId: str(fd, "uploadId"),
      ops: { trimStart: num("trimStart") ?? 0, trimEnd: num("trimEnd"), aspect: str(fd, "aspect") || "orijinal", speed: Number(str(fd, "speed") || "1"), mute: str(fd, "mute") === "on", look: str(fd, "look") || "orijinal", fade: str(fd, "fade") === "on" },
    });
    return { ok: true, message: "Video işleniyor…", data: { jobId: job.id } };
  });
}

/** Kitaplıktan dosya siler (S3 nesnesi dahil). */
export async function deleteUploadAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const actor = await requireActor("ADMIN", "BRAND", "INFLUENCER");
  return attempt(async () => {
    const u = await getOwnedUpload(ownTenantOrNull(actor), str(fd, "id"));
    await prisma.creativeUpload.delete({ where: { id: u.id } });
    await deleteObject(u.s3Key);
    revalidateAll();
    return { ok: true, message: "Dosya silindi." };
  });
}

/** Galerideki AI çıktısını stüdyoya kopyalayıp düzenleyicide açar. */
export async function openAssetInStudioAction(fd: FormData): Promise<void> {
  const actor = await requireActor("ADMIN", "BRAND", "INFLUENCER");
  let target = "/creative?sekme=studyo";
  try {
    const u = await importGeneratedAsset(await creativeTenantFor(actor), str(fd, "assetId"), actor.userId);
    target = `/creative?sekme=studyo&dosya=${u.id}${actor.role === "ADMIN" ? `&hesap=${u.tenantId}` : ""}`;
  } catch (e) {
    target = `/creative?sekme=galeri&hata=${encodeURIComponent(e instanceof DomainError ? e.message : "İçerik açılamadı.")}`;
  }
  redirect(target);
}
