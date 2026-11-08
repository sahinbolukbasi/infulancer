import { z } from "zod";
import type { ContentType, Platform } from "../enums";
import { platformRules } from "./platform-rules";

/**
 * Kampanya oluşturma sihirbazının ortak tanımları (marka ve ajans aynı adımları kullanır).
 * Adımlar sırayla kaydedilir; her adım kendi "Kaydet ve devam" düğmesiyle veritabanına yazılır,
 * son adım ("Özet") kampanyayı ajansa gönderir (marka) ya da kuruluma geçirir (ajans).
 */
export type WizardStepKey = "temel" | "kitle" | "butce" | "icerik" | "brief" | "medya" | "influencer" | "ozet";
export const WIZARD_STEPS: { key: WizardStepKey; title: string; hint: string }[] = [
  { key: "temel", title: "Temel bilgiler", hint: "Ad, amaç ve kısa açıklama" },
  { key: "kitle", title: "Hedef kitle", hint: "Ülke, platform, yaş ve ilgi alanı" },
  { key: "butce", title: "Tarih ve bütçe", hint: "Yayın aralığı ve toplam bütçe" },
  { key: "icerik", title: "İçerik planı", hint: "Influencer başına kaç post, reels, story" },
  { key: "brief", title: "Brief", hint: "Mesaj, yapılacaklar, etiketler" },
  { key: "medya", title: "Fotoğraf ve video", hint: "Ürün görselleri, örnek çekimler, logo" },
  { key: "influencer", title: "Influencerlar", hint: "Toplu seçim" },
  { key: "ozet", title: "Özet ve kaydet", hint: "Kontrol et ve gönder" },
];
export function isWizardStep(v: unknown): v is WizardStepKey {
  return typeof v === "string" && WIZARD_STEPS.some((s) => s.key === v);
}
export function nextStep(k: WizardStepKey): WizardStepKey | null {
  const i = WIZARD_STEPS.findIndex((s) => s.key === k);
  return WIZARD_STEPS[i + 1]?.key ?? null;
}
export function prevStep(k: WizardStepKey): WizardStepKey | null {
  const i = WIZARD_STEPS.findIndex((s) => s.key === k);
  return i > 0 ? WIZARD_STEPS[i - 1]!.key : null;
}

export const OBJECTIVES = [
  { id: "bilinirlik", title: "Bilinirlik", text: "Geniş kitleye ulaş" },
  { id: "etkilesim", title: "Etkileşim", text: "Beğeni, yorum, kaydetme" },
  { id: "satis", title: "Satış", text: "Kupon ve tıklama" },
  { id: "video", title: "Video izlenme", text: "Reels, TikTok, YouTube" },
] as const;
export type Objective = (typeof OBJECTIVES)[number]["id"];

/** Yayın ülkeleri (ISO 3166-1 alpha-2). Çok ülkeli kampanyalar ve influencer ayrımı için. */
export const COUNTRIES: { code: string; name: string }[] = [
  { code: "TR", name: "Türkiye" },
  { code: "DE", name: "Almanya" },
  { code: "AT", name: "Avusturya" },
  { code: "CH", name: "İsviçre" },
  { code: "FR", name: "Fransa" },
  { code: "BE", name: "Belçika" },
  { code: "NL", name: "Hollanda" },
  { code: "GB", name: "Birleşik Krallık" },
  { code: "US", name: "ABD" },
  { code: "AZ", name: "Azerbaycan" },
];
export const countryName = (code: string) => COUNTRIES.find((c) => c.code === code)?.name ?? code;

export const GENDERS = [
  { id: "hepsi", label: "Hepsi" },
  { id: "kadin", label: "Ağırlıklı kadın" },
  { id: "erkek", label: "Ağırlıklı erkek" },
] as const;

const PLATFORMS = ["INSTAGRAM", "TIKTOK", "YOUTUBE"] as const;
const CONTENT_TYPES = ["REELS", "STORY", "CAROUSEL", "FEED", "LIVE", "VIDEO", "PHOTO", "SHORTS", "COMMUNITY"] as const;

export const contentPlanItemSchema = z
  .object({
    platform: z.enum(PLATFORMS),
    contentType: z.enum(CONTENT_TYPES),
    count: z.number().int().min(1, { error: "Adet en az 1." }).max(20, { error: "Adet en çok 20." }),
    notes: z.string().max(500).default(""),
  })
  .refine((v) => (platformRules[v.platform].contentTypes as readonly string[]).includes(v.contentType), {
    error: "Bu içerik tipi seçilen platformda yok.",
    path: ["contentType"],
  });
export const contentPlanSchema = z.array(contentPlanItemSchema).max(20, { error: "En çok 20 satır." });
export type ContentPlanItem = { platform: Platform; contentType: ContentType; count: number; notes: string };

/** Veritabanındaki JSON'u güvenle okur (bozuksa boş plan). */
export function parseContentPlan(raw: unknown): ContentPlanItem[] {
  const r = contentPlanSchema.safeParse(raw ?? []);
  return r.success ? (r.data as ContentPlanItem[]) : [];
}
export function planTotal(plan: ContentPlanItem[]): number {
  return plan.reduce((s, p) => s + p.count, 0);
}

export const audienceSchema = z
  .object({
    targetCountries: z.array(z.string().regex(/^[A-Z]{2}$/)).min(1, { error: "En az bir ülke seçin." }).max(20),
    platforms: z.array(z.enum(PLATFORMS)).min(1, { error: "En az bir platform seçin." }),
    audienceAgeMin: z.number().int().min(13).max(80).nullable(),
    audienceAgeMax: z.number().int().min(13).max(80).nullable(),
    audienceGender: z.enum(["hepsi", "kadin", "erkek"]).nullable(),
    audienceInterests: z.array(z.string().min(1).max(40)).max(15),
  })
  .refine((v) => v.audienceAgeMin == null || v.audienceAgeMax == null || v.audienceAgeMin <= v.audienceAgeMax, {
    error: "Yaş aralığı: en küçük yaş en büyükten büyük olamaz.",
    path: ["audienceAgeMax"],
  });

/** Sihirbaz özeti: hangi adım eksik (marka göndermeden önce görür). */
export type DraftCheck = { key: WizardStepKey; ok: boolean; note: string };
export function draftChecks(c: {
  name: string;
  objective: string | null;
  targetCountries: string[];
  platforms: string[];
  brandTotalFeeKurus: bigint | number;
  startsAt: Date;
  endsAt: Date;
  contentPlan: unknown;
  briefCount: number;
  mediaCount: number;
  influencerCount: number;
}): DraftCheck[] {
  const plan = parseContentPlan(c.contentPlan);
  return [
    { key: "temel", ok: !!c.name && !!c.objective, note: c.objective ? (OBJECTIVES.find((o) => o.id === c.objective)?.title ?? c.objective) : "Amaç seçilmedi" },
    { key: "kitle", ok: c.targetCountries.length > 0 && c.platforms.length > 0, note: c.targetCountries.length ? c.targetCountries.map(countryName).join(", ") : "Ülke seçilmedi" },
    { key: "butce", ok: Number(c.brandTotalFeeKurus) > 0 && c.endsAt >= c.startsAt, note: Number(c.brandTotalFeeKurus) > 0 ? "Bütçe girildi" : "Bütçe girilmedi" },
    { key: "icerik", ok: plan.length > 0, note: plan.length ? `${planTotal(plan)} içerik / influencer` : "İçerik planı yok" },
    { key: "brief", ok: c.briefCount > 0, note: c.briefCount ? "Brief yazıldı" : "Brief yazılmadı" },
    { key: "medya", ok: true, note: c.mediaCount ? `${c.mediaCount} dosya` : "İsteğe bağlı" },
    { key: "influencer", ok: true, note: c.influencerCount ? `${c.influencerCount} influencer` : "Ajans önerir (isteğe bağlı)" },
  ];
}

const shiftDay = (day: string, n: number) => {
  const [y, m, d] = day.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
};
export type ScheduledItem = { platform: Platform; contentType: ContentType; frameCount: number; day: string; time: string; notes: string };
/**
 * İçerik planını takvime yayar (influencer başına aynı sıra). Story serisi tek iş olur
 * (adet = kare sayısı; md. 23/A kare başına denetlenir); diğer tipler adet kadar iş olur.
 * İşler ilk günden itibaren `spacingDays` arayla dizilir.
 */
export function expandPlanSchedule(plan: ContentPlanItem[], opts: { startDay: string; time: string; spacingDays: number }): ScheduledItem[] {
  const out: ScheduledItem[] = [];
  let slot = 0;
  for (const p of plan) {
    const n = p.contentType === "STORY" ? 1 : p.count;
    for (let i = 0; i < n; i++) {
      out.push({ platform: p.platform, contentType: p.contentType, frameCount: p.contentType === "STORY" ? p.count : 1, day: shiftDay(opts.startDay, slot * Math.max(0, opts.spacingDays)), time: opts.time, notes: p.notes });
      slot++;
    }
  }
  return out;
}
