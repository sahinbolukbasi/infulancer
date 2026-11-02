import type { CampaignStatus, ContractStatus, DeliverableStatus } from "@infulancer/core/enums";
import type { StatusTone } from "@/components/ui/status";

/** Durum → nokta tonu (renk yerine opaklık; kırmızı yalnız kritik). */
export function deliverableTone(status: DeliverableStatus, opts: { overdue?: boolean; violation?: boolean } = {}): StatusTone {
  if (opts.violation) return "critical";
  if (status === "IPTAL" || status === "TAMAMLANDI") return "passive";
  if (opts.overdue) return "active";
  if (status === "ICERIK_YUKLENDI" || status === "REVIZYON" || status === "ONAYLANDI" || status === "METRIK_BEKLIYOR") return "active";
  return "muted";
}

export function campaignTone(status: CampaignStatus): StatusTone {
  return status === "AKTIF" ? "active" : status === "TASLAK" ? "muted" : "passive";
}

export function contractTone(status: ContractStatus): StatusTone {
  return status === "KABUL" ? "active" : status === "TEKLIF" ? "muted" : "passive";
}

/** RED: influencer seçime döner. */
export const contractUiLabels: Record<ContractStatus, string> = {
  TEKLIF: "Teklif bekliyor",
  KABUL: "Kabul edildi",
  RED: "Seçime döndü",
};
