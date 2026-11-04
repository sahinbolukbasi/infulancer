import { contentTypeLabels, formatKurus, platformLabels } from "@infulancer/core/domain/labels";
import { offerStatusLabels, type OfferItem, type OfferStatus } from "@infulancer/core/domain/offers";
import { fmtDate } from "@/lib/time";

/** Teklif kalemlerini "2× Instagram Reels · 30.000 TL" biçiminde özetler. */
export function itemsSummary(items: unknown): string[] {
  if (!Array.isArray(items)) return [];
  return (items as OfferItem[]).map(
    (i) => `${i.qty}× ${platformLabels[i.platform as keyof typeof platformLabels] ?? i.platform} ${contentTypeLabels[i.contentType as keyof typeof contentTypeLabels] ?? i.contentType} · ${formatKurus(i.priceKurus)}`,
  );
}
export function statusLabel(s: string): string {
  return offerStatusLabels[s as OfferStatus] ?? s;
}
export function statusTone(s: string): "active" | "muted" | "critical" | "passive" {
  return s === "KABUL" || s === "KAMPANYAYA_EKLENDI" ? "active" : s === "GONDERILDI" ? "muted" : s === "RED" ? "critical" : "passive";
}
export function expiryText(expiresAt: Date, status: string): string {
  return status === "GONDERILDI" ? `Son yanıt ${fmtDate(expiresAt)}` : "";
}
