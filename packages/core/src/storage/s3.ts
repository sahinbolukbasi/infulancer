import { randomUUID } from "node:crypto";
import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  UploadPartCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { AssetKind } from "../generated/prisma/enums";
import { envInt, envStr, loadEnv, requireEnv } from "../env";

/**
 * Özel bucket; erişim yalnızca presigned URL ile (uygulama dosya proxy'lemez).
 * Yerelde MinIO (forcePathStyle), AWS'de S3 + IAM rolü.
 */

export const MULTIPART_THRESHOLD_BYTES = 50 * 1024 * 1024;
export const MULTIPART_PART_BYTES = 10 * 1024 * 1024;

const globalForS3 = globalThis as unknown as { __infulancerS3?: S3Client };

export function s3(): S3Client {
  if (!globalForS3.__infulancerS3) {
    loadEnv();
    const endpoint = process.env.S3_ENDPOINT || undefined;
    const accessKeyId = process.env.S3_ACCESS_KEY_ID;
    const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
    globalForS3.__infulancerS3 = new S3Client({
      region: envStr("S3_REGION", "eu-central-1"),
      endpoint,
      forcePathStyle: envStr("S3_FORCE_PATH_STYLE", "false") === "true",
      // AWS'de anahtar verilmezse varsayılan kimlik zinciri (IAM rolü) kullanılır.
      credentials: accessKeyId && secretAccessKey ? { accessKeyId, secretAccessKey } : undefined,
    });
  }
  return globalForS3.__infulancerS3;
}

export function bucket(): string {
  return requireEnv("S3_BUCKET");
}

export function presignTtlSeconds(): number {
  return envInt("PRESIGN_TTL_SECONDS", 900);
}

const kindPrefix: Record<AssetKind, string> = {
  BRIEF_PDF: "brief",
  ONAYLI_CAPTION: "brief",
  MARKA_LOGO: "brand",
  MARKA_FONT: "brand",
  ORNEK_CEKIM: "brand",
  URUN_FOTO: "brand",
  TASLAK: "draft",
  HAM_DOSYA: "raw",
  METRIK_SS: "metric",
  DIGER: "brief",
};

export function sanitizeFileName(fileName: string): string {
  const cleaned = fileName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return (cleaned || "dosya").slice(-120);
}

/**
 * Nesne anahtarı: <prefix>/<campaignId|_>/<deliverableId|_>/<uuid>-<dosya>.
 * Ön ekler: brief/ brand/ draft/ raw/ (60 gün sonra Glacier) metric/.
 */
export function buildKey(
  kind: AssetKind,
  ids: { campaignId?: string | null; deliverableId?: string | null },
  fileName: string,
): string {
  const parts = [
    kindPrefix[kind],
    ids.campaignId ?? "_",
    ids.deliverableId ?? "_",
    `${randomUUID()}-${sanitizeFileName(fileName)}`,
  ];
  return parts.join("/");
}

export async function presignPut(key: string, mime: string): Promise<string> {
  return getSignedUrl(s3(), new PutObjectCommand({ Bucket: bucket(), Key: key, ContentType: mime }), {
    expiresIn: presignTtlSeconds(),
  });
}

export async function presignGet(key: string, fileName: string): Promise<string> {
  const safe = sanitizeFileName(fileName);
  return getSignedUrl(
    s3(),
    new GetObjectCommand({
      Bucket: bucket(),
      Key: key,
      ResponseContentDisposition: `attachment; filename="${safe}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    }),
    { expiresIn: presignTtlSeconds() },
  );
}

export async function headObject(key: string): Promise<{ size: number; mime: string | undefined } | null> {
  try {
    const res = await s3().send(new HeadObjectCommand({ Bucket: bucket(), Key: key }));
    return { size: Number(res.ContentLength ?? 0), mime: res.ContentType };
  } catch {
    return null;
  }
}

export async function createMultipart(key: string, mime: string): Promise<string> {
  const res = await s3().send(
    new CreateMultipartUploadCommand({ Bucket: bucket(), Key: key, ContentType: mime }),
  );
  if (!res.UploadId) throw new Error("Multipart upload başlatılamadı.");
  return res.UploadId;
}

export async function presignPart(key: string, uploadId: string, partNumber: number): Promise<string> {
  return getSignedUrl(
    s3(),
    new UploadPartCommand({ Bucket: bucket(), Key: key, UploadId: uploadId, PartNumber: partNumber }),
    { expiresIn: presignTtlSeconds() },
  );
}

export async function completeMultipart(
  key: string,
  uploadId: string,
  parts: { partNumber: number; etag: string }[],
): Promise<void> {
  await s3().send(
    new CompleteMultipartUploadCommand({
      Bucket: bucket(),
      Key: key,
      UploadId: uploadId,
      MultipartUpload: {
        Parts: [...parts]
          .sort((a, b) => a.partNumber - b.partNumber)
          .map((p) => ({ PartNumber: p.partNumber, ETag: p.etag })),
      },
    }),
  );
}

export async function abortMultipart(key: string, uploadId: string): Promise<void> {
  await s3().send(new AbortMultipartUploadCommand({ Bucket: bucket(), Key: key, UploadId: uploadId }));
}

/** Profil fotoğrafı: küçük, herkese açık okunabilir bir anahtar (avatars/<uuid>.<ext>). */
export async function presignAvatarPut(mime: string): Promise<{ key: string; url: string }> {
  const ext = mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg";
  const key = `avatars/${randomUUID()}.${ext}`;
  const url = await getSignedUrl(s3(), new PutObjectCommand({ Bucket: bucket(), Key: key, ContentType: mime, CacheControl: "public, max-age=31536000, immutable" }), { expiresIn: presignTtlSeconds() });
  return { key, url };
}
/** Profil fotoğrafını görüntülemek için kısa süreli imzalı GET (inline). */
export async function presignAvatarGet(key: string): Promise<string> {
  return getSignedUrl(s3(), new GetObjectCommand({ Bucket: bucket(), Key: key, ResponseContentDisposition: "inline" }), { expiresIn: 3600 });
}
/** Genel görsel (etkinlik/kupon logosu/kapak) için presign PUT: media/<uuid>.<ext>. */
export async function presignMediaPut(mime: string): Promise<{ key: string; url: string }> {
  const ext = mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg";
  const key = `media/${randomUUID()}.${ext}`;
  const url = await getSignedUrl(s3(), new PutObjectCommand({ Bucket: bucket(), Key: key, ContentType: mime, CacheControl: "public, max-age=31536000, immutable" }), { expiresIn: presignTtlSeconds() });
  return { key, url };
}
/** Genel görseli görüntülemek için kısa süreli imzalı GET (inline). */
export async function presignMediaGet(key: string): Promise<string> {
  return getSignedUrl(s3(), new GetObjectCommand({ Bucket: bucket(), Key: key, ResponseContentDisposition: "inline" }), { expiresIn: 3600 });
}
export async function deleteObject(key: string): Promise<void> {
  const { DeleteObjectCommand } = await import("@aws-sdk/client-s3");
  await s3().send(new DeleteObjectCommand({ Bucket: bucket(), Key: key })).catch(() => {});
}
