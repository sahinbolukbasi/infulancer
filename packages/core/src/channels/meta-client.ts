import { getConfig } from "../config/store";
import { envStr } from "../env";

/**
 * Meta Graph / WhatsApp Cloud API istemcisi. Tüm çağrılar sunucudan sunucuya.
 * META_API_MODE=http değilse deterministik mock kullanılır (testler ve kimlik bilgisi yokken).
 */
export class MetaApiError extends Error {
  constructor(
    message: string,
    readonly code: number,
    readonly subcode?: number,
    readonly type?: string,
    readonly httpStatus?: number,
  ) {
    super(message);
    this.name = "MetaApiError";
  }
}

/** Token iptali: OAuthException / 190 ailesi (iptal için doğrulanmış webhook yok). */
export function isRevocationError(err: unknown): boolean {
  return err instanceof MetaApiError && (err.code === 190 || err.type === "OAuthException" && [102, 190, 463, 467].includes(err.code));
}

/** whatsapp_business_management izni eksikse sahip olunmayan hesaplara çağrı 200 hata kodu döner. */
export function isPermissionMissing(err: unknown): boolean {
  return err instanceof MetaApiError && err.code === 200;
}

export function isRateLimited(err: unknown): boolean {
  return err instanceof MetaApiError && (err.httpStatus === 429 || [4, 17, 32, 613, 80007].includes(err.code));
}

export type SendPayload =
  | { kind: "text"; to: string; body: string }
  | { kind: "template"; to: string; templateName: string; language: string; params?: string[] };

export interface MetaClient {
  exchangeCode(code: string): Promise<{ accessToken: string }>;
  subscribeApp(wabaId: string, token: string): Promise<{ success: boolean }>;
  registerNumber(phoneNumberId: string, pin: string, token: string): Promise<{ success: boolean }>;
  sendWhatsApp(phoneNumberId: string, token: string, payload: SendPayload): Promise<{ messageId: string }>;
  sendInstagram(igUserId: string, token: string, recipientId: string, body: string, tag?: "HUMAN_AGENT"): Promise<{ messageId: string }>;
  /** Hafif okuma çağrısı (health-check). */
  verifyToken(token: string): Promise<{ ok: true }>;
  /** Creator hesapları webhook almadan önce bir Conversations API çağrısı yapmalı. */
  primeConversations(igUserId: string, token: string): Promise<void>;
  downloadMedia(url: string, token: string): Promise<{ bytes: Uint8Array; mime: string }>;
}

let counter = 0;

/** Mock: 'revoked' içeren token → 190; 'noperm' → 200; aksi halde başarı. */
export const mockMetaClient: MetaClient = {
  async exchangeCode(code) {
    if (!code) throw new MetaApiError("Geçersiz kod", 100);
    return { accessToken: `mock-token-${code}` };
  },
  async subscribeApp(_waba, token) {
    guard(token);
    return { success: true };
  },
  async registerNumber(_id, pin, token) {
    guard(token);
    if (!/^\d{6}$/.test(pin)) throw new MetaApiError("PIN 6 hane olmalı", 100);
    return { success: true };
  },
  async sendWhatsApp(_id, token) {
    guard(token);
    return { messageId: `wamid.mock.${++counter}` };
  },
  async sendInstagram(_id, token) {
    guard(token);
    return { messageId: `ig.mock.${++counter}` };
  },
  async verifyToken(token) {
    guard(token);
    return { ok: true };
  },
  async primeConversations(_id, token) {
    guard(token);
  },
  async downloadMedia() {
    return { bytes: new TextEncoder().encode("mock-media"), mime: "image/jpeg" };
  },
};

function guard(token: string) {
  if (token.includes("revoked")) throw new MetaApiError("Error validating access token", 190, 460, "OAuthException", 401);
  if (token.includes("noperm")) throw new MetaApiError("Permission missing", 200, undefined, "OAuthException", 403);
}

/** Gerçek Graph API istemcisi (META_API_MODE=http). */
export function httpMetaClient(): MetaClient {
  const base = "https://graph.facebook.com";
  async function call<T>(path: string, init: RequestInit & { token?: string } = {}): Promise<T> {
    const version = await getConfig("whatsapp.graphApiVersion");
    const res = await fetch(`${base}/${version}${path}`, {
      ...init,
      headers: { "content-type": "application/json", ...(init.token ? { authorization: `Bearer ${init.token}` } : {}) },
      signal: AbortSignal.timeout(15_000),
    });
    const json = (await res.json().catch(() => ({}))) as { error?: { message: string; code: number; error_subcode?: number; type?: string } };
    if (!res.ok || json.error) {
      const e = json.error;
      throw new MetaApiError(e?.message ?? `HTTP ${res.status}`, e?.code ?? res.status, e?.error_subcode, e?.type, res.status);
    }
    return json as T;
  }
  return {
    async exchangeCode(code) {
      const q = new URLSearchParams({ client_id: envStr("META_APP_ID", ""), client_secret: envStr("META_APP_SECRET", ""), code });
      const r = await call<{ access_token: string }>(`/oauth/access_token?${q}`);
      return { accessToken: r.access_token };
    },
    subscribeApp: (waba, token) => call(`/${waba}/subscribed_apps`, { method: "POST", token }),
    registerNumber: (id, pin, token) => call(`/${id}/register`, { method: "POST", token, body: JSON.stringify({ messaging_product: "whatsapp", pin }) }),
    async sendWhatsApp(id, token, p) {
      const body =
        p.kind === "text"
          ? { messaging_product: "whatsapp", to: p.to, type: "text", text: { body: p.body } }
          : {
              messaging_product: "whatsapp",
              to: p.to,
              type: "template",
              template: {
                name: p.templateName,
                language: { code: p.language },
                components: p.params?.length ? [{ type: "body", parameters: p.params.map((t) => ({ type: "text", text: t })) }] : [],
              },
            };
      const r = await call<{ messages: { id: string }[] }>(`/${id}/messages`, { method: "POST", token, body: JSON.stringify(body) });
      return { messageId: r.messages[0]!.id };
    },
    async sendInstagram(igId, token, recipient, text, tag) {
      const r = await call<{ message_id: string }>(`/${igId}/messages`, {
        method: "POST",
        token,
        body: JSON.stringify({ recipient: { id: recipient }, message: { text }, ...(tag ? { messaging_type: "MESSAGE_TAG", tag } : {}) }),
      });
      return { messageId: r.message_id };
    },
    async verifyToken(token) {
      await call(`/me?fields=id`, { token });
      return { ok: true };
    },
    async primeConversations(igId, token) {
      await call(`/${igId}/conversations?platform=instagram&limit=1`, { token });
    },
    async downloadMedia(url, token) {
      const res = await fetch(url, { headers: { authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(30_000) });
      return { bytes: new Uint8Array(await res.arrayBuffer()), mime: res.headers.get("content-type") ?? "application/octet-stream" };
    },
  };
}

let override: MetaClient | undefined;
export function metaClient(): MetaClient {
  if (override) return override;
  return envStr("META_API_MODE", "mock") === "http" ? httpMetaClient() : mockMetaClient;
}
/** Testler için. */
export function setMetaClient(c: MetaClient | undefined): void {
  override = c;
}
