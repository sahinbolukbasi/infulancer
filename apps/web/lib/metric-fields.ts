import type { Platform } from "@infulancer/core/enums";

/**
 * Metrik formu alan tanımları. Platform alanları core platformMetricSchemas ile
 * birebir eşleşir; "ratio" alanları formda yüzde girilir, 0..1 saklanır.
 */
export type MetricFieldKind = "count" | "ratio" | "decimal" | "signed";
export type MetricField = { key: string; label: string; kind: MetricFieldKind };

export const commonMetricFields: MetricField[] = [
  { key: "reach", label: "Erişim (reach)", kind: "count" },
  { key: "impressions", label: "Gösterim", kind: "count" },
  { key: "likes", label: "Beğeni", kind: "count" },
  { key: "comments", label: "Yorum", kind: "count" },
  { key: "saves", label: "Kaydetme", kind: "count" },
  { key: "shares", label: "Paylaşım", kind: "count" },
  { key: "clicks", label: "Link tıklama", kind: "count" },
];

export const platformMetricFields: Record<Platform, MetricField[]> = {
  INSTAGRAM: [
    { key: "profileClicks", label: "Profil tıklama", kind: "count" },
    { key: "linkStickerTaps", label: "Link sticker dokunma", kind: "count" },
    { key: "follows", label: "Takip", kind: "count" },
    { key: "replies", label: "Yanıt (Story)", kind: "count" },
    { key: "exits", label: "Çıkış (Story)", kind: "count" },
    { key: "plays", label: "Oynatma (Reels)", kind: "count" },
  ],
  TIKTOK: [
    { key: "views", label: "İzlenme", kind: "count" },
    { key: "watchTimeSec", label: "Toplam izlenme süresi (sn)", kind: "count" },
    { key: "avgWatchTimeSec", label: "Ortalama izlenme (sn)", kind: "decimal" },
    { key: "completionRate", label: "Tamamlanma oranı (%)", kind: "ratio" },
    { key: "profileViews", label: "Profil görüntüleme", kind: "count" },
  ],
  YOUTUBE: [
    { key: "views", label: "İzlenme", kind: "count" },
    { key: "watchTimeMin", label: "İzlenme süresi (dk)", kind: "count" },
    { key: "avgViewDurationSec", label: "Ortalama izlenme süresi (sn)", kind: "decimal" },
    { key: "ctr", label: "Gösterim tıklama oranı (%)", kind: "ratio" },
    { key: "subscriberDelta", label: "Abone değişimi", kind: "signed" },
  ],
};
