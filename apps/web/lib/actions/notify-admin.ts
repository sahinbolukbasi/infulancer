"use server";
import { z } from "zod";
import { prisma } from "@infulancer/core/db";
import { audit } from "@infulancer/core/audit";
import { toAuditActor } from "@infulancer/core/access/actor";
import { NOTIF_EVENT_MAP } from "@infulancer/core/notify/catalog";
import { dispatchNotification, recipientsFromUserIds } from "@infulancer/core/notify/dispatch";
import { createShortLink } from "@infulancer/core/notify/shortlink";
import { DomainError } from "@infulancer/core/domain/errors";
import type { ActionState } from "@/lib/action-state";
import { attempt, revalidateAll, str } from "@/lib/action-utils";
import { assertPlatformAdmin, requireActor } from "@/lib/auth-guard";

const CHANNELS = ["INAPP", "EMAIL", "WHATSAPP", "INSTAGRAM"] as const;

/** Bir olayın kanallarını ve açık/kapalı durumunu kaydeder. */
export async function saveNotificationRuleAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const actor = await requireActor("ADMIN");
  assertPlatformAdmin(actor);
  return attempt(async () => {
    const eventKey = str(fd, "eventKey");
    if (!NOTIF_EVENT_MAP.has(eventKey)) throw new DomainError("BULUNAMADI", "Bilinmeyen olay.");
    const channels = fd.getAll("channels").map(String).filter((c) => (CHANNELS as readonly string[]).includes(c)) as typeof CHANNELS[number][];
    const enabled = str(fd, "enabled") !== "false";
    await prisma.notificationRule.upsert({
      where: { eventKey },
      create: { eventKey, channels, enabled },
      update: { channels, enabled },
    });
    await audit.append({ actor: toAuditActor(actor), action: "NOTIF_RULE_SAVED", entityType: "NotificationRule", entityId: eventKey, data: { channels, enabled } });
    revalidateAll();
    return { ok: true, message: "Kural kaydedildi." };
  });
}

/** Bir olay+kanal şablonunu kaydeder. */
export async function saveTemplateAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const actor = await requireActor("ADMIN");
  assertPlatformAdmin(actor);
  return attempt(async () => {
    const eventKey = str(fd, "eventKey");
    const channel = str(fd, "channel");
    if (!NOTIF_EVENT_MAP.has(eventKey)) throw new DomainError("BULUNAMADI", "Bilinmeyen olay.");
    if (!(CHANNELS as readonly string[]).includes(channel)) throw new DomainError("DOGRULAMA", "Geçersiz kanal.");
    const input = z.object({ subject: z.string().max(200).optional(), body: z.string().min(1, { error: "Metin gerekli." }).max(4000) }).parse({ subject: str(fd, "subject") || undefined, body: str(fd, "body") });
    await prisma.notificationTemplate.upsert({
      where: { eventKey_channel: { eventKey, channel: channel as typeof CHANNELS[number] } },
      create: { eventKey, channel: channel as typeof CHANNELS[number], subject: input.subject ?? null, body: input.body },
      update: { subject: input.subject ?? null, body: input.body },
    });
    await audit.append({ actor: toAuditActor(actor), action: "NOTIF_TEMPLATE_SAVED", entityType: "NotificationTemplate", entityId: `${eventKey}:${channel}`, data: {} });
    revalidateAll();
    return { ok: true, message: "Şablon kaydedildi." };
  });
}

/** Özel duyuru gönderir (seçilen hedef kitleye, ANNOUNCEMENT olayıyla). */
export async function sendAnnouncementAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const actor = await requireActor("ADMIN");
  assertPlatformAdmin(actor);
  return attempt(async () => {
    const message = str(fd, "message");
    const audience = str(fd, "audience"); // all | influencers | brands
    const link = str(fd, "link");
    if (message.trim().length < 3) throw new DomainError("DOGRULAMA", "Duyuru metni gerekli.");
    const where = audience === "influencers" ? { role: "INFLUENCER" as const, status: "ACTIVE" as const } : audience === "brands" ? { role: "BRAND" as const, status: "ACTIVE" as const } : { status: "ACTIVE" as const };
    const users = await prisma.user.findMany({ where, select: { id: true } });
    if (!users.length) throw new DomainError("BULUNAMADI", "Hedef kitlede kullanıcı yok.");
    const recipients = await recipientsFromUserIds(users.map((u) => u.id), () => ({ mesaj: message, link: link || "" }));
    const r = await dispatchNotification("ANNOUNCEMENT", recipients, { mesaj: message, link: link || "" });
    await audit.append({ actor: toAuditActor(actor), action: "ANNOUNCEMENT_SENT", entityType: "Notification", entityId: audience, data: { count: users.length } });
    revalidateAll();
    return { ok: true, message: `Duyuru ${users.length} kişiye işlendi (gönderilen: ${r.sent}, mock: ${r.mocked}).` };
  });
}

/** Kısa link oluşturur. */
export async function createShortLinkAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const actor = await requireActor("ADMIN");
  return attempt(async () => {
    const url = str(fd, "url");
    const label = str(fd, "label") || undefined;
    const link = await createShortLink(url, { label, createdByUserId: actor.userId });
    revalidateAll();
    return { ok: true, message: `Kısa link hazır: ${link.shortUrl}` };
  });
}
