import { prisma } from "../db";
import { notifyAdmins } from "../agents/common";
import { isRevocationError, metaClient, type SendPayload } from "../channels/meta-client";
import { vault } from "../channels/vault";
import { canSendCommercial } from "../compliance/iys";
import { asksForFinancialData, policyGate } from "../compliance/policy";
import type { MessageCategory } from "../generated/prisma/enums";
import { recordMessageCost } from "./cost";
import { canUseTemplate, containsPromotion } from "./templates";
import { composerMode, isOpen } from "./windows";

export class SendBlockedError extends Error {
  constructor(
    message: string,
    readonly code: "WINDOW_CLOSED" | "TEMPLATE" | "IYS" | "POLICY" | "CONNECTION" | "CONTENT",
  ) {
    super(message);
    this.name = "SendBlockedError";
  }
}

export type SendInput = {
  tenantId: string;
  conversationId: string;
  /** null = AI agent */
  byUserId: string | null;
  text?: string;
  templateId?: string;
  params?: string[];
  now?: Date;
};

/** Bağlantı iptali: bağlantıyı REVOKED işaretle, bildirim at; tenant'ın tüm gönderimleri durur. */
export async function markConnectionRevoked(connectionId: string, error: string) {
  const c = await prisma.channelConnection.update({
    where: { id: connectionId },
    data: { status: "REVOKED", revokedAt: new Date(), lastError: error },
  });
  const users = await prisma.user.findMany({ where: { brandId: c.tenantId }, select: { id: true } });
  await prisma.notification.createMany({
    data: users.map((u) => ({ userId: u.id, title: "Kanal bağlantısı iptal edildi", body: "Erişim izni geri alınmış. Giden mesajlar durduruldu; bağlantıyı yeniden kurun.", href: "/marka/kanallar" })),
  });
  await notifyAdmins("Kanal bağlantısı iptal", `${c.provider} bağlantısı (${c.tenantId}) iptal edildi; giden kuyruk durduruldu.`, "/admin/kanallar");
}

/**
 * Tek gönderim hattı. Sıra: bağlantı → politika → pencere → template → İYS → gönder → maliyet.
 * Her kapı SERT BLOK'tur; uyarı değil.
 */
export async function sendMessage(input: SendInput) {
  const now = input.now ?? new Date();
  const conv = await prisma.conversation.findFirst({
    where: { id: input.conversationId, tenantId: input.tenantId },
    include: { contact: true },
  });
  if (!conv) throw new SendBlockedError("Konuşma bulunamadı.", "CONNECTION");

  const connection = await prisma.channelConnection.findFirst({
    where: { tenantId: input.tenantId, provider: conv.channel },
    orderBy: { createdAt: "desc" },
    include: { phoneNumbers: true },
  });
  if (!connection || connection.status !== "ACTIVE") {
    throw new SendBlockedError("Kanal bağlantısı aktif değil; gönderim durduruldu.", "CONNECTION");
  }

  const policy = await policyGate(input.tenantId, { recipientIsMinor: conv.contact.isMinor });
  if (!policy.ok) throw new SendBlockedError(policy.reason, "POLICY");

  if (input.text != null && asksForFinancialData(input.text) && input.byUserId == null) {
    throw new SendBlockedError("Agent yanıtı kart/finansal hesap bilgisi isteyemez.", "CONTENT");
  }

  let category: MessageCategory;
  let payload: SendPayload;
  let templateId: string | null = null;

  if (input.templateId) {
    if (conv.channel !== "WHATSAPP") throw new SendBlockedError("Template yalnız WhatsApp'ta kullanılır.", "TEMPLATE");
    const t = await prisma.messageTemplate.findFirst({ where: { id: input.templateId, tenantId: input.tenantId } });
    if (!t) throw new SendBlockedError("Template bulunamadı.", "TEMPLATE");
    const usable = canUseTemplate(t, now);
    if (!usable.ok) throw new SendBlockedError(usable.reason, "TEMPLATE");
    // Karma içerik bütün olarak değerlendirilir: promosyon unsuru varsa ticari ileti.
    const commercial = t.category === "marketing" || t.containsPromotion || containsPromotion(t.body) || (input.params ?? []).some(containsPromotion);
    if (commercial) {
      const gate = await canSendCommercial(input.tenantId, conv.contact.phoneE164 ?? conv.contact.externalId, "MESAJ");
      if (!gate.ok) throw new SendBlockedError(gate.reason, "IYS");
    }
    category = t.category === "marketing" || commercial ? "marketing" : t.category;
    templateId = t.id;
    payload = { kind: "template", to: conv.contact.phoneE164 ?? conv.contact.externalId, templateName: t.name, language: t.language, params: input.params };
  } else {
    const mode = composerMode(conv.channel, conv, now, input.byUserId != null);
    if (mode.mode !== "free_text") throw new SendBlockedError(mode.reason, "WINDOW_CLOSED");
    if (!input.text?.trim()) throw new SendBlockedError("Mesaj boş olamaz.", "CONTENT");
    category = "service";
    payload = { kind: "text", to: conv.contact.phoneE164 ?? conv.contact.externalId, body: input.text };
  }

  let externalId: string;
  try {
    const token = await vault().get(connection.tokenRef);
    if (conv.channel === "WHATSAPP") {
      const num = connection.phoneNumbers[0];
      if (!num) throw new SendBlockedError("WhatsApp numarası tanımlı değil.", "CONNECTION");
      externalId = (await metaClient().sendWhatsApp(num.phoneNumberId, token, payload)).messageId;
    } else {
      const igId = String((connection.externalIds as Record<string, unknown>).ig_user_id ?? (connection.externalIds as Record<string, unknown>).page_id ?? "");
      const tag = composerMode(conv.channel, conv, now, true).mode === "free_text" && !isOpen(conv.serviceWindowExpiresAt, now) ? "HUMAN_AGENT" : undefined;
      externalId = (await metaClient().sendInstagram(igId, token, conv.contact.externalId, input.text ?? "", tag)).messageId;
    }
  } catch (err) {
    if (isRevocationError(err)) {
      await markConnectionRevoked(connection.id, (err as Error).message);
      throw new SendBlockedError("Erişim belirteci iptal edilmiş; bağlantı yeniden kurulmalı.", "CONNECTION");
    }
    throw err;
  }

  return prisma.$transaction(async (tx) => {
    const msg = await tx.message.create({
      data: {
        tenantId: input.tenantId,
        conversationId: conv.id,
        externalId,
        direction: "OUTBOUND",
        body: input.text ?? null,
        templateId,
        category,
        status: "sent",
        statusAt: now,
        fromAi: input.byUserId == null,
        createdAt: now,
      },
    });
    if (conv.channel === "WHATSAPP" && connection.phoneNumbers[0]) {
      await recordMessageCost(tx, {
        tenantId: input.tenantId,
        phoneNumberId: connection.phoneNumbers[0].phoneNumberId,
        messageId: msg.id,
        category,
        recipient: conv.contact.phoneE164,
        inFepWindow: isOpen(conv.fepWindowExpiresAt, now),
        at: now,
      });
    }
    await bumpDailyStat(tx, input.tenantId, conv.channel, "OUTBOUND", now, 1);
    return msg;
  });
}

export async function bumpDailyStat(
  tx: Pick<typeof prisma, "$executeRaw">,
  tenantId: string,
  channel: string,
  direction: "INBOUND" | "OUTBOUND",
  at: Date,
  delta: number,
) {
  const day = at.toISOString().slice(0, 10);
  await tx.$executeRaw`
    INSERT INTO message_daily_stats ("tenantId", day, channel, direction, count)
    VALUES (${tenantId}, ${day}, ${channel}::"ChannelProvider", ${direction}::"MessageDirection", ${delta})
    ON CONFLICT ("tenantId", day, channel, direction) DO UPDATE SET count = GREATEST(0, message_daily_stats.count + ${delta})`;
}
