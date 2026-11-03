import { createHmac, timingSafeEqual } from "node:crypto";
import { prisma } from "../db";
import { envStr } from "../env";
import { objectStore, rawKey } from "./raw-store";

/**
 * Webhook alımı (fan-in, tek uç nokta). Meta davranışı: 200 dışındaki her yanıt 7 güne kadar
 * retry tetikler, retry'lar duplicate üretebilir, payload ≤ 3 MB, sıralama garantisi yok.
 * Bu yüzden: doğrula → ham payload S3'e → pointer kuyruğa → HER KOŞULDA 200. İşleme ayrı adımdır.
 */
export const MAX_PAYLOAD_BYTES = 3 * 1024 * 1024;
export const DEDUPE_TTL_DAYS = 7;

/**
 * X-Hub-Signature-256 = "sha256=" + HMAC-SHA256(app_secret, ham gövde).
 * NOT: Güncel Meta dokümanı bu başlığı tarif etmiyor; canlıya almadan önce teyit edilecek.
 * Prod'da önerilen birincil kontrol API Gateway mTLS'tir.
 */
export function verifySignature(rawBody: string, header: string | null, appSecret: string): boolean {
  if (!header?.startsWith("sha256=") || !appSecret) return false;
  const expected = createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex");
  const given = header.slice(7);
  if (given.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(given, "hex"), Buffer.from(expected, "hex"));
}

export type ReceiveResult = { status: 200; rawId: string | null; accepted: boolean; reason?: string };

type Enqueue = (rawId: string) => void;

let enqueue: Enqueue = (rawId) => {
  // Varsayılan: aynı süreçte, yanıtı bekletmeden işle (prod'da SQS'e pointer).
  setImmediate(() => {
    void import("./processor").then((m) => m.processRawWebhook(rawId)).catch((e) => console.error("[webhook] işleme hatası", e));
  });
};
export function setWebhookEnqueue(fn: Enqueue): void {
  enqueue = fn;
}

/** Her koşulda 200 döner; hatalar loglanır (Meta retry fırtınası üretmemek için). */
export async function receiveWebhook(provider: string, rawBody: string, signatureHeader: string | null): Promise<ReceiveResult> {
  try {
    if (Buffer.byteLength(rawBody, "utf8") > MAX_PAYLOAD_BYTES) {
      return { status: 200, rawId: null, accepted: false, reason: "payload_too_large" };
    }
    const secret = envStr(provider === "fal" ? "FAL_WEBHOOK_SECRET" : "META_APP_SECRET", "");
    const requireSig = envStr("WEBHOOK_REQUIRE_SIGNATURE", "true") !== "false";
    if (requireSig && !verifySignature(rawBody, signatureHeader, secret)) {
      return { status: 200, rawId: null, accepted: false, reason: "bad_signature" };
    }
    const key = rawKey(provider);
    await objectStore().put(key, rawBody, "application/json");
    const raw = await prisma.rawWebhook.create({ data: { provider, s3Key: key }, select: { id: true } });
    // Ham gövde işlemciye bellekten de verilir (S3 okuma gecikmesi olmadan).
    rawBodies.set(raw.id, rawBody);
    enqueue(raw.id);
    return { status: 200, rawId: raw.id, accepted: true };
  } catch (err) {
    console.error("[webhook] alım hatası", err);
    return { status: 200, rawId: null, accepted: false, reason: "internal" };
  }
}

/** İşlemcinin ham gövdeye erişimi (S3'ten yeniden okuma yolu prod'da processor'dadır). */
export const rawBodies = new Map<string, string>();

/**
 * Idempotency: webhook_dedupe(message_id PK, ttl 7 gün). İlk görülen kimlik için true döner.
 * Retry'lar abone tüm app'lere gider ve duplicate üretebilir.
 */
export async function firstSeen(messageId: string, provider: string, now = new Date()): Promise<boolean> {
  const ttl = new Date(now.getTime() + DEDUPE_TTL_DAYS * 86_400_000);
  const inserted = await prisma.$executeRaw`
    INSERT INTO webhook_dedupe (message_id, provider, ttl, "createdAt")
    VALUES (${messageId}, ${provider}, ${ttl}, ${now})
    ON CONFLICT (message_id) DO NOTHING`;
  return inserted === 1;
}

export async function purgeExpiredDedupe(now = new Date()): Promise<number> {
  const r = await prisma.webhookDedupe.deleteMany({ where: { ttl: { lt: now } } });
  return r.count;
}
