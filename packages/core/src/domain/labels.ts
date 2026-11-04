import type {
  AgentCheck,
  AgentRunStatus,
  AssetDirection,
  AssetKind,
  CampaignStatus,
  ContentType,
  ContractStatus,
  DeliverableStatus,
  LedgerAccount,
  LedgerDirection,
  LedgerReason,
  MetricSource,
  MetricStage,
  PayoutStatus,
  Platform,
  ReviewDecision,
  Role,
  Severity,
  TaxStatus,
  UploadStatus,
  UsageChannel,
} from "../generated/prisma/enums";

// Tüm enum'ların Türkçe etiketleri — arayüz yalnızca buradan okur.

export const roleLabels: Record<Role, string> = {
  ADMIN: "Admin",
  AGENCY: "Ajans",
  BRAND: "Marka",
  INFLUENCER: "Influencer",
};

export const taxStatusLabels: Record<TaxStatus, string> = {
  FATURA: "Fatura keser",
  SERBEST_MESLEK_MAKBUZU: "Serbest meslek makbuzu",
  STOPAJLI: "Stopajlı ödeme",
};

export const platformLabels: Record<Platform, string> = {
  INSTAGRAM: "Instagram",
  TIKTOK: "TikTok",
  YOUTUBE: "YouTube",
};

export const contentTypeLabels: Record<ContentType, string> = {
  REELS: "Reels",
  STORY: "Story",
  CAROUSEL: "Carousel",
  FEED: "Feed",
  LIVE: "Canlı yayın",
  VIDEO: "Video",
  PHOTO: "Fotoğraf",
  SHORTS: "Shorts",
  COMMUNITY: "Topluluk gönderisi",
};

export const campaignStatusLabels: Record<CampaignStatus, string> = {
  TASLAK: "Taslak",
  AKTIF: "Aktif",
  KAPANDI: "Kapandı",
  IPTAL: "İptal",
};

export const contractStatusLabels: Record<ContractStatus, string> = {
  TEKLIF: "Teklif",
  KABUL: "Kabul",
  RED: "Red",
};

export const deliverableStatusLabels: Record<DeliverableStatus, string> = {
  TASLAK: "Taslak",
  ATANDI: "Atandı",
  BRIEF_GONDERILDI: "Brief gönderildi",
  ICERIK_YUKLENDI: "İçerik yüklendi",
  REVIZYON: "Revizyon",
  ONAYLANDI: "Onaylandı",
  YAYINLANDI: "Yayınlandı",
  METRIK_BEKLIYOR: "Metrik bekliyor",
  TAMAMLANDI: "Tamamlandı",
  IPTAL: "İptal",
};

export const reviewDecisionLabels: Record<ReviewDecision, string> = {
  ONAY: "Onaylıyorum",
  REVIZYON: "Revizyon istiyorum",
};

export const assetKindLabels: Record<AssetKind, string> = {
  BRIEF_PDF: "Brief PDF",
  MARKA_LOGO: "Marka logosu",
  MARKA_FONT: "Marka fontu",
  ORNEK_CEKIM: "Örnek çekim",
  URUN_FOTO: "Ürün fotoğrafı",
  ONAYLI_CAPTION: "Onaylı caption",
  TASLAK: "Taslak içerik",
  HAM_DOSYA: "Ham dosya",
  METRIK_SS: "Metrik ekran görüntüsü",
  DIGER: "Diğer",
};

export const assetDirectionLabels: Record<AssetDirection, string> = {
  AJANS_TO_INFLUENCER: "Ajans → Influencer",
  INFLUENCER_TO_AJANS: "Influencer → Ajans",
};

export const usageChannelLabels: Record<UsageChannel, string> = {
  ORGANIK: "Sadece organik",
  PAID_DAHIL: "Paid reklam dahil",
};

export const uploadStatusLabels: Record<UploadStatus, string> = {
  BEKLIYOR: "Yükleniyor",
  TAMAM: "Yüklendi",
};

export const metricStageLabels: Record<MetricStage, string> = {
  H24: "24. saat",
  D7: "7. gün",
  D30: "30. gün",
  ARA: "Ara ölçüm",
};

export const metricSourceLabels: Record<MetricSource, string> = {
  MANUEL: "Manuel giriş",
  EKRAN_GORUNTUSU: "Ekran görüntüsü",
  API: "Platform API",
  MARKA: "Marka verisi",
};

export type TrustLevel = "YUKSEK" | "ORTA" | "DUSUK";

export const metricSourceTrust: Record<MetricSource, TrustLevel> = {
  API: "YUKSEK",
  MARKA: "YUKSEK",
  EKRAN_GORUNTUSU: "ORTA",
  MANUEL: "DUSUK",
};

export const trustLevelLabels: Record<TrustLevel, string> = {
  YUKSEK: "Yüksek güven",
  ORTA: "Orta güven",
  DUSUK: "Düşük güven",
};

export const agentCheckLabels: Record<AgentCheck, string> = {
  BRIEF_UYUM: "Brief uyum",
  YAYIN_KONTROL: "Yayın kontrol",
  SILINME_KONTROL: "Silinme kontrol",
  METRIK_TUTARLILIK: "Metrik tutarlılık",
  SAHTE_ETKILESIM: "Sahte etkileşim",
  HEDEF_PROJEKSIYON: "Hedef projeksiyon",
  KAMPANYA_OZETI: "Kampanya özeti",
  INFLUENCER_ONERI: "Influencer öneri",
  MARKA_CAKISMASI: "Marka çakışması",
  STORY_HATIRLATMA: "Story hatırlatma",
};

export const severityLabels: Record<Severity, string> = {
  BILGI: "Bilgi",
  UYARI: "Uyarı",
  KRITIK: "Kritik",
};

export const severityRank: Record<Severity, number> = {
  KRITIK: 3,
  UYARI: 2,
  BILGI: 1,
};

export const agentRunStatusLabels: Record<AgentRunStatus, string> = {
  ACIK: "Açık",
  ONAYLANDI: "Onaylandı",
  EZILDI: "Ezildi",
};

export const ledgerAccountLabels: Record<LedgerAccount, string> = {
  INFLUENCER_PAYABLE: "Influencer borcu",
  AGENCY_EXPENSE: "Ajans gideri",
  AGENCY_BANK: "Ajans banka",
};

export const ledgerDirectionLabels: Record<LedgerDirection, string> = {
  DEBIT: "Borç",
  CREDIT: "Alacak",
};

export const ledgerReasonLabels: Record<LedgerReason, string> = {
  HAKEDIS: "Hakediş",
  ODEME: "Ödeme",
  DUZELTME: "Düzeltme",
};

export const payoutStatusLabels: Record<PayoutStatus, string> = {
  TALEP_EDILDI: "Talep edildi",
  ONAYLANDI: "Onaylandı",
  ODEME_LISTESINDE: "Ödeme listesinde",
  GONDERILDI: "Gönderildi",
  REDDEDILDI: "Reddedildi",
};

/** Kuruş → "12.500,00 ₺" */
export function formatKurus(kurus: number): string {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    minimumFractionDigits: 2,
  }).format(kurus / 100);
}
