"use server";
import { prisma } from "@infulancer/core/db";
import { audit } from "@infulancer/core/audit";
import { toAuditActor } from "@infulancer/core/access/actor";
import { submitImageEdit } from "@infulancer/core/creative/edit";
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

/** Yüklenen görsel üzerinde ücretli AI düzenlemesi (komut, arka plan, netleştirme, görselden video). */
export async function imageEditAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const actor = await requireActor("ADMIN", "BRAND", "INFLUENCER");
  return attempt(async () => {
    const tenantId = await creativeTenantFor(actor, str(fd, "tenantId"));
    try {
      const job = await submitImageEdit({
        tenantId,
        uploadId: str(fd, "uploadId"),
        action: str(fd, "action"),
        prompt: str(fd, "prompt") || null,
        seconds: Number(str(fd, "seconds") || "5"),
        portrait: str(fd, "portrait") === "on",
      });
      // Demo (mock) modunda fal webhook'u beklenmeden sonuç simüle edilir.
      if ((process.env.FAL_MODE ?? "mock") === "mock" && job.requestId) {
        const video = job.modelKey === "kling-v2-5-i2v";
        await handleFalWebhook({ request_id: job.requestId, status: "OK", payload: video ? { video: { url: "https://example.invalid/mock.mp4" } } : { image: { url: "https://example.invalid/mock.png" } } });
      }
      await audit.append({ actor: toAuditActor(actor), action: "CREATIVE_EDIT_SUBMITTED", entityType: "CreativeJob", entityId: job.id, data: { tenantId, modelKey: job.modelKey } });
    } catch (e) {
      if (e instanceof CreativeRejectedError || e instanceof ModelUnavailableError || e instanceof InsufficientCreditsError) throw new DomainError("KURAL_IHLALI", e.message);
      throw e;
    }
    revalidateAll();
    return { ok: true, message: "AI düzenlemesi başladı; sonuç galeriye düşecek (AI etiketi gömülü)." };
  });
}

/** Video düzenlemeyi kuyruğa alır (ffmpeg, ücretsiz). İş kimliği data.jobId ile döner. */
export async function videoEditAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const actor = await requireActor("ADMIN", "BRAND", "INFLUENCER");
  return attempt(async () => {
    const tenantId = await creativeTenantFor(actor, str(fd, "tenantId"));
    const num = (k: string) => (str(fd, k) === "" ? null : Number(str(fd, k)));
    const job = await enqueueVideoEdit({
      tenantId,
      uploadId: str(fd, "uploadId"),
      ops: { trimStart: num("trimStart") ?? 0, trimEnd: num("trimEnd"), aspect: str(fd, "aspect") || "orijinal", speed: Number(str(fd, "speed") || "1"), mute: str(fd, "mute") === "on" },
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
    const u = await importGeneratedAsset(ownTenantOrNull(actor), str(fd, "assetId"), actor.userId);
    target = `/creative?sekme=studyo&dosya=${u.id}${actor.role === "ADMIN" ? `&hesap=${u.tenantId}` : ""}`;
  } catch (e) {
    target = `/creative?sekme=galeri&hata=${encodeURIComponent(e instanceof DomainError ? e.message : "İçerik açılamadı.")}`;
  }
  redirect(target);
}
