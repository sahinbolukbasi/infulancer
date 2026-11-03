/**
 * WhatsApp messaging limit kademeleri: 250 → 2.000 → 10.000 → 100.000 → sınırsız (24 saatlik
 * hareketli pencerede TEKİL alıcı). Limit business portfolio düzeyindedir ve portföydeki tüm
 * numaralar arasında PAYLAŞILIR; numara eklemek kapasite eklemez.
 * API alanı: whatsapp_business_manager_messaging_limit (messaging_limit_tier deprecated).
 */
export const TIER_CAPACITY: Record<string, number> = {
  TIER_250: 250,
  TIER_2K: 2000,
  TIER_10K: 10000,
  TIER_100K: 100000,
  TIER_UNLIMITED: Number.POSITIVE_INFINITY,
};

export function tierCapacity(tier: string): number {
  return TIER_CAPACITY[tier] ?? 250;
}

export type SendPlanDay = { day: number; recipients: number };

/**
 * Kademeyi aşan kampanya REDDEDİLMEZ: günlere bölünür. `usedLast24h` = portföyde son 24 saatte
 * zaten mesaj alan tekil alıcı sayısı.
 */
export function planCampaign(totalRecipients: number, tier: string, usedLast24h = 0): { days: SendPlanDay[]; estimatedDays: number } {
  const cap = tierCapacity(tier);
  if (!Number.isFinite(cap)) return { days: [{ day: 1, recipients: totalRecipients }], estimatedDays: 1 };
  const days: SendPlanDay[] = [];
  let left = totalRecipients;
  let first = Math.max(0, cap - usedLast24h);
  let d = 1;
  while (left > 0) {
    const n = Math.min(left, d === 1 ? first : cap);
    if (n > 0) days.push({ day: d, recipients: n });
    left -= n;
    d++;
    first = cap;
  }
  return { days, estimatedDays: days.length ? days[days.length - 1]!.day : 0 };
}

/** phone_number_quality_update olayından limit alanını okur (yeni alan öncelikli). */
export function readLimitFromEvent(value: Record<string, unknown>): string | null {
  const v = value.whatsapp_business_manager_messaging_limit ?? value.current_limit ?? null;
  return typeof v === "string" ? v : null;
}
