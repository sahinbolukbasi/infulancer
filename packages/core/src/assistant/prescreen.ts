import { prisma } from "../db";

/**
 * Creator başvuru / ön eleme agent'ı: "işbirliği", "collab", "kampanya" anahtar kelimeleriyle tetiklenir;
 * kullanıcı adı, takipçi, kategori, fiyat beklentisi, media kit ve iletişim bilgisini toplar;
 * influencer havuzuna source=inbound_dm adayı yazar. (Kampanya trafiği creator havuzuna DM'den akar.)
 */
const TRIGGER_RE = /(işbirliği|iş birliği|collab|kampanya|reklam teklifi)/iu;

export function extractCandidateFields(text: string) {
  const handle = text.match(/@([a-z0-9._]{2,30})/i)?.[1] ?? null;
  const fm = text.match(/(\d+(?:[.,]\d+)?)\s*(k|bin|m|milyon)?\s*takip/iu);
  let followers: number | null = null;
  if (fm) {
    const n = Number(fm[1]!.replace(",", "."));
    const mult = /m|milyon/i.test(fm[2] ?? "") ? 1_000_000 : /k|bin/i.test(fm[2] ?? "") ? 1000 : 1;
    followers = Math.round(n * mult);
  }
  const price = text.match(/(\d[\d.,]*)\s*(tl|₺|try)/iu)?.[0] ?? null;
  const mediaKit = text.match(/https?:\/\/\S+/i)?.[0] ?? null;
  const email = text.match(/[^\s@]+@[^\s@]+\.[a-z]{2,}/i)?.[0] ?? null;
  const category = text.match(/kategori[:\s]+([\p{L} ]{3,30})/iu)?.[1]?.trim() ?? null;
  return { handle, followers, priceExpectation: price, mediaKitUrl: mediaKit, contact: email, category };
}

export async function prescreenCreator(tenantId: string, conversationId: string, text: string): Promise<{ handled: boolean }> {
  const agent = await prisma.agentConfig.findFirst({ where: { tenantId, agentId: "creator_prescreen", enabled: true } });
  if (!agent) return { handled: false };
  const existing = await prisma.influencerCandidate.findFirst({ where: { tenantId, conversationId } });
  if (!existing && !TRIGGER_RE.test(text)) return { handled: false };
  const f = extractCandidateFields(text);
  if (existing) {
    await prisma.influencerCandidate.update({
      where: { id: existing.id },
      data: Object.fromEntries(Object.entries(f).filter(([, v]) => v != null)),
    });
  } else {
    await prisma.influencerCandidate.create({ data: { tenantId, conversationId, source: "inbound_dm", ...f } });
  }
  await prisma.conversation.update({ where: { id: conversationId }, data: { agentKey: "creator_prescreen" } });
  return { handled: true };
}
