import { createHash, createPublicKey, verify } from "node:crypto";

/**
 * fal webhook imza doğrulaması (fal dokümanı, "Verifying Your Webhook"):
 *   mesaj = request_id \n user_id \n timestamp \n sha256_hex(ham gövde)
 *   imza  = X-Fal-Webhook-Signature (hex), ED25519; anahtarlar https://rest.fal.ai/.well-known/jwks.json
 * Zaman damgası ±5 dk dışındaysa reddedilir (tekrar oynatma koruması).
 * JWKS en çok 12 saat önbelleklenir (fal: 24 saatten uzun tutmayın).
 */
const JWKS_URL = "https://rest.fal.ai/.well-known/jwks.json";
let cache: { keys: { x: string }[]; at: number } | null = null;

async function jwks(fetcher: typeof fetch): Promise<{ x: string }[]> {
  if (cache && Date.now() - cache.at < 12 * 3600 * 1000) return cache.keys;
  const res = await fetcher(JWKS_URL, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`JWKS HTTP ${res.status}`);
  const j = (await res.json()) as { keys?: { x: string }[] };
  cache = { keys: (j.keys ?? []).filter((k) => typeof k.x === "string"), at: Date.now() };
  return cache.keys;
}

export type FalWebhookHeaders = { requestId: string | null; userId: string | null; timestamp: string | null; signature: string | null };

export async function verifyFalWebhook(h: FalWebhookHeaders, rawBody: Uint8Array, opts: { now?: number; fetcher?: typeof fetch } = {}): Promise<boolean> {
  if (!h.requestId || !h.userId || !h.timestamp || !h.signature) return false;
  const ts = Number(h.timestamp);
  const now = Math.floor((opts.now ?? Date.now()) / 1000);
  if (!Number.isFinite(ts) || Math.abs(now - ts) > 300) return false;
  const bodyHash = createHash("sha256").update(rawBody).digest("hex");
  const message = Buffer.from(`${h.requestId}\n${h.userId}\n${h.timestamp}\n${bodyHash}`, "utf8");
  let sig: Buffer;
  try {
    sig = Buffer.from(h.signature, "hex");
  } catch {
    return false;
  }
  const keys = await jwks(opts.fetcher ?? fetch);
  for (const k of keys) {
    try {
      const key = createPublicKey({ key: { kty: "OKP", crv: "Ed25519", x: k.x }, format: "jwk" });
      if (verify(null, message, key, sig)) return true;
    } catch {
      /* sıradaki anahtar */
    }
  }
  return false;
}

/** Testler için önbelleği sıfırla. */
export function _resetJwksCache(): void {
  cache = null;
}
