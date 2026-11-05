import { envStr } from "../env";
import { getConfig } from "../config/store";

/**
 * Entegrasyon durumu: hangi dış servisin canlı (anahtar/erişim var) hangisinin mock (anahtar
 * bekliyor) olduğunu TEK YERDEN raporlar. Admin paneli bunu gösterir; "mock mode" hangi
 * özellikleri etkiliyor net olsun. Gizli değer OKUNMAZ; yalnız anahtarın VAR/YOK bilgisi döner.
 */
export type IntegrationMode = "canli" | "mock" | "erisim_bekliyor";

export type IntegrationStatus = {
  key: string;
  name: string;
  mode: IntegrationMode;
  detail: string;
  /** Canlıya geçmek için gereken adım (mock/erişim bekliyorsa). */
  nextStep?: string;
};

function keyPresent(name: string): boolean {
  const v = envStr(name, "");
  return v.trim().length > 0;
}

export async function integrationStatuses(): Promise<IntegrationStatus[]> {
  const features = await getConfig("features");
  const llmProvider = envStr("LLM_PROVIDER", "mock");

  const out: IntegrationStatus[] = [];

  // Creative — fal.ai
  const falLive = keyPresent("FAL_KEY") || keyPresent("FAL_API_KEY");
  out.push({
    key: "fal",
    name: "Creative görsel/video (fal.ai)",
    mode: falLive ? "canli" : "mock",
    detail: falLive ? "fal.ai anahtarı tanımlı; gerçek üretim açık." : "Anahtar yok; üretimler mock (örnek çıktı) olarak çalışır.",
    nextStep: falLive ? undefined : "FAL_KEY değerini infulancer-prod/integrations secret'ına ekleyin.",
  });

  // LLM / Asistan — Bedrock Converse
  const bedrockLive = llmProvider === "bedrock";
  out.push({
    key: "bedrock-llm",
    name: "Asistan / LLM (Amazon Bedrock)",
    mode: bedrockLive ? "canli" : "mock",
    detail: bedrockLive ? "LLM_PROVIDER=bedrock; asistan gerçek modelle yanıt verir." : "LLM_PROVIDER=mock; asistan deterministik mock yanıt üretir (bilgi tabanından).",
    nextStep: bedrockLive ? undefined : "LLM_PROVIDER=bedrock yapın ve bölge/erişimi açın.",
  });

  // Bedrock görsel
  out.push({
    key: "bedrock-image",
    name: "Bedrock görsel üretimi (Nova Canvas / Titan)",
    mode: features["creative.bedrockImage"] ? "canli" : "erisim_bekliyor",
    detail: features["creative.bedrockImage"] ? "Özellik bayrağı açık." : "Bölge/model erişimi açılana kadar kapalı.",
    nextStep: features["creative.bedrockImage"] ? undefined : "Bedrock model erişimi açılınca /admin/ai'dan creative.bedrockImage bayrağını açın.",
  });

  // Bedrock video
  out.push({
    key: "bedrock-video",
    name: "Bedrock video üretimi (Nova Reel)",
    mode: features["creative.bedrockVideo"] ? "canli" : "erisim_bekliyor",
    detail: features["creative.bedrockVideo"] ? "Özellik bayrağı açık." : "Bölge/model erişimi açılana kadar kapalı.",
    nextStep: features["creative.bedrockVideo"] ? undefined : "Bedrock Nova Reel erişimi açılınca /admin/ai'dan creative.bedrockVideo bayrağını açın.",
  });

  // Meta Marketing API (reklam)
  const metaLive = keyPresent("META_ADS_ACCESS_TOKEN") || keyPresent("META_SYSTEM_USER_TOKEN");
  out.push({
    key: "meta-ads",
    name: "Meta reklam (Marketing API)",
    mode: metaLive ? "canli" : "mock",
    detail: metaLive ? "Meta erişim anahtarı tanımlı." : "Anahtar yok; reklam taslakları yalnız onay kuyruğunda kalır, gerçek yayın/harcama olmaz.",
    nextStep: metaLive ? undefined : "META_ADS_ACCESS_TOKEN ekleyin ve Full Access başvurusunu tamamlayın.",
  });

  // TikTok Marketing/Content API
  const tiktokLive = keyPresent("TIKTOK_ACCESS_TOKEN");
  out.push({
    key: "tiktok-ads",
    name: "TikTok reklam/içerik (Marketing API)",
    mode: tiktokLive ? "canli" : "mock",
    detail: tiktokLive ? "TikTok erişim anahtarı tanımlı." : "Anahtar yok; reklam taslakları yalnız onay kuyruğunda kalır.",
    nextStep: tiktokLive ? undefined : "TIKTOK_ACCESS_TOKEN ekleyin ve uygulama denetimini tamamlayın.",
  });

  // WhatsApp / Instagram (kanal webhook)
  const waLive = keyPresent("WHATSAPP_ACCESS_TOKEN") || keyPresent("META_WABA_TOKEN");
  out.push({
    key: "whatsapp",
    name: "WhatsApp / Instagram mesajlaşma",
    mode: waLive ? "canli" : "mock",
    detail: waLive ? "Meta mesajlaşma anahtarı tanımlı." : "Anahtar yok; mesajlar gerçek alıcılara gitmez (deneme modu).",
    nextStep: waLive ? undefined : "Meta Embedded Signup ile numara/sayfa bağlanınca anahtar oluşur.",
  });

  return out;
}

export function modeLabel(mode: IntegrationMode): string {
  return mode === "canli" ? "Canlı" : mode === "mock" ? "Mock (anahtar bekliyor)" : "Erişim bekliyor";
}
