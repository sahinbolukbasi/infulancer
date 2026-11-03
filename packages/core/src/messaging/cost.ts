import { prisma, type Tx } from "../db";
import { getConfig } from "../config/store";
import type { MessageCategory } from "../generated/prisma/enums";

/**
 * Mesaj maliyet defteri. Yalnız TESLİM EDİLEN işletme→kullanıcı mesajları ücretlidir.
 * - FEP penceresi (CTWA, 7 gün) içindeki mesajlar ücretsiz (Meta Business Agent hariç).
 * - Numara başına ayda 1.000 ücretsiz servis mesajı (devretmez, numaralar arasında paylaşılmaz).
 * - Oranlar country_rates tablosundan (config); Türkiye oranları DOĞRULANMADI.
 */
const DIAL_TO_COUNTRY: [string, string][] = [
  ["+90", "TR"], ["+49", "DE"], ["+31", "NL"], ["+33", "FR"], ["+44", "GB"], ["+1", "US"], ["+971", "AE"], ["+7", "RU"],
];

export function countryOf(e164: string | null | undefined): string {
  if (!e164) return "TR";
  const hit = DIAL_TO_COUNTRY.filter(([p]) => e164.startsWith(p)).sort((a, b) => b[0].length - a[0].length)[0];
  return hit?.[1] ?? "XX";
}

export async function rateFor(country: string, category: MessageCategory, at: Date, db: Tx = prisma) {
  const r = await db.countryRate.findFirst({
    where: { countryCode: country, category, effectiveFrom: { lte: at } },
    orderBy: { effectiveFrom: "desc" },
  });
  return r ? { rate: Number(r.rateUsd), verified: r.verified } : { rate: 0, verified: false };
}

function monthStart(at: Date): Date {
  return new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), 1));
}

export async function freeServiceUsed(phoneNumberId: string, at: Date, db: Tx = prisma): Promise<number> {
  return db.messageCostLedger.count({
    where: { phoneNumberId, category: "service", freeTierConsumed: true, billedAt: { gte: monthStart(at) } },
  });
}

export async function recordMessageCost(
  db: Tx,
  input: { tenantId: string; phoneNumberId: string; messageId: string; category: MessageCategory; recipient: string | null; inFepWindow: boolean; at: Date },
) {
  const country = countryOf(input.recipient);
  const { rate } = await rateFor(country, input.category, input.at, db);
  const free = await getConfig("whatsapp.freeServicePerNumberPerMonth");
  let freeTier = false;
  let metaRate = rate;
  if (input.inFepWindow && input.category !== "meta_business_agent") {
    metaRate = 0;
  } else if (input.category === "service" && (await freeServiceUsed(input.phoneNumberId, input.at, db)) < free) {
    freeTier = true;
    metaRate = 0;
  }
  const { messageMarkupPct } = await getConfig("pricing.markup");
  return db.messageCostLedger.create({
    data: {
      tenantId: input.tenantId,
      phoneNumberId: input.phoneNumberId,
      messageId: input.messageId,
      category: input.category,
      recipientCountry: country,
      metaRateUsd: metaRate,
      platformMarkupUsd: (metaRate * messageMarkupPct) / 100,
      freeTierConsumed: freeTier,
      inFepWindow: input.inFepWindow,
      billedAt: input.at,
    },
  });
}

/** Dashboard: kalan ücretsiz servis kotası ve tahmini bitiş. */
export async function freeTierStatus(phoneNumberId: string, now = new Date()) {
  const free = await getConfig("whatsapp.freeServicePerNumberPerMonth");
  const used = await freeServiceUsed(phoneNumberId, now);
  const start = monthStart(now);
  const elapsedDays = Math.max(1, (now.getTime() - start.getTime()) / 86_400_000);
  const perDay = used / elapsedDays;
  const remaining = Math.max(0, free - used);
  const exhaustAt = perDay > 0 ? new Date(now.getTime() + (remaining / perDay) * 86_400_000) : null;
  const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return { free, used, remaining, exhaustAt: exhaustAt && exhaustAt < monthEnd ? exhaustAt : null };
}
