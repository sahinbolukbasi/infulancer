import { getLlm } from "../llm";

/**
 * Üretilen bir görsel/video'dan (veya serbest istemden) sosyal medya post metni ve kampanya
 * brief taslağı üretir. Gerçek LLM varsa onu kullanır; mock modda deterministik, kullanılabilir
 * Türkçe taslak döndürür. Çıktı her zaman düzenlenebilir bir öneridir.
 */
export type PostDraft = {
  caption: string;
  hashtags: string[];
  callToAction: string;
};

export type BriefDraft = {
  text: string;
  dos: string[];
  donts: string[];
  hashtags: string[];
  mentions: string[];
  requiredPhrases: string[];
  bannedPhrases: string[];
  disclosureRequired: boolean;
};

function hashtagsFrom(prompt: string): string[] {
  const words = prompt
    .toLocaleLowerCase("tr")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 4)
    .slice(0, 6);
  const base = [...new Set(words)].map((w) => `#${w.replace(/ı/g, "i").replace(/ş/g, "s").replace(/ğ/g, "g").replace(/ü/g, "u").replace(/ö/g, "o").replace(/ç/g, "c")}`);
  return [...new Set([...base, "#reklam", "#işbirliği"])].slice(0, 8);
}

/** Post metni (caption + hashtag + CTA). */
export async function generatePost(input: { prompt: string; brandName?: string; platform?: string; tone?: "samimi" | "profesyonel" | "enerjik" }): Promise<PostDraft> {
  const tone = input.tone ?? "samimi";
  const llm = await getLlm().completeText({
    system: `Sosyal medya içerik yazarı. ${tone} tonda, Türkçe, kısa ve etkili bir ${input.platform ?? "Instagram"} gönderi metni yaz. Sonunda net bir çağrı (CTA) olsun. Reklam ibaresi ekle.`,
    promptVersion: "post@1",
    prompt: `Görsel/istek: ${input.prompt}${input.brandName ? `\nMarka: ${input.brandName}` : ""}`,
  });
  const hashtags = hashtagsFrom(input.prompt + " " + (input.brandName ?? ""));
  if (llm.text.startsWith("[Otomatik")) {
    // Mock: istemden anlamlı bir taslak kur.
    const toneLead = tone === "profesyonel" ? "Yeni ürünümüzle tanışın." : tone === "enerjik" ? "Bunu kaçırmak yok! 🔥" : "Bugün sizlerle çok özel bir şey paylaşıyorum ✨";
    const caption = `${toneLead} ${input.prompt.trim().replace(/\s+/g, " ").slice(0, 180)}${input.brandName ? ` ${input.brandName} ile.` : ""} #reklam`;
    return { caption, hashtags, callToAction: "Profildeki bağlantıdan hemen keşfet." };
  }
  // Gerçek LLM metnini caption olarak kullan; hashtag/CTA ayıkla.
  return { caption: llm.text.trim(), hashtags, callToAction: "Profildeki bağlantıdan keşfet." };
}

/** Kampanya brief taslağı (BriefForm alanlarıyla birebir). */
export async function generateBrief(input: { prompt: string; brandName?: string; goal?: string }): Promise<BriefDraft> {
  const llm = await getLlm().completeText({
    system: "Influencer kampanyası brief yazarı. Türkçe, net ve uygulanabilir bir içerik brief'i üret: ne anlatılmalı, yapılacaklar, yapılmayacaklar.",
    promptVersion: "brief@1",
    prompt: `Kampanya/istek: ${input.prompt}${input.brandName ? `\nMarka: ${input.brandName}` : ""}${input.goal ? `\nHedef: ${input.goal}` : ""}`,
  });
  const hashtags = hashtagsFrom(input.prompt + " " + (input.brandName ?? ""));
  const text = llm.text.startsWith("[Otomatik")
    ? `${input.brandName ? `${input.brandName} için ` : ""}içerik: ${input.prompt.trim().replace(/\s+/g, " ").slice(0, 400)}. Ürünü doğal, günlük kullanımda gösterin; samimi ve özgün bir dil kullanın.`
    : llm.text.trim();
  return {
    text,
    dos: ["Ürünü doğal kullanımda göster", "İlk 3 saniyede dikkat çek", "Net bir çağrı (CTA) ekle", "Marka etiketini ekle"],
    donts: ["Rakip marka gösterme", "Yanıltıcı/abartılı iddia kullanma", "Reklam ibaresini gizleme"],
    hashtags,
    mentions: input.brandName ? [`@${input.brandName.toLocaleLowerCase("tr").replace(/\s+/g, "")}`] : [],
    requiredPhrases: [],
    bannedPhrases: [],
    disclosureRequired: true,
  };
}
