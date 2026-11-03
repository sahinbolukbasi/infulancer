import { prisma } from "../db";
import type { TemplateQuality, TemplateStatus } from "../generated/prisma/enums";
import { getConfig } from "../config/store";
import { notifyAdmins } from "../agents/common";

/**
 * Template yaşam döngüsü: In Review → Rejected | Active(kalite) → Paused → Disabled → Appeal Requested.
 * Pause eskalasyonu: 1. = 3 saat, 2. = 6 saat, 3. duraklatmada DISABLE.
 * Kalite: Medium → gönderim hızı %50, tenant uyarısı; Low → gönderim durur, admin eskalasyonu.
 */
export function mapStatusEvent(event: string): TemplateStatus | null {
  const e = event.toUpperCase();
  if (e === "APPROVED" || e === "REINSTATED") return "ACTIVE";
  if (e === "REJECTED") return "REJECTED";
  if (e === "PENDING") return "IN_REVIEW";
  if (e === "PAUSED") return "PAUSED";
  if (e === "DISABLED") return "DISABLED";
  if (e === "IN_APPEAL" || e === "APPEAL_REQUESTED") return "APPEAL_REQUESTED";
  return null;
}

/** Meta kalite puanı (GREEN/YELLOW/RED/UNKNOWN veya HIGH/MEDIUM/LOW). */
export function mapQuality(score: string): TemplateQuality {
  const s = score.toUpperCase();
  if (s === "GREEN" || s === "HIGH") return "HIGH";
  if (s === "YELLOW" || s === "MEDIUM") return "MEDIUM";
  if (s === "RED" || s === "LOW") return "LOW";
  return "PENDING";
}

export function rateFactorFor(q: TemplateQuality): number {
  return q === "MEDIUM" ? 0.5 : q === "LOW" ? 0 : 1;
}

export async function applyTemplateStatus(templateId: string, status: TemplateStatus, at: Date): Promise<void> {
  const t = await prisma.messageTemplate.findUnique({ where: { id: templateId } });
  if (!t) return;
  if (t.statusUpdatedAt && t.statusUpdatedAt > at) return; // last-write-wins
  if (status === "PAUSED") {
    const hours = await getConfig("whatsapp.templatePauseHours");
    const count = t.pauseCount + 1;
    if (count >= hours.length + 1) {
      await prisma.messageTemplate.update({ where: { id: t.id }, data: { status: "DISABLED", pauseCount: count, pausedUntil: null, statusUpdatedAt: at } });
      await notifyAdmins("Template devre dışı", `${t.name}: 3. duraklatma, template kalıcı olarak devre dışı.`, "/admin/kanallar");
      return;
    }
    await prisma.messageTemplate.update({
      where: { id: t.id },
      data: { status: "PAUSED", pauseCount: count, pausedUntil: new Date(at.getTime() + hours[count - 1]! * 3_600_000), statusUpdatedAt: at },
    });
    return;
  }
  await prisma.messageTemplate.update({ where: { id: t.id }, data: { status, statusUpdatedAt: at, ...(status === "ACTIVE" ? { pausedUntil: null } : {}) } });
}

export async function applyTemplateQuality(templateId: string, quality: TemplateQuality): Promise<void> {
  const t = await prisma.messageTemplate.update({
    where: { id: templateId },
    data: { quality, sendRateFactor: rateFactorFor(quality) },
  });
  if (quality === "MEDIUM") {
    await notifyAdmins("Template kalitesi düştü", `${t.name}: kalite Orta — gönderim hızı %50'ye kısıldı.`, "/admin/kanallar");
  } else if (quality === "LOW") {
    await notifyAdmins("Template gönderimi durduruldu", `${t.name}: kalite Düşük — gönderim otomatik durduruldu, inceleme gerekli.`, "/admin/kanallar");
  }
}

export type TemplateUsability = { ok: true; rateFactor: number } | { ok: false; reason: string };

export function canUseTemplate(
  t: { status: TemplateStatus; quality: TemplateQuality; pausedUntil: Date | null; sendRateFactor: unknown },
  now: Date,
): TemplateUsability {
  // Duraklatma süresi dolsa bile Meta 'REINSTATED' gönderene kadar kapalı tutulur.
  void now;
  if (t.status !== "ACTIVE") {
    return { ok: false, reason: `Template ${statusLabel[t.status]} durumunda; gönderilemez.` };
  }
  if (t.quality === "LOW") return { ok: false, reason: "Template kalitesi Düşük: gönderim otomatik durduruldu." };
  return { ok: true, rateFactor: Number(t.sendRateFactor) };
}

export const statusLabel: Record<TemplateStatus, string> = {
  IN_REVIEW: "İncelemede",
  REJECTED: "Reddedildi",
  ACTIVE: "Aktif",
  PAUSED: "Duraklatıldı",
  DISABLED: "Devre dışı",
  APPEAL_REQUESTED: "İtiraz edildi",
};

export const qualityLabel: Record<TemplateQuality, string> = { PENDING: "Bekliyor", HIGH: "Yüksek", MEDIUM: "Orta", LOW: "Düşük" };

/**
 * Template içerik sınıflandırması: karma içerik bütün olarak değerlendirilir — herhangi bir
 * promosyon unsuru tüm mesajı ticari elektronik ileti yapar ("utility + indirim kuponu" ⇒ ticari).
 */
const PROMO_RE = /(indirim|kupon|kampanya|fırsat|%\s?\d+|\d+\s?%|promosyon|hediye|ücretsiz kargo|özel teklif|son gün|kaçırma|satın al)/iu;
export function containsPromotion(body: string): boolean {
  return PROMO_RE.test(body);
}
