import type { Platform } from "../generated/prisma/enums";

/** Handle/slug'ı UTM için güvenli, küçük harfli ASCII'ye çevirir. */
export function utmSafe(value: string): string {
  return value
    .toLocaleLowerCase("tr")
    .replace(/ı/g, "i")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/^@/, "")
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Deliverable için UTM'li bağlantı üretir.
 * utm_source=platform, utm_medium=influencer, utm_campaign=kampanya slug'ı,
 * utm_content=handle, utm_id=deliverable id. Mevcut sorgu parametreleri korunur.
 */
export function buildUtmLink(
  base: string,
  input: { platform: Platform; influencerHandle: string; campaignSlug: string; deliverableId: string },
): string {
  const url = new URL(base);
  url.searchParams.set("utm_source", input.platform.toLowerCase());
  url.searchParams.set("utm_medium", "influencer");
  url.searchParams.set("utm_campaign", utmSafe(input.campaignSlug));
  url.searchParams.set("utm_content", utmSafe(input.influencerHandle));
  url.searchParams.set("utm_id", input.deliverableId);
  return url.toString();
}
