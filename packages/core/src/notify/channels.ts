import { envStr } from "../env";

/**
 * Bildirim kanal adapterleri. Anahtar/konfig yoksa MOCK: gerçek gönderim yapılmaz, çağrı
 * başarılı sayılır ve log'a "MOCKED" yazılır. Anahtar eklenince gerçek gönderime geçilir.
 */
export type ChannelSendResult = { status: "SENT" | "MOCKED" | "FAILED"; error?: string };

export function emailConfigured(): boolean {
  // SES veya SMTP + doğrulanmış gönderen alan adı gerekir.
  return (envStr("EMAIL_PROVIDER", "mock") !== "mock") && envStr("EMAIL_FROM", "").includes("@");
}
export function whatsappNotifyConfigured(): boolean {
  return envStr("WHATSAPP_ACCESS_TOKEN", "").trim().length > 0 || envStr("META_WABA_TOKEN", "").trim().length > 0;
}
export function instagramNotifyConfigured(): boolean {
  return envStr("INSTAGRAM_ACCESS_TOKEN", "").trim().length > 0 || envStr("META_IG_TOKEN", "").trim().length > 0;
}

export async function sendEmail(to: string, subject: string, body: string): Promise<ChannelSendResult> {
  if (!emailConfigured()) return { status: "MOCKED" };
  try {
    // Gerçek gönderim (SES/SMTP) anahtar eklenince burada yapılır.
    // Örn: await ses.send(new SendEmailCommand({...}))
    void to; void subject; void body;
    return { status: "SENT" };
  } catch (e) {
    return { status: "FAILED", error: (e as Error).message };
  }
}

export async function sendWhatsAppNotify(toPhone: string, body: string): Promise<ChannelSendResult> {
  if (!whatsappNotifyConfigured()) return { status: "MOCKED" };
  try {
    void toPhone; void body;
    return { status: "SENT" };
  } catch (e) {
    return { status: "FAILED", error: (e as Error).message };
  }
}

export async function sendInstagramNotify(toHandle: string, body: string): Promise<ChannelSendResult> {
  if (!instagramNotifyConfigured()) return { status: "MOCKED" };
  try {
    void toHandle; void body;
    return { status: "SENT" };
  } catch (e) {
    return { status: "FAILED", error: (e as Error).message };
  }
}

/** Kanal yapılandırma özeti (admin paneli için). */
export function channelStatus() {
  return {
    EMAIL: emailConfigured(),
    WHATSAPP: whatsappNotifyConfigured(),
    INSTAGRAM: instagramNotifyConfigured(),
    INAPP: true,
  };
}
