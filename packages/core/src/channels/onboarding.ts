import { createCipheriv, createHash, randomBytes } from "node:crypto";
import { prisma } from "../db";
import { envStr } from "../env";
import { isPermissionMissing, isRevocationError, metaClient } from "./meta-client";
import { vault } from "./vault";
import { markConnectionRevoked } from "../messaging/send";

/**
 * WhatsApp Embedded Signup **v4** (v2/v3 15 Ekim 2026'da deprecate edildi). Tamamı sunucu tarafında.
 * TENANT BAŞINA TEK NUMARA: aylık 1.000 ücretsiz servis mesajı numara başınadır, paylaşılmaz.
 */
export const EMBEDDED_SIGNUP_VERSION = "v4";

export const WHATSAPP_WEBHOOK_FIELDS = [
  "messages", "calls", // whatsapp_business_messaging
  "message_template_status_update", "message_template_quality_update", "message_template_components_update",
  "template_category_update", "phone_number_quality_update", "account_review_update", "account_update",
  "account_alerts", "business_capability_update", "user_preferences", "security", // whatsapp_business_management
] as const;

export const WHATSAPP_SCOPES = ["whatsapp_business_messaging", "whatsapp_business_management"];
export const META_LOGIN_SCOPES = [
  "pages_show_list", "pages_manage_metadata", "pages_messaging", "pages_read_engagement",
  "business_management", "instagram_basic", "instagram_manage_messages",
];

export const ONBOARDING_STEPS = [
  { key: "signup", label: "Embedded Signup (v4)" },
  { key: "token", label: "Erişim belirteci alındı" },
  { key: "subscribed", label: "Webhook aboneliği" },
  { key: "registered", label: "Numara kaydı (2 adımlı doğrulama PIN'i)" },
  { key: "test_message", label: "Test mesajı (opsiyonel)" },
  { key: "payment_method", label: "WhatsApp Manager'da ödeme yöntemi" },
  { key: "business_verification", label: "İş doğrulaması (2.000 kademesi için)" },
  { key: "done", label: "Tamamlandı" },
] as const;

export class OnboardingError extends Error {
  constructor(message: string, readonly code: "PERMISSION_MISSING" | "REVOKED" | "ALREADY_HAS_NUMBER" | "INVALID") {
    super(message);
  }
}

function encryptPin(pin: string): string {
  // Yerelde AUTH_SECRET'tan türetilen anahtar; prod'da tenant KMS anahtarı ile (VAULT_MODE=aws).
  const key = createHash("sha256").update(`pin:${envStr("AUTH_SECRET", "local")}`).digest();
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([c.update(pin, "utf8"), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), enc]).toString("base64");
}

export type SignupInput = { tenantId: string; code: string; wabaId: string; phoneNumberId: string; displayNumber?: string; pin: string; businessPortfolioId?: string };

export async function completeWhatsAppSignup(input: SignupInput) {
  if (!/^\d{6}$/.test(input.pin)) throw new OnboardingError("PIN 6 haneli olmalı.", "INVALID");
  const existing = await prisma.whatsAppNumber.findUnique({ where: { tenantId: input.tenantId } });
  if (existing) throw new OnboardingError("Bu marka için zaten bir WhatsApp numarası bağlı (tenant başına tek numara).", "ALREADY_HAS_NUMBER");

  const meta = metaClient();
  const { accessToken } = await meta.exchangeCode(input.code);
  const tokenRef = await vault().put(input.tenantId, "whatsapp", accessToken);
  const conn = await prisma.channelConnection.create({
    data: {
      tenantId: input.tenantId,
      provider: "WHATSAPP",
      externalIds: { waba_id: input.wabaId, phone_number_id: input.phoneNumberId },
      tokenRef,
      scopes: WHATSAPP_SCOPES,
      status: "PENDING",
    },
  });
  try {
    await meta.subscribeApp(input.wabaId, accessToken);
    await meta.registerNumber(input.phoneNumberId, input.pin, accessToken);
  } catch (err) {
    if (isPermissionMissing(err)) {
      await prisma.channelConnection.update({ where: { id: conn.id }, data: { status: "ERROR", lastError: "whatsapp_business_management izni eksik (hata 200)" } });
      throw new OnboardingError("İzin eksik: whatsapp_business_management (Advanced Access) gerekli.", "PERMISSION_MISSING");
    }
    if (isRevocationError(err)) {
      await markConnectionRevoked(conn.id, (err as Error).message);
      throw new OnboardingError("Erişim belirteci geçersiz.", "REVOKED");
    }
    throw err;
  }
  await prisma.channelConnection.update({ where: { id: conn.id }, data: { status: "ACTIVE", connectedAt: new Date(), lastVerifiedAt: new Date() } });
  return prisma.whatsAppNumber.create({
    data: {
      tenantId: input.tenantId,
      connectionId: conn.id,
      wabaId: input.wabaId,
      phoneNumberId: input.phoneNumberId,
      displayNumber: input.displayNumber ?? null,
      businessPortfolioId: input.businessPortfolioId ?? null,
      pinCiphertext: encryptPin(input.pin),
      onboardingStep: "payment_method",
    },
  });
}

/** Ödeme yöntemi onaylanmadan onboarding bitmez (en büyük drop-off noktası). */
export async function confirmPaymentMethod(tenantId: string) {
  return prisma.whatsAppNumber.update({ where: { tenantId }, data: { paymentMethod: "payment_method_confirmed", onboardingStep: "done" } });
}

export function isOnboardingComplete(n: { paymentMethod: string } | null): boolean {
  return n?.paymentMethod === "payment_method_confirmed";
}

/** Instagram/Messenger bağlantısı (Facebook Login for Business). Creator hesapları için Conversations API ön çağrısı. */
export async function connectInstagram(input: { tenantId: string; code: string; pageId: string; igUserId: string; accountType: "BUSINESS" | "CREATOR" | "PERSONAL" }) {
  if (input.accountType === "PERSONAL") throw new OnboardingError("Instagram hesabı Professional (Business veya Creator) olmalı.", "INVALID");
  const meta = metaClient();
  const { accessToken } = await meta.exchangeCode(input.code);
  const tokenRef = await vault().put(input.tenantId, "instagram", accessToken);
  if (input.accountType === "CREATOR") await meta.primeConversations(input.igUserId, accessToken);
  return prisma.channelConnection.create({
    data: {
      tenantId: input.tenantId,
      provider: "INSTAGRAM",
      externalIds: { page_id: input.pageId, ig_user_id: input.igUserId, account_type: input.accountType },
      tokenRef,
      scopes: META_LOGIN_SCOPES,
      status: "ACTIVE",
      connectedAt: new Date(),
      lastVerifiedAt: new Date(),
    },
  });
}

/** Saatlik health-check: her bağlantıya hafif okuma çağrısı; iptal → revoked + kuyruk durdur. */
export async function healthCheckConnections(now = new Date()) {
  const list = await prisma.channelConnection.findMany({ where: { status: "ACTIVE" } });
  let revoked = 0;
  for (const c of list) {
    try {
      await metaClient().verifyToken(await vault().get(c.tokenRef));
      await prisma.channelConnection.update({ where: { id: c.id }, data: { lastVerifiedAt: now } });
    } catch (err) {
      if (isRevocationError(err)) {
        await markConnectionRevoked(c.id, (err as Error).message);
        revoked++;
      } else {
        await prisma.channelConnection.update({ where: { id: c.id }, data: { lastError: String((err as Error).message).slice(0, 300) } });
      }
    }
  }
  return { checked: list.length, revoked };
}
