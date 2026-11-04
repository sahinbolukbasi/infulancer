import { z } from "zod";
import { prisma, type Prisma } from "../db";

/**
 * Takip agent'ları: hazır şablondan kurulur, bir kampanyayı / influencer'ı / markayı izler.
 * Her çalışmada bulguları hesaplar, yalnız YENİ bulgular için bildirim gönderir (tekrar spam yok)
 * ve son durumu `lastFindings` alanına yazar.
 */
export type TrackerScope = "CAMPAIGN" | "INFLUENCER" | "BRAND";
export type TrackerTemplateKey = "campaign" | "story" | "influencer" | "brand";
export type Finding = { key: string; severity: "KRITIK" | "UYARI" | "BILGI"; title: string; detail: string; href: string };

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const PUBLISHED = ["YAYINLANDI", "METRIK_BEKLIYOR", "TAMAMLANDI"] as const;
const OPEN = ["ATANDI", "BRIEF_GONDERILDI", "ICERIK_YUKLENDI", "REVIZYON", "ONAYLANDI"] as const;
const DISCLOSURE = /#(reklam|işbirliği|isbirligi|tanıtım|tanitim|sponsorlu|ad)\b/i;

export const TRACKER_TEMPLATES: Record<
  TrackerTemplateKey,
  { title: string; scope: TrackerScope; summary: string; checks: string[]; settings: z.ZodType<Record<string, number>>; defaults: Record<string, number> }
> = {
  campaign: {
    title: "Kampanya takibi",
    scope: "CAMPAIGN",
    summary: "Gecikme, eksik link, metrik ve bekleyen teklif",
    checks: ["Yayın saati geçti, paylaşım yok", "Onay son tarihi geçti", "Yayında ama bağlantı yok", "Yayından sonra metrik girilmedi", "Teklif yanıtsız"],
    settings: z.object({ metricAfterHours: z.number().int().min(1).max(240), offerDays: z.number().int().min(1).max(30) }),
    defaults: { metricAfterHours: 48, offerDays: 3 },
  },
  story: {
    title: "Story takibi",
    scope: "CAMPAIGN",
    summary: "Kare sayısı, #reklam etiketi, 24 saat içi ekran görüntüsü",
    checks: ["Story yaklaşıyor (hatırlatma)", "Kare sayısı eksik", "Karede reklam etiketi yok", "Story yayında, istatistik yok"],
    settings: z.object({ remindHours: z.number().int().min(1).max(72), screenshotHours: z.number().int().min(1).max(24) }),
    defaults: { remindHours: 12, screenshotHours: 20 },
  },
  influencer: {
    title: "Influencer takibi",
    scope: "INFLUENCER",
    summary: "Takipçi düşüşü, etkileşim, senkron hatası, revizyon",
    checks: ["Takipçi düşüşü", "Etkileşim eşiğin altında", "Hesap senkron hatası", "Bekleyen revizyon"],
    settings: z.object({ followerDropPct: z.number().min(1).max(90), minErPct: z.number().min(0).max(50) }),
    defaults: { followerDropPct: 5, minErPct: 1 },
  },
  brand: {
    title: "Marka takibi",
    scope: "BRAND",
    summary: "Onay bekleyen içerik, tahsilat, biten kampanya",
    checks: ["Marka onayı bekliyor", "Kapanmış kampanya tahsil edilmedi", "Kampanya bitişi yaklaşıyor"],
    settings: z.object({ reviewDays: z.number().int().min(1).max(30), endingDays: z.number().int().min(1).max(30) }),
    defaults: { reviewDays: 2, endingDays: 3 },
  },
};
export const TRACKER_KEYS = Object.keys(TRACKER_TEMPLATES) as TrackerTemplateKey[];

export function trackerSettings(template: TrackerTemplateKey, raw: unknown): Record<string, number> {
  const t = TRACKER_TEMPLATES[template];
  const r = t.settings.safeParse({ ...t.defaults, ...(raw && typeof raw === "object" ? raw : {}) });
  return r.success ? r.data : t.defaults;
}

async function campaignFindings(campaignId: string, s: Record<string, number>, now: Date): Promise<Finding[]> {
  const ds = await prisma.deliverable.findMany({
    where: { assignment: { campaignId, contractStatus: { not: "RED" } }, status: { not: "IPTAL" } },
    select: {
      id: true,
      status: true,
      plannedAt: true,
      approvalDeadline: true,
      publishedAt: true,
      postUrl: true,
      contentType: true,
      _count: { select: { metricSnapshots: true } },
      assignment: { select: { influencer: { select: { name: true } } } },
    },
  });
  const out: Finding[] = [];
  for (const d of ds) {
    const who = d.assignment.influencer.name;
    const href = `/admin/teslimler/${d.id}`;
    const open = (OPEN as readonly string[]).includes(d.status);
    const pub = (PUBLISHED as readonly string[]).includes(d.status);
    if (open && d.plannedAt.getTime() + 30 * 60_000 < now.getTime()) out.push({ key: `late:${d.id}`, severity: "KRITIK", title: `Yayın gecikti: ${who}`, detail: `Planlanan ${d.plannedAt.toISOString().slice(0, 16).replace("T", " ")} UTC`, href });
    else if (["ATANDI", "BRIEF_GONDERILDI", "REVIZYON"].includes(d.status) && d.approvalDeadline < now) out.push({ key: `approval:${d.id}`, severity: "UYARI", title: `Onay süresi geçti: ${who}`, detail: "Taslak henüz onaylanmadı.", href });
    if (pub && !d.postUrl) out.push({ key: `nourl:${d.id}`, severity: "UYARI", title: `Paylaşım bağlantısı yok: ${who}`, detail: "Yayınlandı işaretli ama bağlantı girilmedi.", href });
    if (pub && d.publishedAt && d._count.metricSnapshots === 0 && now.getTime() - d.publishedAt.getTime() > (s.metricAfterHours ?? 48) * HOUR)
      out.push({ key: `metric:${d.id}`, severity: "UYARI", title: `Metrik bekleniyor: ${who}`, detail: `Yayından ${s.metricAfterHours} saat geçti.`, href });
  }
  const offers = await prisma.assignment.findMany({
    where: { campaignId, contractStatus: "TEKLIF", createdAt: { lt: new Date(now.getTime() - (s.offerDays ?? 3) * DAY) } },
    select: { id: true, influencer: { select: { name: true } } },
  });
  for (const a of offers) out.push({ key: `offer:${a.id}`, severity: "BILGI", title: `Teklif yanıtsız: ${a.influencer.name}`, detail: `${s.offerDays} günden uzun süredir bekliyor.`, href: `/admin/kampanyalar/${campaignId}?sekme=influencerlar` });
  return out;
}

async function storyFindings(campaignId: string, s: Record<string, number>, now: Date): Promise<Finding[]> {
  const ds = await prisma.deliverable.findMany({
    where: { contentType: "STORY", status: { not: "IPTAL" }, assignment: { campaignId, contractStatus: { not: "RED" } } },
    select: {
      id: true,
      status: true,
      plannedAt: true,
      publishedAt: true,
      frameCount: true,
      frameTexts: true,
      _count: { select: { metricSnapshots: true } },
      assignment: { select: { influencer: { select: { name: true } } } },
    },
  });
  const out: Finding[] = [];
  for (const d of ds) {
    const who = d.assignment.influencer.name;
    const href = `/admin/teslimler/${d.id}`;
    const until = d.plannedAt.getTime() - now.getTime();
    if ((OPEN as readonly string[]).includes(d.status) && until > 0 && until < (s.remindHours ?? 12) * HOUR)
      out.push({ key: `soon:${d.id}`, severity: "BILGI", title: `Story yaklaşıyor: ${who}`, detail: `${Math.round(until / HOUR)} saat kaldı.`, href });
    if (d.frameTexts.length && d.frameTexts.length < d.frameCount) out.push({ key: `frames:${d.id}`, severity: "UYARI", title: `Story karesi eksik: ${who}`, detail: `${d.frameTexts.length}/${d.frameCount} kare metni var.`, href });
    const missing = d.frameTexts.map((t, i) => (DISCLOSURE.test(t) ? -1 : i + 1)).filter((i) => i > 0);
    if (missing.length) out.push({ key: `disc:${d.id}`, severity: "KRITIK", title: `Reklam etiketi eksik: ${who}`, detail: `Kare ${missing.join(", ")}: #reklam / #işbirliği yok.`, href });
    if (d.publishedAt && d._count.metricSnapshots === 0 && now.getTime() - d.publishedAt.getTime() > (s.screenshotHours ?? 20) * HOUR)
      out.push({ key: `shot:${d.id}`, severity: "UYARI", title: `Story istatistiği yok: ${who}`, detail: "Story 24 saatte kaybolur; ekran görüntüsü isteyin.", href });
  }
  return out;
}

async function influencerFindings(influencerId: string, s: Record<string, number>, now: Date): Promise<Finding[]> {
  const out: Finding[] = [];
  const href = `/admin/influencerlar/${influencerId}`;
  const accounts = await prisma.socialAccount.findMany({
    where: { influencerId },
    select: { id: true, platform: true, handle: true, followers: true, engagementRate: true, syncError: true, snapshots: { where: { takenAt: { gte: new Date(now.getTime() - 30 * DAY) } }, orderBy: { takenAt: "asc" }, take: 1, select: { followers: true } } },
  });
  for (const a of accounts) {
    const base = a.snapshots[0]?.followers;
    if (base && base > 0) {
      const drop = ((base - a.followers) / base) * 100;
      if (drop >= (s.followerDropPct ?? 5)) out.push({ key: `drop:${a.id}`, severity: "UYARI", title: `Takipçi düştü: @${a.handle}`, detail: `30 günde %${drop.toFixed(1)} düşüş.`, href });
    }
    const er = Number(a.engagementRate) * 100;
    if (a.followers > 0 && er < (s.minErPct ?? 1)) out.push({ key: `er:${a.id}`, severity: "BILGI", title: `Düşük etkileşim: @${a.handle}`, detail: `%${er.toFixed(1)} (eşik %${s.minErPct}).`, href });
    if (a.syncError) out.push({ key: `sync:${a.id}`, severity: "BILGI", title: `Senkron hatası: @${a.handle}`, detail: a.syncError.slice(0, 160), href });
  }
  const rev = await prisma.deliverable.findMany({ where: { status: "REVIZYON", assignment: { influencerId } }, select: { id: true, assignment: { select: { campaign: { select: { name: true } } } } } });
  for (const d of rev) out.push({ key: `rev:${d.id}`, severity: "UYARI", title: "Revizyon bekliyor", detail: d.assignment.campaign.name, href: `/admin/teslimler/${d.id}` });
  return out;
}

async function brandFindings(brandId: string, s: Record<string, number>, now: Date): Promise<Finding[]> {
  const out: Finding[] = [];
  const drafts = await prisma.deliverable.findMany({
    where: { status: "ICERIK_YUKLENDI", updatedAt: { lt: new Date(now.getTime() - (s.reviewDays ?? 2) * DAY) }, assignment: { campaign: { brandId }, contractStatus: { not: "RED" } } },
    select: { id: true, assignment: { select: { influencer: { select: { name: true } }, campaign: { select: { name: true } } } } },
  });
  for (const d of drafts) out.push({ key: `review:${d.id}`, severity: "UYARI", title: `Marka onayı bekliyor: ${d.assignment.influencer.name}`, detail: `${d.assignment.campaign.name} · ${s.reviewDays} günden uzun`, href: `/admin/teslimler/${d.id}` });
  const camps = await prisma.campaign.findMany({ where: { brandId, status: { in: ["AKTIF", "KAPANDI"] } }, select: { id: true, name: true, status: true, endsAt: true, brandPaymentReceivedAt: true } });
  for (const c of camps) {
    if (c.status === "KAPANDI" && !c.brandPaymentReceivedAt) out.push({ key: `unpaid:${c.id}`, severity: "UYARI", title: `Tahsilat bekliyor: ${c.name}`, detail: "Kampanya kapandı, marka ödemesi işaretlenmedi.", href: `/admin/kampanyalar/${c.id}` });
    const left = c.endsAt.getTime() - now.getTime();
    if (c.status === "AKTIF" && left > 0 && left < (s.endingDays ?? 3) * DAY) out.push({ key: `ending:${c.id}`, severity: "BILGI", title: `Bitişe ${Math.ceil(left / DAY)} gün: ${c.name}`, detail: "Kapanış ve rapor hazırlığı.", href: `/admin/kampanyalar/${c.id}` });
  }
  return out;
}

export async function evaluateTracker(t: { template: string; targetId: string; settings: unknown }, now = new Date()): Promise<Finding[]> {
  const key = t.template as TrackerTemplateKey;
  if (!TRACKER_TEMPLATES[key]) return [];
  const s = trackerSettings(key, t.settings);
  if (key === "campaign") return campaignFindings(t.targetId, s, now);
  if (key === "story") return storyFindings(t.targetId, s, now);
  if (key === "influencer") return influencerFindings(t.targetId, s, now);
  return brandFindings(t.targetId, s, now);
}

/** Bildirim alıcıları: admin + (isteğe bağlı) hedef markanın / influencer'ın kullanıcıları. */
async function recipients(t: { scope: string; targetId: string; notifyAdmins: boolean; notifyBrand: boolean; notifyInfluencer: boolean }): Promise<string[]> {
  const ids = new Set<string>();
  if (t.notifyAdmins) for (const u of await prisma.user.findMany({ where: { role: "ADMIN", status: "ACTIVE" }, select: { id: true } })) ids.add(u.id);
  if (t.notifyBrand) {
    const brandId = t.scope === "BRAND" ? t.targetId : t.scope === "CAMPAIGN" ? (await prisma.campaign.findUnique({ where: { id: t.targetId }, select: { brandId: true } }))?.brandId : null;
    if (brandId) for (const u of await prisma.user.findMany({ where: { brandId, status: "ACTIVE" }, select: { id: true } })) ids.add(u.id);
  }
  if (t.notifyInfluencer && t.scope === "INFLUENCER") {
    const u = await prisma.user.findUnique({ where: { influencerId: t.targetId }, select: { id: true } });
    if (u) ids.add(u.id);
  }
  return [...ids];
}

/** Tek tracker'ı çalıştırır; yeni bulgu sayısını döner. */
export async function runTracker(id: string, now = new Date()): Promise<{ findings: number; fresh: number }> {
  const t = await prisma.trackerAgent.findUnique({ where: { id } });
  if (!t) return { findings: 0, fresh: 0 };
  const findings = await evaluateTracker(t, now);
  const prev = new Set((Array.isArray(t.lastFindings) ? (t.lastFindings as Finding[]) : []).map((f) => f.key));
  const fresh = findings.filter((f) => !prev.has(f.key));
  if (fresh.length) {
    const users = await recipients(t);
    const data: Prisma.NotificationCreateManyInput[] = users.flatMap((userId) =>
      fresh.slice(0, 10).map((f) => ({ userId, title: `${t.name}: ${f.title}`, body: f.detail, href: f.href })),
    );
    if (data.length) await prisma.notification.createMany({ data });
  }
  await prisma.trackerAgent.update({ where: { id }, data: { lastRunAt: now, lastFindings: findings as unknown as Prisma.InputJsonValue } });
  return { findings: findings.length, fresh: fresh.length };
}

/** Zamanlanmış job: tüm açık tracker'lar. */
export async function runAllTrackers(now = new Date()): Promise<{ created: number; skipped: number }> {
  const all = await prisma.trackerAgent.findMany({ where: { enabled: true }, select: { id: true } });
  let created = 0;
  for (const t of all) created += (await runTracker(t.id, now)).fresh;
  return { created, skipped: all.length };
}

/** Kampanya oluşturulunca varsayılan takipçiler (kampanya + story). Zaten varsa eklemez. */
export async function ensureCampaignTrackers(campaignId: string, campaignName: string, createdById: string | null): Promise<number> {
  const existing = await prisma.trackerAgent.findMany({ where: { scope: "CAMPAIGN", targetId: campaignId }, select: { template: true } });
  const have = new Set(existing.map((e) => e.template));
  const add = (["campaign", "story"] as const).filter((k) => !have.has(k));
  if (!add.length) return 0;
  await prisma.trackerAgent.createMany({
    data: add.map((k) => ({ name: `${TRACKER_TEMPLATES[k].title} · ${campaignName}`.slice(0, 120), template: k, scope: "CAMPAIGN", targetId: campaignId, settings: TRACKER_TEMPLATES[k].defaults, createdById })),
  });
  return add.length;
}
