import { randomUUID } from "node:crypto";
import { createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import type { Readable } from "node:stream";
import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { prisma } from "../db";
import { DomainError } from "../domain/errors";
import { bucket, headObject, presignTtlSeconds, s3 } from "../storage/s3";

/**
 * Creative stüdyosu dosyaları: kullanıcı yüklemesi ve stüdyo düzenlemeleri.
 * Anahtar biçimi: uploads/<tenantId>/<uuid>.<ext>. Bucket özeldir; görüntüleme ve AI
 * modeline girdi olarak verme yalnız kısa süreli imzalı URL ile yapılır.
 */
export const IMAGE_MIMES = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" } as const;
export const VIDEO_MIMES = { "video/mp4": "mp4", "video/quicktime": "mov", "video/webm": "webm" } as const;
export const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 100 * 1024 * 1024;
/** Sunucuda düzenlenecek videonun en uzun süresi (0,5 vCPU'da makul işlem süresi için). */
export const MAX_VIDEO_SECONDS = 60;

export type UploadKind = "image" | "video";

export function kindOfMime(mime: string): UploadKind | null {
  if (mime in IMAGE_MIMES) return "image";
  if (mime in VIDEO_MIMES) return "video";
  return null;
}
function extOf(mime: string): string {
  return (IMAGE_MIMES as Record<string, string>)[mime] ?? (VIDEO_MIMES as Record<string, string>)[mime] ?? "bin";
}

/** Tarayıcıdan doğrudan S3'e yükleme için imzalı PUT. Tür ve boyut sunucuda doğrulanır. */
export async function presignCreativeUpload(tenantId: string, mime: string, size: number): Promise<{ key: string; url: string }> {
  const kind = kindOfMime(mime);
  if (!kind) throw new DomainError("DOGRULAMA", "Yalnız JPEG, PNG, WebP görsel veya MP4, MOV, WebM video yükleyebilirsiniz.");
  const max = kind === "image" ? MAX_IMAGE_BYTES : MAX_VIDEO_BYTES;
  if (!Number.isFinite(size) || size <= 0 || size > max) throw new DomainError("DOGRULAMA", kind === "image" ? "Görsel en çok 15 MB olabilir." : "Video en çok 100 MB olabilir.");
  const key = `uploads/${tenantId}/${randomUUID()}.${extOf(mime)}`;
  const url = await getSignedUrl(s3(), new PutObjectCommand({ Bucket: bucket(), Key: key, ContentType: mime }), { expiresIn: presignTtlSeconds() });
  return { key, url };
}

/** Yükleme tamamlandı: nesneyi doğrula ve kayıt oluştur. Anahtar bu tenant'a ait olmalı. */
export async function confirmCreativeUpload(input: { tenantId: string; key: string; name?: string | null; userId?: string | null; parentId?: string | null }) {
  const prefix = `uploads/${input.tenantId}/`;
  if (!input.key.startsWith(prefix) || !/^uploads\/[\w-]+\/[a-f0-9-]{36}\.(jpg|png|webp|mp4|mov|webm)$/.test(input.key)) {
    throw new DomainError("YETKISIZ", "Geçersiz dosya anahtarı.");
  }
  const head = await headObject(input.key);
  if (!head || head.size === 0) throw new DomainError("DOGRULAMA", "Dosya yüklenmemiş görünüyor, tekrar deneyin.");
  const mime = head.mime ?? "";
  const kind = kindOfMime(mime);
  if (!kind) throw new DomainError("DOGRULAMA", "Desteklenmeyen dosya türü.");
  if (head.size > (kind === "image" ? MAX_IMAGE_BYTES : MAX_VIDEO_BYTES)) throw new DomainError("DOGRULAMA", "Dosya boyut sınırını aşıyor.");
  // Tarayıcı düzenleyicisinden kaydedilen kopya: kaynak aynı tenant'a ait olmalı.
  if (input.parentId) await getOwnedUpload(input.tenantId, input.parentId);
  return prisma.creativeUpload.create({
    data: {
      tenantId: input.tenantId,
      uploadedByUserId: input.userId ?? null,
      kind,
      mime,
      sizeBytes: head.size,
      s3Key: input.key,
      name: input.name?.slice(0, 120) ?? null,
      source: input.parentId ? "edit" : "upload",
      parentId: input.parentId ?? null,
    },
  });
}

/** Tenant'a ait yüklemeyi getirir (yoksa BULUNAMADI; başka tenant'ınki de BULUNAMADI). */
export async function getOwnedUpload(tenantId: string | null, id: string) {
  const u = await prisma.creativeUpload.findUnique({ where: { id } });
  if (!u || (tenantId !== null && u.tenantId !== tenantId)) throw new DomainError("BULUNAMADI", "Dosya bulunamadı.");
  return u;
}

/** Görüntüleme veya AI modeline girdi için kısa süreli imzalı GET (varsayılan 1 saat). */
export async function presignCreativeGet(key: string, ttlSeconds = 3600): Promise<string> {
  return getSignedUrl(s3(), new GetObjectCommand({ Bucket: bucket(), Key: key, ResponseContentDisposition: "inline" }), { expiresIn: ttlSeconds });
}

/** Nesneyi yerel dosyaya indirir (ffmpeg girdisi). */
export async function downloadToFile(key: string, filePath: string): Promise<void> {
  const res = await s3().send(new GetObjectCommand({ Bucket: bucket(), Key: key }));
  if (!res.Body) throw new Error("Boş nesne");
  await pipeline(res.Body as Readable, createWriteStream(filePath));
}

/** Stüdyoda üretilen (düzenlenmiş) dosyayı kaydeder. */
export async function saveEditedFile(input: { tenantId: string; parentId: string; userId?: string | null; body: Buffer; mime: string; name?: string | null; durationSec?: number | null }) {
  const kind = kindOfMime(input.mime);
  if (!kind) throw new DomainError("DOGRULAMA", "Desteklenmeyen çıktı türü.");
  const key = `uploads/${input.tenantId}/${randomUUID()}.${extOf(input.mime)}`;
  await s3().send(new PutObjectCommand({ Bucket: bucket(), Key: key, Body: input.body, ContentType: input.mime }));
  return prisma.creativeUpload.create({
    data: { tenantId: input.tenantId, uploadedByUserId: input.userId ?? null, kind, mime: input.mime, sizeBytes: input.body.length, s3Key: key, name: input.name ?? null, source: "edit", parentId: input.parentId, durationSec: input.durationSec ?? null },
  });
}

/**
 * AI çıktısını (generated_assets) stüdyo kitaplığına kopyalar ki üzerine ücretsiz
 * düzenleme (yazı, kadraj, filtre) yapılabilsin. S3 içinde kopyalanır; indirme yok.
 */
export async function importGeneratedAsset(tenantId: string | null, assetId: string, userId?: string | null) {
  const asset = await prisma.generatedAsset.findUnique({ where: { id: assetId } });
  if (!asset || (tenantId !== null && asset.tenantId !== tenantId)) throw new DomainError("BULUNAMADI", "İçerik bulunamadı.");
  const head = await headObject(asset.s3Key);
  const mime = head?.mime ?? "";
  const kind = kindOfMime(mime);
  if (!head || !kind) throw new DomainError("DOGRULAMA", "Bu içerik stüdyoda düzenlenemiyor (demo modunda üretilen örnek dosya olabilir).");
  const { CopyObjectCommand } = await import("@aws-sdk/client-s3");
  const key = `uploads/${asset.tenantId}/${randomUUID()}.${extOf(mime)}`;
  await s3().send(new CopyObjectCommand({ Bucket: bucket(), Key: key, CopySource: `${bucket()}/${asset.s3Key}`, ContentType: mime, MetadataDirective: "REPLACE" }));
  return prisma.creativeUpload.create({
    data: { tenantId: asset.tenantId, uploadedByUserId: userId ?? null, kind, mime, sizeBytes: head.size, s3Key: key, name: `AI çıktısı · ${asset.modelKey}`, source: "edit" },
  });
}
