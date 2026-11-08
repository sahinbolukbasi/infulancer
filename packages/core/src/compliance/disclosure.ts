import { prisma } from "../db";
import type { Platform } from "../generated/prisma/enums";
import { findDisclosure, ruleFor } from "./country-rules";

/**
 * Ticari Reklam Yönetmeliği md. 23/A (1 Ağustos 2026) içerik kontrolü.
 * - Caption'ın İLK unsuru literal "Reklam" veya "Tanıtım" + reklam verenin adı
 *   (alternatif: "@[reklam veren] tarafından sağlandı"), diğer tüm etiket/hashtag'lerden ÖNCE.
 * - Hashtag TEK BAŞINA YETMEZ (#reklam, #işbirliği, #sponsor yerine geçmez).
 * - Görünürlük: kaydırmadan/tıklamadan ilk bakışta → ilk satırda/ilk ~125 karakterde.
 * - Story serisi KARE BAŞINA kontrol edilir.
 */
export const FIRST_GLANCE_CHARS = 125;

export type DisclosureInput = {
  platform: Platform;
  caption: string;
  advertiser: string;
  advertiserHandle?: string | null;
  frameTexts?: string[];
  isStory?: boolean;
  paidPartnershipToggle?: boolean;
  commercialContentToggle?: boolean;
  hasAudio?: boolean;
  spokenDisclosure?: boolean;
  isLive?: boolean;
  /** İçeriği yayınlayan influencer'ın kayıtlı ülkesi (kurallar buna göre); varsayılan TR. */
  country?: string | null;
};

export type DisclosureIssue = { code: string; message: string; frame?: number };
export type DisclosureResult = { compliant: boolean; issues: DisclosureIssue[]; unverifiedPlatform: boolean; checklist: string[] };

function normalize(s: string) {
  return s.toLocaleLowerCase("tr").replace(/\s+/g, " ").trim();
}

/** Tek bir metin parçası (caption veya kare metni) için ilk-unsur kuralı. */
export function checkLeadingDisclosure(text: string, advertiser: string, handle?: string | null, country?: string | null): DisclosureIssue[] {
  const rule = ruleFor(country);
  if (rule.country !== "TR") {
    // Diğer ülkeler: kabul edilen ibare ilk bakışta (ilk ~125 karakter) görünmeli.
    const out: DisclosureIssue[] = [];
    const f = findDisclosure(text, rule);
    const shown = rule.words.slice(0, 2).map((w) => `“${w[0]!.toUpperCase()}${w.slice(1)}”`).join(" / ");
    if (f.index < 0) out.push({ code: "ACIKLAMA_YOK", message: `${rule.country} kuralı (${rule.law}): ${shown} açıklaması yok. ${rule.hint}` });
    else if (f.hashtagOnly && !rule.hashtagOk) out.push({ code: "HASHTAG_YETMEZ", message: `${rule.country}: hashtag tek başına yetmez; ${shown} açıkça yazılmalı.` });
    else if (f.index > FIRST_GLANCE_CHARS) out.push({ code: "ILK_BAKISTA_DEGIL", message: `${rule.country}: ${shown} ilk bakışta (ilk satırda) görünmeli; şu an metnin sonlarında.` });
    if (rule.advertiserRequired && !normalize(text).slice(0, FIRST_GLANCE_CHARS).includes(normalize(advertiser))) out.push({ code: "REKLAM_VEREN_YOK", message: `Reklam verenin adı (${advertiser}) ilk bakışta görünmeli.` });
    return out;
  }
  const issues: DisclosureIssue[] = [];
  const t = normalize(text);
  const adv = normalize(advertiser);
  const h = handle ? normalize(handle.startsWith("@") ? handle : `@${handle}`) : null;
  const firstGlance = t.slice(0, FIRST_GLANCE_CHARS);

  const startsWithWord = /^(reklam|tanıtım)\b/u.test(t);
  const providedBy = h ? t.startsWith(`${h} tarafından sağlandı`) : false;
  const hasWordAnywhere = /(^|[^#\p{L}])(reklam|tanıtım)\b/u.test(t);
  const onlyHashtag = !hasWordAnywhere && /#(reklam|tanıtım|işbirliği|isbirligi|sponsor|ad)\b/u.test(t);

  if (!startsWithWord && !providedBy) {
    if (onlyHashtag) issues.push({ code: "HASHTAG_YETMEZ", message: "Hashtag tek başına yetmez: 'Reklam' veya 'Tanıtım' kelimesi açıkça yazılmalı." });
    else if (hasWordAnywhere) issues.push({ code: "ILK_UNSUR_DEGIL", message: "'Reklam'/'Tanıtım' ilk unsur olmalı; diğer tüm etiket ve açıklamalardan önce gelmeli." });
    else issues.push({ code: "ACIKLAMA_YOK", message: "'Reklam' veya 'Tanıtım' açıklaması yok." });
  }
  if (!providedBy && !(firstGlance.includes(adv) || (h && firstGlance.includes(h)))) {
    issues.push({ code: "REKLAM_VEREN_YOK", message: `Reklam verenin adı (${advertiser}) açıklamanın yanında, ilk bakışta görünmeli.` });
  }
  return issues;
}

export function checkDisclosure(input: DisclosureInput): DisclosureResult {
  const issues: DisclosureIssue[] = [];
  const checklist: string[] = [];
  const frames = input.isStory ? input.frameTexts ?? [] : [];
  const rule = ruleFor(input.country);
  if (rule.country !== "TR") checklist.push(`Ülke kuralı (${rule.country} · ${rule.law}): ${rule.hint}`);

  if (input.isStory) {
    checklist.push(rule.country === "TR" ? "Story serisinde HER KAREDE 'Reklam/Tanıtım' + reklam veren adı" : `Story serisinde her karede: ${rule.hint}`);
    if (!frames.length) issues.push({ code: "KARE_YOK", message: "Story kareleri girilmemiş; her kare ayrı kontrol edilir." });
    frames.forEach((f, i) => {
      for (const iss of checkLeadingDisclosure(f, input.advertiser, input.advertiserHandle, input.country)) issues.push({ ...iss, frame: i + 1 });
    });
  } else {
    issues.push(...checkLeadingDisclosure(input.caption, input.advertiser, input.advertiserHandle, input.country));
  }

  let unverified = false;
  switch (input.platform) {
    case "INSTAGRAM":
      checklist.push("Ücretli ortaklık etiketi açık", rule.country === "TR" ? "Caption ilk unsuru 'Reklam/Tanıtım' + marka" : `Caption: ${rule.hint}`, "Story/Reels'te 1. kareden itibaren ekran üstü metin");
      if (!input.paidPartnershipToggle) issues.push({ code: "IG_UCRETLI_ORTAKLIK", message: "Instagram 'Ücretli ortaklık' etiketi açılmalı." });
      break;
    case "TIKTOK":
      checklist.push("Ticari içerik açıklaması ('Markanız' / 'Markalı içerik') açık", "Metin açıklaması");
      if (!input.commercialContentToggle) {
        issues.push({ code: "TT_TICARI_ICERIK", message: "TikTok ticari içerik açıklaması açılmalı (eksikse 24 saatte düzeltilmezse For You'dan çıkarılabilir)." });
      }
      break;
    case "YOUTUBE":
      unverified = true;
      checklist.push(rule.country === "TR" ? "Genel md. 23/A kuralı (YouTube'a özgü mekanik doğrulanmadı)" : `Genel ${rule.law} kuralı + YouTube “Ücretli tanıtım içerir” etiketi`);
      break;
  }
  if (input.hasAudio || input.isLive) {
    checklist.push(rule.country === "TR" ? "Reklamdan ÖNCE sözlü açılış: '[reklam veren] hakkında reklam/tanıtım içerir.'" : `Reklamdan önce sözlü açılış: ${rule.spoken}`);
    if (!input.spokenDisclosure) issues.push({ code: "SOZLU_YOK", message: "Sesli/canlı içerikte reklamdan önce sözlü açıklama gerekli." });
  }
  return { compliant: issues.length === 0, issues, unverifiedPlatform: unverified, checklist };
}

/** Deliverable'ı kontrol eder ve kare bazlı sonucu disclosure_checks'e yazar. */
export async function checkDeliverable(deliverableId: string) {
  const d = await prisma.deliverable.findUnique({
    where: { id: deliverableId },
    include: { assignment: { include: { influencer: { select: { country: true } }, campaign: { include: { brand: { select: { name: true } } } } } } },
  });
  if (!d) throw new Error("Deliverable bulunamadı");
  const isStory = d.contentType === "STORY";
  const result = checkDisclosure({
    platform: d.platform,
    caption: d.caption ?? "",
    advertiser: d.assignment.campaign.brand.name,
    frameTexts: isStory ? (d.frameTexts.length ? d.frameTexts : Array.from({ length: d.frameCount }, () => "")) : undefined,
    isStory,
    paidPartnershipToggle: d.paidPartnershipToggle,
    commercialContentToggle: d.commercialContentToggle,
    hasAudio: d.hasAudio,
    spokenDisclosure: d.spokenDisclosure,
    isLive: d.isLive,
    // Kayıtlı ülkeye göre (yayıncının tabi olduğu kural).
    country: d.assignment.influencer.country,
  });
  const frames = isStory ? Math.max(1, d.frameCount) : 1;
  for (let i = 0; i < frames; i++) {
    const frameIssues = result.issues.filter((x) => (isStory ? x.frame === i + 1 || x.frame == null : true));
    await prisma.disclosureCheck.upsert({
      where: { deliverableId_frameIndex: { deliverableId, frameIndex: i } },
      create: { deliverableId, frameIndex: i, platform: d.platform, compliant: frameIssues.length === 0, issues: frameIssues.map((x) => x.message) },
      update: { compliant: frameIssues.length === 0, issues: frameIssues.map((x) => x.message), checkedAt: new Date() },
    });
  }
  return result;
}

export class CampaignGateError extends Error {
  constructor(message: string, readonly details: { deliverableId: string; issues: string[] }[]) {
    super(message);
  }
}

/**
 * Kampanya canlıya alma kapısı: md. 23/A'ya uymayan veya kullanım hakkı (süre, mecra, coğrafya)
 * tanımlanmamış deliverable varsa kampanya AKTIF yapılamaz. Bu bir uyarı değil, BLOK.
 */
export async function assertCampaignCanGoLive(campaignId: string) {
  const ds = await prisma.deliverable.findMany({
    where: { assignment: { campaignId, contractStatus: { not: "RED" } }, status: { not: "IPTAL" } },
    select: { id: true, disclosureRequired: true, usageRightsDays: true, usageRightsChannel: true, usageRightsGeo: true },
  });
  const failures: { deliverableId: string; issues: string[] }[] = [];
  for (const d of ds) {
    const issues: string[] = [];
    if (d.disclosureRequired !== false) {
      const r = await checkDeliverable(d.id);
      issues.push(...r.issues.map((i) => (i.frame ? `Kare ${i.frame}: ${i.message}` : i.message)));
    }
    if (d.usageRightsDays == null || !d.usageRightsChannel || d.usageRightsGeo.length === 0) {
      issues.push("Kullanım hakkı (süre, mecra, coğrafya) tanımlı değil.");
    }
    if (issues.length) failures.push({ deliverableId: d.id, issues });
  }
  if (failures.length) {
    throw new CampaignGateError(
      `Kampanya canlıya alınamaz: ${failures.length} içerik md. 23/A reklam açıklaması veya kullanım hakkı şartını karşılamıyor.`,
      failures,
    );
  }
}

export const adPenaltyCopy = {
  range: "99.339 – 39.916.524 TL (mecraya göre)",
  example: "Temmuz 2026'da etiketsiz paylaşım yapan iki hesap sahibine ayrı ayrı 1.083.706 TL ceza ve durdurma kararı verildi.",
  note: "Reklam veren ve influencer ayrı ayrı cezalandırılabilir; sözleşmeyle sorumluluğu influencer'a yıkmak reklam verenin kamu hukuku yükümlülüğünü kaldırmaz. Sözleşmelerde iki yönlü tazminat önerilir.",
};
