import { randomUUID } from "node:crypto";
import { DeleteObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { envStr } from "../env";
import { bucket, s3 } from "../storage/s3";

/**
 * Nesne deposu adapter'ı (ham webhook payload'ları ve mesaj medyası).
 * OBJECT_STORE=memory testlerde ve S3/MinIO erişilemezken kullanılır.
 */
export interface ObjectStore {
  put(key: string, body: Uint8Array | string, contentType: string): Promise<void>;
  delete(key: string): Promise<void>;
  has(key: string): Promise<boolean>;
}

const mem = new Map<string, Uint8Array | string>();

export const memoryStore: ObjectStore = {
  async put(key, body) {
    mem.set(key, body);
  },
  async delete(key) {
    mem.delete(key);
  },
  async has(key) {
    return mem.has(key);
  },
};

export const s3Store: ObjectStore = {
  async put(key, body, contentType) {
    await s3().send(new PutObjectCommand({ Bucket: bucket(), Key: key, Body: body, ContentType: contentType }));
  },
  async delete(key) {
    await s3().send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }));
  },
  async has() {
    return true;
  },
};

export function objectStore(): ObjectStore {
  return envStr("OBJECT_STORE", "s3") === "memory" ? memoryStore : s3Store;
}

/** raw/{provider}/{yyyy}/{mm}/{dd}/{uuid}.json */
export function rawKey(provider: string, at = new Date()): string {
  const y = at.getUTCFullYear();
  const m = String(at.getUTCMonth() + 1).padStart(2, "0");
  const d = String(at.getUTCDate()).padStart(2, "0");
  return `raw/${provider}/${y}/${m}/${d}/${randomUUID()}.json`;
}
