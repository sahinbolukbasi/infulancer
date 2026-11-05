import type { AdDraftStatus, AdPlatform } from "./drafts";

/**
 * Reklam asistanı yönlendirmesi: taslağın durumuna ve içeriğine bakıp Türkçe, uygulanabilir
 * sonraki adımları üretir. Deterministik ve yan etkisizdir (dış API yok); kural tabanlıdır,
 * böylece anahtarlar olmadan da çalışır. İleride LLM ile zenginleştirilebilir.
 */
export type GuidanceTone = "ipucu" | "uyari" | "sonraki_adim";
export type GuidanceItem = { tone: GuidanceTone; text: string };

export type DraftSnapshot = {
  platform: AdPlatform;
  objective: string;
  status: AdDraftStatus;
  dailyBudgetKurus: number;
  primaryText: string;
  hasAsset: boolean;
};

const MIN_RECOMMENDED_BUDGET = 5000; // 50 TL/gün

export function adGuidance(d: DraftSnapshot): GuidanceItem[] {
  const tips: GuidanceItem[] = [];

  if (!d.hasAsset) {
    tips.push({ tone: "uyari", text: "Reklama görsel eklenmedi. Creative'de bir görsel üretip taslağa bağlamak tıklama oranını artırır." });
  }
  if (d.primaryText.trim().length < 20) {
    tips.push({ tone: "uyari", text: "Reklam metni çok kısa. Faydayı ve net bir çağrıyı (ör. 'Hemen keşfet') ekleyin." });
  }
  if (d.primaryText.length > 125 && d.platform === "META") {
    tips.push({ tone: "ipucu", text: "Meta'da ilk 125 karakterden sonrası kısaltılır; en önemli mesajı başa alın." });
  }
  if (d.dailyBudgetKurus < MIN_RECOMMENDED_BUDGET) {
    tips.push({ tone: "ipucu", text: "Günlük bütçe düşük. Öğrenme aşaması için günde 50 TL ve üzeri önerilir." });
  }
  if (d.platform === "TIKTOK" && !/video|reels?|kısa/i.test(d.primaryText)) {
    tips.push({ tone: "ipucu", text: "TikTok'ta dikey video reklamlar çok daha iyi performans verir; video kreatif düşünün." });
  }
  if (d.objective === "SALES" && d.platform === "META") {
    tips.push({ tone: "ipucu", text: "Satış hedefi için Meta pikselinin ve dönüşüm olaylarının kurulu olması gerekir." });
  }

  switch (d.status) {
    case "TASLAK":
      tips.push({ tone: "sonraki_adim", text: "Hazırsanız taslağı onaya gönderin. Onay akışı gerçek harcama başlatmaz." });
      break;
    case "ONAY_BEKLIYOR":
      tips.push({ tone: "sonraki_adim", text: "Taslak onay kuyruğunda. Bir yönetici onayladığında yayın adımı (anahtarlar eklendiğinde) açılacak." });
      break;
    case "ONAYLANDI":
      tips.push({ tone: "sonraki_adim", text: "Onaylandı. Gerçek yayın için Meta/TikTok reklam hesabı bağlantısı gerekir; anahtarlar eklendiğinde buradan yayınlanabilecek." });
      break;
    case "REDDEDILDI":
      tips.push({ tone: "sonraki_adim", text: "Reddedildi. Not'taki gerekçeye göre düzenleyip yeniden onaya gönderebilirsiniz." });
      break;
  }
  return tips;
}
