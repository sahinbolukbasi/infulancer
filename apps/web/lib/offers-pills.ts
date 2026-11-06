import type { PillTone } from "@/components/luma/primitives";

/** Teklif, başvuru ve çağrı durumları için ortak etiket + ton (marka, influencer ve ajans ekranları). */
export const offerPill: Record<string, { label: string; tone: PillTone }> = {
  GONDERILDI: { label: "Yanıt bekliyor", tone: "amber" },
  KABUL: { label: "Kabul edildi", tone: "green" },
  KAMPANYAYA_EKLENDI: { label: "Kampanyada", tone: "violet" },
  RED: { label: "Reddedildi", tone: "red" },
  GERI_CEKILDI: { label: "Geri çekildi", tone: "gray" },
  SURESI_DOLDU: { label: "Süresi doldu", tone: "gray" },
};
export const applicationPill: Record<string, { label: string; tone: PillTone }> = {
  BASVURULDU: { label: "Yeni başvuru", tone: "amber" },
  INCELENIYOR: { label: "İnceleniyor", tone: "violet" },
  KABUL: { label: "Kabul · teklif oldu", tone: "green" },
  RED: { label: "Reddedildi", tone: "red" },
};
export const callPill: Record<string, { label: string; tone: PillTone }> = {
  TASLAK: { label: "Taslak", tone: "gray" },
  ACIK: { label: "Başvuruya açık", tone: "green" },
  KAPALI: { label: "Kapandı", tone: "amber" },
};
