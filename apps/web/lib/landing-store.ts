import { z } from "zod";
import { prisma } from "@infulancer/core/db";
import { LANDING_CREATORS, LANDING_REFERENCES, LANDING_VIDEOS, type LandingReference, type LandingVideo } from "@/lib/landing-content";

/** Tanıtım sayfası içeriği admin panelinden düzenlenir; kayıt yoksa landing-content.ts varsayılanları kullanılır. */
const KEY = "landing.content";
const TONES = [
  "from-rose-500/70 via-fuchsia-600/50 to-indigo-700/70",
  "from-sky-500/70 via-cyan-600/50 to-emerald-700/70",
  "from-amber-500/70 via-orange-600/50 to-red-700/70",
  "from-lime-500/70 via-green-600/50 to-teal-700/70",
  "from-violet-500/70 via-purple-600/50 to-fuchsia-700/70",
  "from-teal-500/70 via-sky-600/50 to-blue-700/70",
] as const;
export const LANDING_TONES = TONES;
const CREATOR_TONES = ["from-rose-400 to-fuchsia-500", "from-sky-400 to-cyan-500", "from-amber-400 to-orange-500", "from-lime-400 to-emerald-500", "from-violet-400 to-indigo-500", "from-teal-400 to-sky-500"] as const;

/** Video/görsel adresi: https veya sitedeki /landing/ yolu (javascript:, data: vb. reddedilir). */
const mediaUrl = z
  .string()
  .trim()
  .max(500)
  .refine((v) => v === "" || /^https:\/\/[^\s"'<>]+$/i.test(v) || /^\/landing\/[\w.\-/]+$/.test(v), { error: "https:// ile başlayan bir adres veya /landing/… yolu girin." });
const text = (max: number, min = 1) => z.string().trim().min(min, { error: "Boş bırakılamaz." }).max(max, { error: `En fazla ${max} karakter.` });

export const videoSchema = z.object({
  src: mediaUrl.optional().default(""),
  poster: mediaUrl.optional().default(""),
  creator: text(60),
  handle: text(40),
  platform: z.enum(["Instagram", "TikTok", "YouTube"]),
  caption: text(120),
  metric: text(40),
  tone: z.enum(TONES).catch(TONES[0]),
  /** Reklam/işbirliği içeriği: kartta "Reklam" etiketi gösterilir (md. 23/A). */
  sponsored: z.boolean().default(true),
});
export const referenceSchema = z.object({
  brand: text(60),
  sector: text(40),
  quote: text(300),
  person: text(60),
  logo: mediaUrl.optional().default(""),
  results: z.array(z.object({ label: text(24), value: text(16) })).min(1).max(3),
  sample: z.boolean(),
  visible: z.boolean().default(true),
});
export const creatorSchema = z.object({
  handle: text(40),
  niche: text(24),
  followers: text(12),
  tone: z.enum(CREATOR_TONES).catch(CREATOR_TONES[0]),
  platform: z.enum(["Instagram", "TikTok", "YouTube"]).default("Instagram"),
  city: z.string().trim().max(30).default(""),
  engagement: z.string().trim().max(10).default(""),
  /** Birlikte çalıştığı marka (izinliyse) */
  brand: z.string().trim().max(40).default(""),
});
export const landingSchema = z.object({
  videos: z.array(videoSchema).min(1, { error: "En az bir video kartı olmalı." }).max(12),
  references: z.array(referenceSchema).max(12),
  creators: z.array(creatorSchema).max(30),
});
export type LandingContent = z.infer<typeof landingSchema>;
export type LandingVideoItem = z.infer<typeof videoSchema>;
export type LandingReferenceItem = z.infer<typeof referenceSchema>;
export { CREATOR_TONES };

export function defaultLandingContent(): LandingContent {
  return {
    videos: LANDING_VIDEOS.map((v, i) => ({
      src: v.src ?? "",
      poster: v.poster ?? "",
      creator: v.creator,
      handle: v.handle,
      platform: v.platform,
      caption: v.caption,
      metric: v.metric,
      tone: TONES[i % TONES.length]!,
      sponsored: true,
    })),
    references: LANDING_REFERENCES.map((r) => ({ ...r, logo: "", visible: true })),
    creators: LANDING_CREATORS.map((c, i) => ({
      handle: c.handle,
      niche: c.niche,
      followers: c.followers,
      tone: CREATOR_TONES[i % CREATOR_TONES.length]!,
      platform: c.platform,
      city: c.city,
      engagement: c.engagement,
      brand: "",
    })),
  };
}

export async function getLandingContent(): Promise<LandingContent> {
  const row = await prisma.configValue.findUnique({ where: { key: KEY } }).catch(() => null);
  if (!row) return defaultLandingContent();
  const parsed = landingSchema.safeParse(row.value);
  return parsed.success ? parsed.data : defaultLandingContent();
}
export async function saveLandingContent(content: LandingContent): Promise<void> {
  await prisma.configValue.upsert({
    where: { key: KEY },
    create: { key: KEY, value: content, note: "Tanıtım sayfası içeriği (admin)", verified: true },
    update: { value: content, verified: true },
  });
}
export async function resetLandingContent(): Promise<void> {
  await prisma.configValue.deleteMany({ where: { key: KEY } });
}

/** Bileşenlerin beklediği tiplere dönüştürür. */
export function toVideos(c: LandingContent): LandingVideo[] {
  return c.videos.map((v) => ({ ...v, src: v.src || undefined, poster: v.poster || undefined }));
}
export function toReferences(c: LandingContent): (LandingReference & { logo?: string })[] {
  return c.references.filter((r) => r.visible).map((r) => ({ ...r, logo: r.logo || undefined }));
}
