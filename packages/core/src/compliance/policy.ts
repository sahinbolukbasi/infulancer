import { prisma } from "../db";
import { getConfig } from "../config/store";

/**
 * Yasaklı / kısıtlı dikey politika motoru. Onboarding'de beyan + sürekli kontrol;
 * send pipeline'ı engelleyici bayrağı olan tenant'ın gönderimini durdurur.
 */
export async function declareVerticals(tenantId: string, verticalKeys: string[], at = new Date()) {
  const verticals = await getConfig("policy.prohibitedVerticals");
  await prisma.tenantSettings.upsert({
    where: { tenantId },
    create: { tenantId, prohibitedVerticalAck: true, prohibitedVerticalAt: at },
    update: { prohibitedVerticalAck: true, prohibitedVerticalAt: at },
  });
  for (const key of verticalKeys) {
    const v = verticals.find((x) => x.key === key);
    if (!v) continue;
    await prisma.tenantPolicyFlag.upsert({
      where: { tenantId_flag: { tenantId, flag: `vertical:${key}` } },
      create: { tenantId, flag: `vertical:${key}`, detail: v.label, blocking: v.banned },
      update: { detail: v.label, blocking: v.banned },
    });
  }
}

export async function flagTenant(tenantId: string, flag: string, detail: string, blocking = true) {
  await prisma.tenantPolicyFlag.upsert({
    where: { tenantId_flag: { tenantId, flag } },
    create: { tenantId, flag, detail, blocking },
    update: { detail, blocking },
  });
}

export async function policyGate(tenantId: string, opts: { regulated?: boolean; recipientIsMinor?: boolean } = {}) {
  const flags = await prisma.tenantPolicyFlag.findMany({ where: { tenantId } });
  const blocking = flags.find((f) => f.blocking);
  if (blocking) return { ok: false as const, reason: `Politika engeli: ${blocking.detail ?? blocking.flag}` };
  const regulated = opts.regulated ?? flags.some((f) => f.flag.startsWith("vertical:"));
  if (regulated && opts.recipientIsMinor) return { ok: false as const, reason: "Düzenlenmiş dikeyde 18 yaş altına mesaj gönderilemez." };
  return { ok: true as const };
}

/** Agent yanıtı ASLA kart/finansal hesap numarası istemez (Meta politikası). */
const ASK_FINANCIAL_RE = /(kart\s*numara|kredi\s*kart|cvv|cvc|son\s*kullanma\s*tarih|iban|hesap\s*numara)/iu;
export function asksForFinancialData(text: string): boolean {
  return ASK_FINANCIAL_RE.test(text);
}
