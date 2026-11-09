import { prisma } from "../db";
import { NOTIF_EVENT_MAP, renderTemplate, type NotifChannel } from "./catalog";
import { sendEmail, sendInstagramNotify, sendWhatsAppNotify } from "./channels";
import { renderBrandedEmail } from "./email-template";
import { localizedTemplate } from "./catalog-i18n";
import { isLocale, type Locale } from "../i18n/regions";

/**
 * Bir bildirim olayını alıcıya/alıcılara gönderir. Kural (NotificationRule) hangi kanalların
 * açık olduğunu belirler; şablon DB'de varsa onu, yoksa katalog varsayılanını kullanır.
 * Her kanal denemesi NotificationLog'a yazılır (gerçek gönderim yoksa MOCKED).
 */
export type Recipient = {
  userId?: string | null;
  email?: string | null;
  phone?: string | null;
  instagram?: string | null;
  /** Alıcının arayüz dili (bildirimler bu dilde). */
  locale?: string | null;
  /** Şablon değişkenleri (ör. { ad, baslik, link }). */
  vars?: Record<string, string>;
};

async function resolveChannels(eventKey: string): Promise<NotifChannel[]> {
  const rule = await prisma.notificationRule.findUnique({ where: { eventKey } });
  if (rule) return rule.enabled ? (rule.channels as NotifChannel[]) : [];
  return (NOTIF_EVENT_MAP.get(eventKey)?.defaultChannels ?? ["INAPP"]) as NotifChannel[];
}

async function resolveTemplate(eventKey: string, channel: NotifChannel, locale: Locale): Promise<{ subject?: string | null; body: string } | null> {
  // Admin panelinden özelleştirilmiş şablon (DB) her zaman önceliklidir.
  const row = await prisma.notificationTemplate.findUnique({ where: { eventKey_channel: { eventKey, channel } } });
  if (row) return { subject: row.subject, body: row.body };
  // Alıcının dilinde katalog çevirisi; yoksa Türkçe kaynak.
  const loc = localizedTemplate(eventKey, channel, locale);
  if (loc) return { subject: loc.subject ?? null, body: loc.body };
  const def = NOTIF_EVENT_MAP.get(eventKey)?.templates[channel];
  return def ? { subject: def.subject ?? null, body: def.body } : null;
}

export async function dispatchNotification(eventKey: string, recipients: Recipient[], sharedVars: Record<string, string> = {}): Promise<{ sent: number; mocked: number; skipped: number }> {
  const channels = await resolveChannels(eventKey);
  let sent = 0;
  let mocked = 0;
  let skipped = 0;

  for (const r of recipients) {
    const vars = { ...sharedVars, ...(r.vars ?? {}) };
    const locale: Locale = isLocale(r.locale) ? r.locale : "tr";
    for (const channel of channels) {
      const tpl = await resolveTemplate(eventKey, channel, locale);
      if (!tpl) continue;
      const subject = tpl.subject ? renderTemplate(tpl.subject, vars) : null;
      const body = renderTemplate(tpl.body, vars);
      let status: "SENT" | "MOCKED" | "FAILED" | "SKIPPED" = "SKIPPED";
      let error: string | null = null;
      let toAddress: string | null = null;

      try {
        if (channel === "INAPP") {
          if (r.userId) {
            await prisma.notification.create({ data: { userId: r.userId, title: subject ?? "Bildirim", body, href: vars.link ?? null } });
            status = "SENT";
          } else {
            status = "SKIPPED";
          }
        } else if (channel === "EMAIL") {
          if (r.email) { toAddress = r.email; const html = renderBrandedEmail({ subject: subject ?? "Bildirim", body, ctaUrl: vars.link ?? null, locale }); const res = await sendEmail(r.email, subject ?? "Bildirim", body, html); status = res.status; error = res.error ?? null; }
          else status = "SKIPPED";
        } else if (channel === "WHATSAPP") {
          if (r.phone) { toAddress = r.phone; const res = await sendWhatsAppNotify(r.phone, body); status = res.status; error = res.error ?? null; }
          else status = "SKIPPED";
        } else if (channel === "INSTAGRAM") {
          if (r.instagram) { toAddress = r.instagram; const res = await sendInstagramNotify(r.instagram, body); status = res.status; error = res.error ?? null; }
          else status = "SKIPPED";
        }
      } catch (e) {
        status = "FAILED";
        error = (e as Error).message;
      }

      if (status === "SENT") sent++;
      else if (status === "MOCKED") mocked++;
      else skipped++;

      await prisma.notificationLog.create({
        data: { eventKey, channel, userId: r.userId ?? null, toAddress, subject, body, status, error },
      });
    }
  }
  return { sent, mocked, skipped };
}

/** Kullanıcı id'lerinden alıcı listesi kurar (email/phone/instagram otomatik çeker). */
export async function recipientsFromUserIds(userIds: string[], perUserVars?: (userId: string) => Record<string, string>): Promise<Recipient[]> {
  const users = await prisma.user.findMany({ where: { id: { in: [...new Set(userIds)] } }, select: { id: true, email: true, phone: true, name: true, locale: true } });
  return users.map((u) => ({ userId: u.id, email: u.email, phone: u.phone, locale: u.locale, vars: { ad: u.name ?? "", ...(perUserVars?.(u.id) ?? {}) } }));
}
