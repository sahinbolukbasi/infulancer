import type { Tx } from "../db";
import { countryLabel, currencyOf } from "../i18n/regions";
import { DomainError } from "./errors";

/**
 * Influencer ülke ayrımı: kampanyaya yalnız hedef ülkelerde kayıtlı ve kampanyanın para biriminde
 * ödenebilen influencer atanır (hakediş ve ödeme çevrimsiz, tek para biriminde kalır).
 * Hedef ülke girilmemiş eski kampanyalarda yalnız para birimi eşleşmesi aranır.
 */
export async function assertInfluencerFitsCampaign(db: Tx, campaignId: string, influencerId: string): Promise<void> {
  const [c, i] = await Promise.all([
    db.campaign.findUnique({ where: { id: campaignId }, select: { targetCountries: true, currency: true } }),
    db.influencer.findUnique({ where: { id: influencerId }, select: { name: true, country: true } }),
  ]);
  if (!c || !i) return;
  if (c.targetCountries.length && !c.targetCountries.includes(i.country)) {
    throw new DomainError("KURAL_IHLALI", `${i.name} ${countryLabel(i.country)} kayıtlı; bu kampanya ${c.targetCountries.map((x) => countryLabel(x)).join(", ")} için.`);
  }
  if (currencyOf(i.country) !== c.currency) {
    throw new DomainError("KURAL_IHLALI", `${i.name} ${currencyOf(i.country)} ile ödenir; kampanya para birimi ${c.currency}. Bu bölge için ayrı kampanya açın.`);
  }
}
