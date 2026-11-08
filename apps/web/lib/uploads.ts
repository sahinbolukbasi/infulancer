import { z } from "zod";
import { audit } from "@infulancer/core/audit";
import { toAuditActor, type Actor } from "@infulancer/core/access/actor";
import { assertDeliverableAccess } from "@infulancer/core/access/ownership";
import { prisma, type AssetDirection, type AssetKind } from "@infulancer/core/db";
import { transitionDeliverable } from "@infulancer/core/domain/deliverable-status";
import { DomainError, isDomainError } from "@infulancer/core/domain/errors";
import { publish } from "@infulancer/core/events";
import { buildKey, headObject } from "@infulancer/core/storage/s3";
import { notifyAdmins } from "./notify";

/**
 * Yükleme yetki kuralları (route handler'lar ortak kullanır).
 * - Influencer yalnız kendi işlerine TASLAK / HAM_DOSYA / METRIK_SS yükler (Influencer → Ajans).
 * - Admin ajans dosyalarını (brief, marka, ürün…) yükler; influencer türlerini de yükleyebilir.
 * - Marka yalnız kendi kampanyasına brief/ürün/örnek çekim/logo dosyası yükler (kampanya medyası).
 */

export const INFLUENCER_KINDS = ["TASLAK", "HAM_DOSYA", "METRIK_SS"] as const satisfies readonly AssetKind[];
const ALL_KINDS = [
  "BRIEF_PDF",
  "MARKA_LOGO",
  "MARKA_FONT",
  "ORNEK_CEKIM",
  "URUN_FOTO",
  "ONAYLI_CAPTION",
  "TASLAK",
  "HAM_DOSYA",
  "METRIK_SS",
  "DIGER",
] as const satisfies readonly AssetKind[];

/** Markanın kampanyasına ekleyebileceği medya türleri (influencerlar görür). */
export const BRAND_KINDS = ["URUN_FOTO", "ORNEK_CEKIM", "MARKA_LOGO", "BRIEF_PDF", "DIGER"] as const satisfies readonly AssetKind[];
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024 * 1024;

export const uploadRequestSchema = z.object({
  target: z.object({ type: z.enum(["deliverable", "campaign"]), id: z.string().min(1).max(64) }),
  kind: z.enum(ALL_KINDS),
  fileName: z.string().min(1).max(200),
  mime: z
    .string()
    .regex(/^[\w.+-]+\/[\w.+-]+$/)
    .max(120),
  size: z.number().int().positive().max(MAX_UPLOAD_BYTES, { error: "Dosya en fazla 5 GB olabilir." }),
});
export type UploadRequest = z.infer<typeof uploadRequestSchema>;

export function directionFor(kind: AssetKind): AssetDirection {
  return (INFLUENCER_KINDS as readonly AssetKind[]).includes(kind) ? "INFLUENCER_TO_AJANS" : "AJANS_TO_INFLUENCER";
}

export function jsonError(status: number, error: string): Response {
  return Response.json({ error }, { status, headers: { "Cache-Control": "no-store" } });
}

/** DomainError → HTTP durum kodu; diğer hatalar 500. */
export function errorResponse(err: unknown): Response {
  if (isDomainError(err)) {
    const status = err.code === "YETKISIZ" ? 403 : err.code === "BULUNAMADI" ? 404 : 400;
    return jsonError(status, err.message);
  }
  console.error("[uploads]", err);
  return jsonError(500, "Beklenmeyen bir hata oluştu.");
}

export async function readJson<T>(req: Request, schema: z.ZodType<T>): Promise<T> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new DomainError("DOGRULAMA", "Geçersiz istek gövdesi.");
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new DomainError("DOGRULAMA", `Geçersiz istek: ${issue?.path.join(".") || "gövde"} ${issue?.message ?? ""}`.trim());
  }
  return parsed.data;
}

/** Yetki + yön kurallarını uygular, BEKLIYOR durumunda Asset satırı açar. */
export async function prepareAsset(actor: Actor, req: UploadRequest) {
  if (actor.role === "BRAND") {
    if (req.target.type !== "campaign" || !(BRAND_KINDS as readonly AssetKind[]).includes(req.kind)) {
      throw new DomainError("YETKISIZ", "Marka yalnız kampanyasına ürün görseli, örnek çekim, logo veya brief dosyası ekleyebilir.");
    }
    const own = await prisma.campaign.findUnique({ where: { id: req.target.id }, select: { brandId: true, status: true } });
    if (!own || own.brandId !== actor.brandId) throw new DomainError("BULUNAMADI", "Kampanya bulunamadı.");
    if (own.status === "KAPANDI" || own.status === "IPTAL") throw new DomainError("KURAL_IHLALI", "Kapanmış kampanyaya dosya eklenemez.");
  }
  const influencerKind = (INFLUENCER_KINDS as readonly AssetKind[]).includes(req.kind);
  if (actor.role === "INFLUENCER" && !influencerKind) {
    throw new DomainError("YETKISIZ", "Yalnız taslak içerik, ham dosya ve metrik ekran görüntüsü yükleyebilirsiniz.");
  }
  if (influencerKind && req.target.type !== "deliverable") {
    throw new DomainError("DOGRULAMA", "Bu dosya türü bir işe (deliverable) bağlı yüklenmelidir.");
  }
  if (req.kind === "METRIK_SS" && !req.mime.startsWith("image/")) {
    throw new DomainError("DOGRULAMA", "Metrik ekran görüntüsü bir görsel dosyası olmalı.");
  }

  let campaignId: string | null = null;
  let deliverableId: string | null = null;
  if (req.target.type === "deliverable") {
    const access = await assertDeliverableAccess(prisma, actor, req.target.id);
    const d = await prisma.deliverable.findUniqueOrThrow({
      where: { id: access.id },
      select: { status: true, assignment: { select: { contractStatus: true } } },
    });
    if (d.status === "IPTAL" || d.assignment.contractStatus === "RED") {
      throw new DomainError("KURAL_IHLALI", "İptal edilmiş işe dosya yüklenemez.");
    }
    if (actor.role === "INFLUENCER" && d.assignment.contractStatus !== "KABUL") {
      throw new DomainError("KURAL_IHLALI", "Dosya yüklemek için önce sözleşme teklifini kabul edin.");
    }
    deliverableId = access.id;
    campaignId = access.assignment.campaignId;
  } else {
    const c = await prisma.campaign.findUnique({ where: { id: req.target.id }, select: { id: true } });
    if (!c) throw new DomainError("BULUNAMADI", "Kampanya bulunamadı.");
    campaignId = c.id;
  }

  const key = buildKey(req.kind, { campaignId, deliverableId }, req.fileName);
  return prisma.asset.create({
    data: {
      // Asset ya işe ya kampanyaya bağlıdır.
      deliverableId,
      campaignId: deliverableId ? null : campaignId,
      key,
      fileName: req.fileName,
      mime: req.mime,
      size: req.size,
      kind: req.kind,
      direction: directionFor(req.kind),
      uploadedById: actor.userId,
      uploadStatus: "BEKLIYOR",
    },
  });
}

/** Yalnız yükleyen kullanıcının (veya adminin) bekleyen yüklemesi. */
export async function loadPendingAsset(actor: Actor, assetId: string) {
  const asset = await prisma.asset.findUnique({ where: { id: assetId } });
  if (!asset || (asset.uploadedById !== actor.userId && actor.role !== "ADMIN")) {
    throw new DomainError("BULUNAMADI", "Yükleme bulunamadı.");
  }
  if (asset.uploadStatus !== "BEKLIYOR") throw new DomainError("KURAL_IHLALI", "Bu yükleme zaten tamamlanmış.");
  return asset;
}

/**
 * Yüklemeyi doğrular (nesne depoda mı), TAMAM işaretler, ASSET_UPLOADED yayınlar.
 * BRIEF_GONDERILDI/REVIZYON durumundaki işe TASLAK yüklenirse iş ICERIK_YUKLENDI'ye geçer.
 */
export async function finalizeAsset(actor: Actor, assetId: string) {
  const asset = await loadPendingAsset(actor, assetId);
  const head = await headObject(asset.key);
  if (!head) throw new DomainError("DOGRULAMA", "Dosya depoda bulunamadı; yüklemeyi tekrarlayın.");

  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.asset.update({
      where: { id: asset.id },
      data: { uploadStatus: "TAMAM", size: head.size || asset.size },
    });
    await audit.append({
      actor: toAuditActor(actor),
      action: "ASSET_UPLOADED",
      entityType: "Asset",
      entityId: asset.id,
      data: { kind: asset.kind, key: asset.key, size: updated.size, deliverableId: asset.deliverableId, campaignId: asset.campaignId },
    });
    let status: string | null = null;
    if (asset.kind === "TASLAK" && asset.deliverableId) {
      const d = await tx.deliverable.findUniqueOrThrow({ where: { id: asset.deliverableId }, select: { status: true } });
      if (d.status === "BRIEF_GONDERILDI" || d.status === "REVIZYON") {
        const r = await transitionDeliverable(tx, {
          deliverableId: asset.deliverableId,
          to: "ICERIK_YUKLENDI",
          actor,
          note: `Taslak yüklendi: ${asset.fileName}`,
        });
        status = r.status;
      }
    }
    if (actor.role === "INFLUENCER" && asset.deliverableId) {
      await notifyAdmins(tx, {
        title: status ? "Onay bekleyen taslak" : "Yeni dosya yüklendi",
        body: `${asset.fileName} yüklendi.`,
        href: `/admin/teslimler/${asset.deliverableId}`,
      });
    }
    return { asset: updated, status };
  });
  await publish({
    type: "ASSET_UPLOADED",
    assetId: asset.id,
    deliverableId: asset.deliverableId,
    campaignId: asset.campaignId,
  });
  return result;
}
