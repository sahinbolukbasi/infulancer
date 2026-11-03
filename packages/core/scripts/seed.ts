/**
 * Geliştirme seed'i — idempotent: uygulama tablolarını boşaltıp gerçekçi Türkçe veriyle doldurur.
 * Şifreler yalnızca geliştirme içindir: Demo1234!
 *
 * Not: LedgerEntry / MetricSnapshot UPDATE/DELETE trigger'ları TRUNCATE'i engellemez.
 * Audit DB'ye seed tarafından yalnızca ledger işlemleri (recordEarning/recordPayoutSent) yazılır;
 * audit_log append-only olduğu için tekrar seed edildiğinde eski kayıtlar kalır.
 */
import bcrypt from "bcryptjs";
import { closeAuditPool } from "../src/audit";
import { seedAddon } from "./seed-addon";
import {
  prisma,
  type AssetKind,
  type ContentType,
  type DeliverableStatus,
  type MetricSource,
  type MetricStage,
  type Platform,
  type Severity,
} from "../src/db";
import { recordEarning, recordPayoutSent } from "../src/domain/ledger";
import { assertContentType, isStory, parsePlatformMetrics } from "../src/domain/platform-rules";
import { targetsSchema } from "../src/domain/campaign-score";
import { buildUtmLink } from "../src/domain/utm";
import { buildKey } from "../src/storage/s3";

const now = new Date();
const HOUR = 3_600_000;
const DAY = 24 * HOUR;
// AWS ortamında SEED_PASSWORD Secrets Manager'dan gelir; yerelde demo parolası.
const PASSWORD = process.env.SEED_PASSWORD || "Demo1234!";

/** Bugüne göre gün ofseti + İstanbul saati (UTC+3) → UTC Date. */
function at(dayOffset: number, hourTR = 12, minute = 0): Date {
  const d = new Date(now);
  d.setUTCDate(d.getUTCDate() + dayOffset);
  d.setUTCHours(hourTR - 3, minute, 0, 0);
  return d;
}
const ago = (ms: number) => new Date(now.getTime() - ms);

/** Geçerli mod-97 kontrol haneli, sahte TR IBAN. */
function fakeIban(bankCode: string, account: string): string {
  const bban = `${bankCode}0${account.padStart(16, "0")}`;
  const numeric = `${bban}292700`; // T=29, R=27
  const check = 98n - (BigInt(numeric) % 97n);
  return `TR${check.toString().padStart(2, "0")}${bban}`;
}

const kurus = (tl: number) => Math.round(tl * 100);

async function truncateAll() {
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "Notification", "AgentRun", "PayoutRequest", "PayoutBatch", "LedgerEntry",
      "MetricSnapshot", "Asset", "DeliverableReview", "DeliverableStatusChange",
      "Deliverable", "Assignment", "CampaignBrief", "Campaign",
      "SocialAccountSnapshot", "SocialAccount", "User", "Influencer", "Brand"
    RESTART IDENTITY CASCADE
  `);
}

type InfluencerSeed = {
  key: string;
  name: string;
  email: string;
  category: string;
  bank: string;
  account: string;
  taxStatus: "FATURA" | "SERBEST_MESLEK_MAKBUZU" | "STOPAJLI";
  canIssueInvoice: boolean;
  riskScore?: number;
  accounts: {
    platform: Platform;
    handle: string;
    followers: number;
    er: number;
    women: number;
    /** Son iki ayın takipçi artış oranları (eski→yeni). */
    growth?: [number, number];
  }[];
};

const influencerSeeds: InfluencerSeed[] = [
  {
    key: "zeynep", name: "Zeynep Yıldız", email: "zeynep@influencer.local", category: "güzellik",
    bank: "00062", account: "6290017384", taxStatus: "FATURA", canIssueInvoice: true, riskScore: 12,
    accounts: [
      { platform: "INSTAGRAM", handle: "zeynepyildiz", followers: 412_000, er: 0.041, women: 0.82 },
      { platform: "TIKTOK", handle: "zeynep.yildiz", followers: 655_000, er: 0.068, women: 0.76 },
    ],
  },
  {
    key: "can", name: "Can Demir", email: "can@influencer.local", category: "yemek",
    bank: "00064", account: "1045522093", taxStatus: "SERBEST_MESLEK_MAKBUZU", canIssueInvoice: true, riskScore: 8,
    accounts: [
      { platform: "YOUTUBE", handle: "candemirmutfak", followers: 286_000, er: 0.052, women: 0.48 },
      { platform: "INSTAGRAM", handle: "candemir.mutfak", followers: 198_000, er: 0.037, women: 0.55 },
    ],
  },
  {
    key: "ece", name: "Ece Şahin", email: "ece@influencer.local", category: "moda",
    bank: "00046", account: "8833104761", taxStatus: "STOPAJLI", canIssueInvoice: false, riskScore: 18,
    accounts: [{ platform: "INSTAGRAM", handle: "eceshn", followers: 154_000, er: 0.049, women: 0.88 }],
  },
  {
    key: "mert", name: "Mert Koç", email: "mert@influencer.local", category: "teknoloji",
    bank: "00067", account: "5520984417", taxStatus: "FATURA", canIssueInvoice: true, riskScore: 10,
    accounts: [{ platform: "YOUTUBE", handle: "mertkocteknoloji", followers: 523_000, er: 0.031, women: 0.22 }],
  },
  {
    key: "defne", name: "Defne Aksoy", email: "defne@influencer.local", category: "güzellik",
    bank: "00010", account: "7781223409", taxStatus: "STOPAJLI", canIssueInvoice: false, riskScore: 15,
    accounts: [
      { platform: "TIKTOK", handle: "defneaksoy", followers: 389_000, er: 0.074, women: 0.79 },
      { platform: "INSTAGRAM", handle: "defne.aksoy", followers: 121_000, er: 0.045, women: 0.81 },
    ],
  },
  {
    key: "burak", name: "Burak Özkan", email: "burak@influencer.local", category: "fitness",
    bank: "00111", account: "3317650928", taxStatus: "SERBEST_MESLEK_MAKBUZU", canIssueInvoice: false, riskScore: 21,
    accounts: [
      { platform: "INSTAGRAM", handle: "burakozkanfit", followers: 233_000, er: 0.038, women: 0.41 },
      { platform: "TIKTOK", handle: "burak.fit", followers: 310_000, er: 0.061, women: 0.39 },
      { platform: "YOUTUBE", handle: "burakozkan", followers: 142_000, er: 0.044, women: 0.35 },
    ],
  },
  {
    key: "selin", name: "Selin Çelik", email: "selin@influencer.local", category: "yemek",
    bank: "00015", account: "9102347756", taxStatus: "STOPAJLI", canIssueInvoice: false, riskScore: 14,
    accounts: [
      { platform: "INSTAGRAM", handle: "selincelik.lezzet", followers: 176_000, er: 0.047, women: 0.69 },
      { platform: "TIKTOK", handle: "selincelik", followers: 248_000, er: 0.072, women: 0.66 },
    ],
  },
  {
    key: "kaan", name: "Kaan Arslan", email: "kaan@influencer.local", category: "seyahat",
    bank: "00012", account: "4456019823", taxStatus: "FATURA", canIssueInvoice: true, riskScore: 72,
    accounts: [
      // Ani takipçi sıçraması + düşük ER → sahte etkileşim şüphesi.
      { platform: "YOUTUBE", handle: "kaanarslangeziyor", followers: 204_000, er: 0.009, women: 0.44, growth: [0.02, 0.61] },
      { platform: "INSTAGRAM", handle: "kaan.arslan", followers: 390_000, er: 0.006, women: 0.47, growth: [0.03, 0.85] },
    ],
  },
];

function demographics(women: number, seed: number) {
  const young = 0.3 + (seed % 7) * 0.03;
  return {
    gender: { kadin: women, erkek: Number((1 - women).toFixed(2)) },
    ageGroups: {
      "13-17": 0.04,
      "18-24": Number(young.toFixed(2)),
      "25-34": Number((0.86 - young - 0.18).toFixed(2)),
      "35-44": 0.14,
      "45+": 0.04,
    },
    topCities: [
      { city: "İstanbul", share: 0.38 },
      { city: "Ankara", share: 0.14 },
      { city: "İzmir", share: 0.11 },
      { city: "Bursa", share: 0.06 },
    ],
    topCountries: [{ country: "TR", share: 0.91 }, { country: "DE", share: 0.04 }],
  };
}

function postUrl(platform: Platform, handle: string, code: string): string {
  switch (platform) {
    case "INSTAGRAM":
      return `https://www.instagram.com/p/${code}/`;
    case "TIKTOK":
      return `https://www.tiktok.com/@${handle}/video/${code}`;
    case "YOUTUBE":
      return `https://www.youtube.com/watch?v=${code}`;
  }
}

const stageOffset: Record<Exclude<MetricStage, "ARA">, number> = { H24: DAY, D7: 7 * DAY, D30: 30 * DAY };
const stageGrowth: Record<Exclude<MetricStage, "ARA">, number> = { H24: 0.58, D7: 0.9, D30: 1 };

function buildMetrics(
  platform: Platform,
  contentType: ContentType,
  followers: number,
  er: number,
  stage: Exclude<MetricStage, "ARA">,
  factor = 1,
) {
  const g = stageGrowth[stage] * factor;
  const reachBase = contentType === "STORY" ? followers * 0.12 : platform === "TIKTOK" ? followers * 0.9 : followers * 0.45;
  const reach = Math.round(reachBase * g);
  const impressions = Math.round(reach * 1.32);
  const interactions = reach * er * 1.4;
  const likes = Math.round(interactions * 0.78);
  const comments = Math.round(interactions * 0.05);
  const saves = contentType === "STORY" ? 0 : Math.round(interactions * 0.1);
  const shares = Math.round(interactions * 0.07);
  const clicks = Math.round(reach * 0.011);
  let platformMetrics: Record<string, unknown>;
  if (platform === "INSTAGRAM") {
    platformMetrics = {
      profileClicks: Math.round(reach * 0.006),
      ...(contentType === "STORY"
        ? { linkStickerTaps: clicks, replies: Math.round(reach * 0.002), exits: Math.round(reach * 0.08) }
        : { plays: contentType === "REELS" ? Math.round(impressions * 1.15) : undefined }),
    };
  } else if (platform === "TIKTOK") {
    const views = Math.round(impressions * 1.2);
    platformMetrics = {
      views,
      watchTimeSec: Math.round(views * 11.4),
      avgWatchTimeSec: 11.4,
      completionRate: 0.37,
      profileViews: Math.round(reach * 0.009),
    };
  } else {
    const views = Math.round(reach * 1.1);
    platformMetrics = {
      views,
      watchTimeMin: Math.round((views * 312) / 60),
      avgViewDurationSec: contentType === "SHORTS" ? 24 : 312,
      ctr: 0.064,
      subscriberDelta: Math.round(views * 0.004),
    };
  }
  return {
    reach,
    impressions,
    likes,
    comments,
    saves,
    shares,
    clicks,
    platformMetrics: parsePlatformMetrics(platform, JSON.parse(JSON.stringify(platformMetrics))),
  };
}

async function main() {
  console.log("seed: tablolar boşaltılıyor…");
  await truncateAll();
  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  // ───── Admin ─────
  const admin = await prisma.user.create({
    data: { email: "admin@ajans.local", name: "Deniz Kaya", role: "ADMIN", passwordHash },
  });

  // ───── Markalar ─────
  const lumi = await prisma.brand.create({
    data: {
      name: "Lumi Kozmetik", taxOffice: "Kadıköy", taxNumber: "6120458731",
      contactName: "Pınar Ertekin", contactEmail: "pinar.ertekin@lumi.example", contactPhone: "+90 216 555 01 23",
      contractRef: "SZL-2026-014", contractStartsAt: at(-120), category: "kozmetik",
    },
  });
  const mira = await prisma.brand.create({
    data: {
      name: "Mira Güzellik", taxOffice: "Beşiktaş", taxNumber: "3984410276",
      contactName: "Gizem Toprak", contactEmail: "gizem.toprak@mira.example", contactPhone: "+90 212 555 04 56",
      contractRef: "SZL-2026-021", contractStartsAt: at(-45), category: "kozmetik",
      competitorBrandIds: [lumi.id],
    },
  });
  await prisma.brand.update({ where: { id: lumi.id }, data: { competitorBrandIds: [mira.id] } });
  const kahve = await prisma.brand.create({
    data: {
      name: "Kahve Durağı", taxOffice: "Çankaya", taxNumber: "7741902385",
      contactName: "Onur Yalçın", contactEmail: "onur.yalcin@kahveduragi.example", contactPhone: "+90 312 555 07 89",
      contractRef: "SZL-2026-027", contractStartsAt: at(-60), category: "gıda",
    },
  });

  const brandUsers = {
    lumi: await prisma.user.create({
      data: { email: "lumi@marka.local", name: "Pınar Ertekin", role: "BRAND", brandId: lumi.id, passwordHash },
    }),
    mira: await prisma.user.create({
      data: { email: "mira@marka.local", name: "Gizem Toprak", role: "BRAND", brandId: mira.id, passwordHash },
    }),
    kahve: await prisma.user.create({
      data: { email: "kahve@marka.local", name: "Onur Yalçın", role: "BRAND", brandId: kahve.id, passwordHash },
    }),
  };

  // ───── Influencerlar ─────
  type InfRec = {
    id: string;
    userId: string;
    name: string;
    accounts: Map<Platform, { handle: string; followers: number; er: number }>;
  };
  const inf: Record<string, InfRec> = {};

  for (const [i, s] of influencerSeeds.entries()) {
    const influencer = await prisma.influencer.create({
      data: {
        name: s.name,
        category: s.category,
        iban: fakeIban(s.bank, s.account),
        ibanHolder: s.name,
        taxStatus: s.taxStatus,
        canIssueInvoice: s.canIssueInvoice,
        riskScore: s.riskScore ?? null,
      },
    });
    const user = await prisma.user.create({
      data: { email: s.email, name: s.name, role: "INFLUENCER", influencerId: influencer.id, passwordHash },
    });
    const accounts = new Map<Platform, { handle: string; followers: number; er: number }>();
    for (const a of s.accounts) {
      const demo = demographics(a.women, i);
      const acc = await prisma.socialAccount.create({
        data: {
          influencerId: influencer.id,
          platform: a.platform,
          handle: a.handle,
          followers: a.followers,
          engagementRate: a.er.toFixed(4),
          demographics: demo,
        },
      });
      // Aylık 3 snapshot (60, 30, 0 gün önce) — ER trendi için.
      const [g1, g2] = a.growth ?? [0.035, 0.028];
      const f2 = Math.round(a.followers / (1 + g2));
      const f1 = Math.round(f2 / (1 + g1));
      const ers = a.growth ? [a.er * 3.1, a.er * 2.2, a.er] : [a.er * 0.94, a.er * 1.03, a.er];
      await prisma.socialAccountSnapshot.createMany({
        data: [
          { socialAccountId: acc.id, followers: f1, engagementRate: ers[0]!.toFixed(4), demographics: demo, takenAt: at(-60, 9) },
          { socialAccountId: acc.id, followers: f2, engagementRate: ers[1]!.toFixed(4), demographics: demo, takenAt: at(-30, 9) },
          { socialAccountId: acc.id, followers: a.followers, engagementRate: ers[2]!.toFixed(4), demographics: demo, takenAt: at(0, 9) },
        ],
      });
      accounts.set(a.platform, { handle: a.handle, followers: a.followers, er: a.er });
    }
    inf[s.key] = { id: influencer.id, userId: user.id, name: s.name, accounts };
  }
  const I = (key: string): InfRec => {
    const r = inf[key];
    if (!r) throw new Error(`influencer yok: ${key}`);
    return r;
  };

  // ───── Kampanyalar ─────
  const campaignsSpec = [
    {
      key: "c1", brandId: lumi.id, brandUserId: brandUsers.lumi.id, name: "Lumi Kış Bakım Serisi",
      slug: "lumi-kis-bakim-serisi", budget: 450_000, brandTotal: 380_000,
      startsAt: at(-75), endsAt: at(-40), status: "KAPANDI" as const,
      closedAt: at(-38, 17), brandPaymentReceivedAt: at(-30, 11),
      reportSummary:
        "Kış Bakım Serisi 7 paylaşımla toplam erişim hedefini aştı; en güçlü performans TikTok videolarından geldi. Kupon kodlarıyla 1.140 satış ölçüldü.",
      targets: [
        { kpi: "reach", target: 1_200_000, weight: 0.4, windowDays: 30 },
        { kpi: "er", target: 0.085, weight: 0.3, windowDays: 30 },
        { kpi: "click", target: 14_000, weight: 0.3, windowDays: 30 },
      ],
      base: "https://lumi.example/kis-bakim",
      briefs: [
        {
          text: "Kış aylarında kuruyan cilde Lumi Nem Serumu ile 3 adımlık bakım rutini. Doğal ışıkta, sabah rutini kurgusunda çekim.",
          dos: ["Ürünü ilk 3 saniyede göster", "Doğal ışık kullan", "Kendi cilt deneyimini anlat"],
          donts: ["Filtreli cilt görüntüsü", "Rakip marka ürünü kadrajda"],
          hashtags: ["#LumiKışBakım", "#NemSerumu"],
          mentions: ["@lumikozmetik"],
          requiredPhrases: ["Lumi Nem Serumu"],
          bannedPhrases: ["mucize", "kesin sonuç"],
        },
        {
          text: "Kış aylarında kuruyan cilde Lumi Nem Serumu ile 3 adımlık bakım rutini. Kupon kodu caption'da ve Story linkinde yer almalı.",
          dos: ["Ürünü ilk 3 saniyede göster", "Doğal ışık kullan", "Kupon kodunu sesli söyle"],
          donts: ["Filtreli cilt görüntüsü", "Rakip marka ürünü kadrajda", "Tıbbi iddia"],
          hashtags: ["#LumiKışBakım", "#NemSerumu", "#işbirliği"],
          mentions: ["@lumikozmetik"],
          requiredPhrases: ["Lumi Nem Serumu"],
          bannedPhrases: ["mucize", "kesin sonuç", "tedavi eder"],
        },
      ],
    },
    {
      key: "c2", brandId: mira.id, brandUserId: brandUsers.mira.id, name: "Mira Bahar Lansmanı",
      slug: "mira-bahar-lansmani", budget: 520_000, brandTotal: 460_000,
      startsAt: at(-10), endsAt: at(25), status: "AKTIF" as const,
      closedAt: null, brandPaymentReceivedAt: null, reportSummary: null,
      targets: [
        { kpi: "reach", target: 300_000, weight: 0.4, windowDays: 30 },
        { kpi: "views", target: 500_000, weight: 0.35, windowDays: 30 },
        { kpi: "sales", target: 800, weight: 0.25, windowDays: 30 },
      ],
      base: "https://mira.example/bahar",
      briefs: [
        {
          text: "Mira Bahar paleti lansmanı: 4 tonluk far paleti ile günlük ve gece makyajı geçişi.",
          dos: ["Paletin 4 tonunu da kullan", "Önce/sonra geçişi"],
          donts: ["Başka marka far paleti"],
          hashtags: ["#MiraBahar"],
          mentions: ["@miraguzellik"],
          requiredPhrases: ["Mira Bahar Paleti"],
          bannedPhrases: ["en ucuz"],
        },
        {
          text: "Mira Bahar paleti lansmanı: 4 tonluk far paleti ile günlük ve gece makyajı geçişi. Lansman indirimi için kupon kodu zorunlu.",
          dos: ["Paletin 4 tonunu da kullan", "Önce/sonra geçişi", "Kupon kodunu ekranda göster"],
          donts: ["Başka marka far paleti", "Fiyat karşılaştırması"],
          hashtags: ["#MiraBahar", "#BaharMakyajı"],
          mentions: ["@miraguzellik"],
          requiredPhrases: ["Mira Bahar Paleti", "lansmana özel"],
          bannedPhrases: ["en ucuz", "bedava"],
        },
      ],
    },
    {
      key: "c3", brandId: kahve.id, brandUserId: brandUsers.kahve.id, name: "Kahve Durağı Sonbahar Menüsü",
      slug: "kahve-duragi-sonbahar-menusu", budget: 260_000, brandTotal: 215_000,
      startsAt: at(-20), endsAt: at(10), status: "AKTIF" as const,
      closedAt: null, brandPaymentReceivedAt: null, reportSummary: null,
      targets: [
        { kpi: "reach", target: 350_000, weight: 0.5, windowDays: 21 },
        { kpi: "click", target: 4_000, weight: 0.3, windowDays: 21 },
        { kpi: "sales", target: 600, weight: 0.2, windowDays: 21 },
      ],
      base: "https://kahveduragi.example/sonbahar",
      briefs: [
        {
          text: "Sonbahar menüsündeki Balkabaklı Latte ve Tarçınlı Çörek. Şubede gerçek müşteri ortamında, sıcak tonlarda çekim.",
          dos: ["Bardak logosu görünür olsun", "Şube adını söyle"],
          donts: ["Rakip zincir bardağı", "Gece çekimi"],
          hashtags: ["#KahveDurağı", "#SonbaharMenüsü"],
          mentions: ["@kahveduragi"],
          requiredPhrases: ["Balkabaklı Latte"],
          bannedPhrases: ["şekersiz"],
        },
      ],
    },
    {
      key: "c4", brandId: lumi.id, brandUserId: brandUsers.lumi.id, name: "Lumi Yaz Güneş Koruma",
      slug: "lumi-yaz-gunes-koruma", budget: 300_000, brandTotal: 255_000,
      startsAt: at(30), endsAt: at(60), status: "TASLAK" as const,
      closedAt: null, brandPaymentReceivedAt: null, reportSummary: null,
      targets: [
        { kpi: "reach", target: 250_000, weight: 0.6, windowDays: 30 },
        { kpi: "er", target: 0.045, weight: 0.4, windowDays: 30 },
      ],
      base: "https://lumi.example/gunes",
      briefs: [
        {
          text: "SPF 50 Lumi Güneş Kremi: plaj ve şehir kullanımı. Taslak brief — marka onayı bekleniyor.",
          dos: ["Dış mekan çekimi", "Uygulama miktarını göster"],
          donts: ["Güneş yanığı görseli"],
          hashtags: ["#LumiYaz"],
          mentions: ["@lumikozmetik"],
          requiredPhrases: ["SPF 50"],
          bannedPhrases: ["su geçirmez"],
        },
      ],
    },
  ];

  const camp: Record<string, { id: string; slug: string; base: string; brandUserId: string; hashtags: string[]; mentions: string[] }> = {};
  for (const c of campaignsSpec) {
    const targets = targetsSchema.parse(c.targets);
    const campaign = await prisma.campaign.create({
      data: {
        brandId: c.brandId, name: c.name, slug: c.slug,
        budgetKurus: kurus(c.budget), brandTotalFeeKurus: kurus(c.brandTotal),
        startsAt: c.startsAt, endsAt: c.endsAt, targets, status: c.status,
        closedAt: c.closedAt, brandPaymentReceivedAt: c.brandPaymentReceivedAt, reportSummary: c.reportSummary,
      },
    });
    for (const [v, b] of c.briefs.entries()) {
      await prisma.campaignBrief.create({
        data: {
          campaignId: campaign.id, version: v + 1, text: b.text, dos: b.dos, donts: b.donts,
          hashtags: b.hashtags, mentions: b.mentions, requiredPhrases: b.requiredPhrases,
          bannedPhrases: b.bannedPhrases, disclosureRequired: true, createdById: admin.id,
          createdAt: new Date(c.startsAt.getTime() - (c.briefs.length - v) * 3 * DAY),
        },
      });
    }
    const latest = c.briefs[c.briefs.length - 1]!;
    // Ajans → influencer dosyaları (bayt yüklenmez; yalnızca kayıt).
    const campaignAssets: { kind: AssetKind; fileName: string; mime: string; size: number }[] = [
      { kind: "BRIEF_PDF", fileName: `${c.slug}-brief-v${c.briefs.length}.pdf`, mime: "application/pdf", size: 1_284_311 },
      { kind: "MARKA_LOGO", fileName: `${c.slug}-logo.svg`, mime: "image/svg+xml", size: 18_204 },
      { kind: "URUN_FOTO", fileName: `${c.slug}-urun.jpg`, mime: "image/jpeg", size: 2_480_112 },
    ];
    for (const a of campaignAssets) {
      await prisma.asset.create({
        data: {
          campaignId: campaign.id, key: buildKey(a.kind, { campaignId: campaign.id }, a.fileName),
          fileName: a.fileName, mime: a.mime, size: a.size, kind: a.kind,
          direction: "AJANS_TO_INFLUENCER", uploadedById: admin.id, uploadStatus: "TAMAM",
        },
      });
    }
    camp[c.key] = { id: campaign.id, slug: c.slug, base: c.base, brandUserId: c.brandUserId, hashtags: latest.hashtags, mentions: latest.mentions };
  }
  const C = (key: string) => {
    const r = camp[key];
    if (!r) throw new Error(`kampanya yok: ${key}`);
    return r;
  };

  // ───── Atamalar ─────
  const assignmentSpecs = [
    { key: "c1-zeynep", c: "c1", i: "zeynep", fee: 60_000, commission: 12_000, status: "KABUL", coupon: "ZEYNEP15" },
    { key: "c1-ece", c: "c1", i: "ece", fee: 35_000, commission: 7_000, status: "KABUL", coupon: "ECE15" },
    { key: "c1-defne", c: "c1", i: "defne", fee: 40_000, commission: 8_000, status: "KABUL", coupon: "DEFNE15", exclusivityDays: 60, exclusivityCategory: "kozmetik" },
    { key: "c2-ece", c: "c2", i: "ece", fee: 38_000, commission: 7_600, status: "KABUL", coupon: "ECEBAHAR" },
    { key: "c2-zeynep", c: "c2", i: "zeynep", fee: 64_000, commission: 12_800, status: "KABUL", coupon: "ZEYNEPBAHAR" },
    { key: "c2-burak", c: "c2", i: "burak", fee: 52_000, commission: 10_400, status: "KABUL", coupon: "BURAKBAHAR" },
    { key: "c2-kaan", c: "c2", i: "kaan", fee: 45_000, commission: 9_000, status: "RED", coupon: null },
    { key: "c3-can", c: "c3", i: "can", fee: 48_000, commission: 9_600, status: "KABUL", coupon: "CAN10" },
    { key: "c3-selin", c: "c3", i: "selin", fee: 36_000, commission: 7_200, status: "KABUL", coupon: "SELIN10" },
    { key: "c3-mert", c: "c3", i: "mert", fee: 30_000, commission: 6_000, status: "TEKLIF", coupon: null },
    { key: "c4-zeynep", c: "c4", i: "zeynep", fee: 58_000, commission: 11_600, status: "TEKLIF", coupon: null },
  ] as const;

  const asg: Record<string, { id: string; c: string; i: string; coupon: string | null }> = {};
  for (const a of assignmentSpecs) {
    const created = await prisma.assignment.create({
      data: {
        campaignId: C(a.c).id, influencerId: I(a.i).id,
        feeKurus: kurus(a.fee), commissionKurus: kurus(a.commission),
        contractStatus: a.status, couponCode: a.coupon,
        exclusivityDays: "exclusivityDays" in a ? a.exclusivityDays : 0,
        exclusivityCategory: "exclusivityCategory" in a ? a.exclusivityCategory : null,
      },
    });
    asg[a.key] = { id: created.id, c: a.c, i: a.i, coupon: a.coupon };
  }

  // ───── Deliverable'lar ─────
  type DSpec = {
    key: string;
    a: string;
    platform: Platform;
    contentType: ContentType;
    plannedAt: Date;
    status: DeliverableStatus;
    /** Yayın zamanı (plannedAt'ten sapma ms). */
    publishDelayMs?: number;
    code?: string;
    stages?: Exclude<MetricStage, "ARA">[];
    screenshotStages?: Exclude<MetricStage, "ARA">[];
    screenshotName?: string;
    metricFactor?: number;
    brandData?: { clicks: number; sales: number; revenueTl: number };
    draft?: boolean;
    raw?: boolean;
    caption: string;
  };

  const dspecs: DSpec[] = [
    // C1 — kapandı, tümü tamamlandı
    { key: "c1-z-reels", a: "c1-zeynep", platform: "INSTAGRAM", contentType: "REELS", plannedAt: at(-70, 20), status: "TAMAMLANDI", publishDelayMs: 4 * 60_000, code: "C1zRls01", stages: ["H24", "D7", "D30"], screenshotStages: ["D7"], brandData: { clicks: 2_310, sales: 420, revenueTl: 167_580 }, raw: true,
      caption: "Kışın kuruyan cildime 3 adımlık sabah rutini: temizle, Lumi Nem Serumu, nemlendir. Kodum ZEYNEP15 ile %15 indirim. #LumiKışBakım #NemSerumu #işbirliği @lumikozmetik" },
    { key: "c1-z-story", a: "c1-zeynep", platform: "INSTAGRAM", contentType: "STORY", plannedAt: at(-66, 21), status: "TAMAMLANDI", publishDelayMs: 0, code: "C1zSty01", stages: ["H24"], screenshotStages: ["H24"],
      caption: "Lumi Nem Serumu ile sabah rutini — link stickerda. #LumiKışBakım @lumikozmetik" },
    { key: "c1-z-tt", a: "c1-zeynep", platform: "TIKTOK", contentType: "VIDEO", plannedAt: at(-62, 19), status: "TAMAMLANDI", publishDelayMs: 12 * 60_000, code: "7301118842210", stages: ["H24", "D7", "D30"], raw: true,
      caption: "Kış cildi kurtarma operasyonu 🧴 Lumi Nem Serumu ile 3 adım. #LumiKışBakım #NemSerumu #işbirliği" },
    { key: "c1-e-carousel", a: "c1-ece", platform: "INSTAGRAM", contentType: "CAROUSEL", plannedAt: at(-68, 18), status: "TAMAMLANDI", publishDelayMs: 0, code: "C1eCar01", stages: ["H24", "D7", "D30"],
      caption: "Kış kombinine bakım rutini de dahil: Lumi Nem Serumu çantamdan çıkmıyor. ECE15 kodu ile indirim. #LumiKışBakım #işbirliği @lumikozmetik" },
    { key: "c1-e-reels", a: "c1-ece", platform: "INSTAGRAM", contentType: "REELS", plannedAt: at(-58, 20), status: "TAMAMLANDI", publishDelayMs: 25 * 60_000, code: "C1eRls02", stages: ["H24", "D7", "D30"], screenshotStages: ["H24"],
      caption: "Ofis çıkışı 60 saniyelik bakım: Lumi Nem Serumu. #LumiKışBakım #NemSerumu #işbirliği" },
    { key: "c1-d-tt", a: "c1-defne", platform: "TIKTOK", contentType: "VIDEO", plannedAt: at(-64, 21), status: "TAMAMLANDI", publishDelayMs: 2 * 60_000, code: "7301562200987", stages: ["H24", "D7", "D30"], metricFactor: 1.2, raw: true,
      caption: "Cildim kışa hazır mı? Lumi Nem Serumu testi, 7 gün sonuçları. DEFNE15 #LumiKışBakım #işbirliği" },
    { key: "c1-d-reels", a: "c1-defne", platform: "INSTAGRAM", contentType: "REELS", plannedAt: at(-55, 19), status: "TAMAMLANDI", publishDelayMs: 8 * 60_000, code: "C1dRls01", stages: ["H24", "D7", "D30"],
      caption: "Gece rutinimde Lumi Nem Serumu. #LumiKışBakım #NemSerumu #işbirliği @lumikozmetik" },

    // C2 — aktif
    { key: "c2-e-story", a: "c2-ece", platform: "INSTAGRAM", contentType: "STORY", plannedAt: new Date(now.getTime() - 21 * HOUR), status: "METRIK_BEKLIYOR", publishDelayMs: 0, code: "C2eSty01",
      caption: "Mira Bahar Paleti elimde! Lansmana özel kodum ECEBAHAR. #MiraBahar @miraguzellik" },
    { key: "c2-e-reels", a: "c2-ece", platform: "INSTAGRAM", contentType: "REELS", plannedAt: at(3, 20), status: "ICERIK_YUKLENDI", draft: true,
      caption: "Gündüzden geceye tek palet: Mira Bahar Paleti. Lansmana özel ECEBAHAR. #MiraBahar @miraguzellik" },
    { key: "c2-z-reels", a: "c2-zeynep", platform: "INSTAGRAM", contentType: "REELS", plannedAt: at(4, 21), status: "REVIZYON", draft: true,
      caption: "4 ton, 2 görünüm: Mira Bahar Paleti ile bahar makyajı. #MiraBahar #BaharMakyajı" },
    { key: "c2-z-tt", a: "c2-zeynep", platform: "TIKTOK", contentType: "VIDEO", plannedAt: at(2, 19), status: "ONAYLANDI", draft: true,
      caption: "Mira Bahar Paleti ile 30 saniyede göz makyajı, lansmana özel ZEYNEPBAHAR. #MiraBahar #BaharMakyajı #işbirliği" },
    { key: "c2-b-yt", a: "c2-burak", platform: "YOUTUBE", contentType: "VIDEO", plannedAt: new Date(now.getTime() - 36 * HOUR), status: "METRIK_BEKLIYOR", publishDelayMs: 0, code: "mBrk2Bhr01", stages: ["H24"],
      caption: "Antrenman sonrası bakım rutini ve Mira Bahar Paleti ile hızlı makyaj (ücretli tanıtım içerir). Kod: BURAKBAHAR" },
    { key: "c2-b-shorts", a: "c2-burak", platform: "YOUTUBE", contentType: "SHORTS", plannedAt: at(6, 18), status: "BRIEF_GONDERILDI",
      caption: "Mira Bahar Paleti — 4 ton, 15 saniye." },
    { key: "c2-b-feed", a: "c2-burak", platform: "INSTAGRAM", contentType: "FEED", plannedAt: at(8, 12), status: "ATANDI",
      caption: "Bahar enerjisi + Mira Bahar Paleti. #MiraBahar" },
    { key: "c2-b-carousel", a: "c2-burak", platform: "INSTAGRAM", contentType: "CAROUSEL", plannedAt: at(9, 12), status: "IPTAL",
      caption: "İptal edildi: marka talebiyle kapsamdan çıkarıldı." },
    { key: "c2-k-yt", a: "c2-kaan", platform: "YOUTUBE", contentType: "VIDEO", plannedAt: at(5, 20), status: "IPTAL",
      caption: "Sözleşme reddedildi." },
    { key: "c2-k-reels", a: "c2-kaan", platform: "INSTAGRAM", contentType: "REELS", plannedAt: at(7, 20), status: "IPTAL",
      caption: "Sözleşme reddedildi." },

    // C3 — aktif
    { key: "c3-c-yt", a: "c3-can", platform: "YOUTUBE", contentType: "VIDEO", plannedAt: at(-15, 19), status: "TAMAMLANDI", publishDelayMs: 6 * 60_000, code: "kDcAn5Snb01", stages: ["H24", "D7"], brandData: { clicks: 1_240, sales: 198, revenueTl: 27_720 }, raw: true,
      caption: "Evde Balkabaklı Latte denedim, sonra Kahve Durağı'nın orijinaline gittim (ücretli tanıtım). Kod: CAN10" },
    { key: "c3-c-reels", a: "c3-can", platform: "INSTAGRAM", contentType: "REELS", plannedAt: at(-3, 18), status: "METRIK_BEKLIYOR", publishDelayMs: 3 * 60_000, code: "C3cRls01", stages: ["H24"], screenshotStages: ["H24"], screenshotName: "can-reels-24s-uyumsuz.png",
      caption: "Balkabaklı Latte + Tarçınlı Çörek = sonbahar. CAN10 ile %10 indirim. #KahveDurağı #SonbaharMenüsü #işbirliği @kahveduragi" },
    { key: "c3-c-story", a: "c3-can", platform: "INSTAGRAM", contentType: "STORY", plannedAt: at(-1, 10), status: "ONAYLANDI", draft: true,
      caption: "Sabah kahvem Kahve Durağı'ndan: Balkabaklı Latte. #KahveDurağı @kahveduragi" },
    { key: "c3-s-tt", a: "c3-selin", platform: "TIKTOK", contentType: "VIDEO", plannedAt: at(-12, 20), status: "TAMAMLANDI", publishDelayMs: 0, code: "7302-silindi-4471", stages: ["H24", "D7"],
      caption: "Balkabaklı Latte puanlıyorum ☕ SELIN10 #KahveDurağı #SonbaharMenüsü #işbirliği" },
    { key: "c3-s-carousel", a: "c3-selin", platform: "INSTAGRAM", contentType: "CAROUSEL", plannedAt: at(2, 13), status: "ICERIK_YUKLENDI", draft: true,
      caption: "Sonbahar menüsünün 5 lezzeti, favorim Balkabaklı Latte. #KahveDurağı #SonbaharMenüsü @kahveduragi" },
    { key: "c3-s-photo", a: "c3-selin", platform: "TIKTOK", contentType: "PHOTO", plannedAt: at(5, 12), status: "REVIZYON", draft: true,
      caption: "Tarçınlı Çörek ve Balkabaklı Latte. #KahveDurağı" },
    { key: "c3-s-live", a: "c3-selin", platform: "INSTAGRAM", contentType: "LIVE", plannedAt: at(7, 21), status: "BRIEF_GONDERILDI",
      caption: "Canlı yayında Kahve Durağı sonbahar menüsü tadımı." },
    { key: "c3-s-feed", a: "c3-selin", platform: "INSTAGRAM", contentType: "FEED", plannedAt: at(9, 12), status: "ATANDI",
      caption: "Kahve Durağı şubesinden sonbahar kareleri." },
    { key: "c3-m-shorts", a: "c3-mert", platform: "YOUTUBE", contentType: "SHORTS", plannedAt: at(6, 19), status: "TASLAK",
      caption: "Masa başı kahve molası: Balkabaklı Latte." },
    { key: "c3-m-community", a: "c3-mert", platform: "YOUTUBE", contentType: "COMMUNITY", plannedAt: at(8, 12), status: "TASLAK",
      caption: "Topluluk anketi: sonbaharın kahvesi hangisi?" },

    // C4 — taslak
    { key: "c4-z-reels", a: "c4-zeynep", platform: "INSTAGRAM", contentType: "REELS", plannedAt: at(35, 20), status: "TASLAK",
      caption: "SPF 50 Lumi Güneş Kremi ile şehirde yaz." },
    { key: "c4-z-tt", a: "c4-zeynep", platform: "TIKTOK", contentType: "VIDEO", plannedAt: at(40, 19), status: "TASLAK",
      caption: "Plajda ne kadar güneş kremi sürmeli? SPF 50 testi." },
  ];

  const flow: DeliverableStatus[] = [
    "TASLAK", "ATANDI", "BRIEF_GONDERILDI", "ICERIK_YUKLENDI", "ONAYLANDI", "YAYINLANDI", "METRIK_BEKLIYOR", "TAMAMLANDI",
  ];
  const influencerSteps = new Set<DeliverableStatus>(["ICERIK_YUKLENDI", "YAYINLANDI"]);

  function pathTo(status: DeliverableStatus, withRevision: boolean): DeliverableStatus[] {
    if (status === "IPTAL") return ["TASLAK", "ATANDI", "IPTAL"];
    if (status === "REVIZYON") return ["TASLAK", "ATANDI", "BRIEF_GONDERILDI", "ICERIK_YUKLENDI", "REVIZYON"];
    const idx = flow.indexOf(status);
    const p = flow.slice(0, idx + 1);
    if (withRevision && idx >= flow.indexOf("ONAYLANDI")) {
      p.splice(p.indexOf("ONAYLANDI"), 0, "REVIZYON", "ICERIK_YUKLENDI");
    }
    return p;
  }

  const completed: string[] = [];
  const dl: Record<string, { id: string; plannedAt: Date }> = {};
  let revisionToggle = false;

  for (const s of dspecs) {
    const a = asg[s.a];
    if (!a) throw new Error(`atama yok: ${s.a}`);
    const infRec = I(a.i);
    const c = C(a.c);
    const account = infRec.accounts.get(s.platform);
    if (!account) throw new Error(`${infRec.name} için ${s.platform} hesabı yok`);
    assertContentType(s.platform, s.contentType);

    const publishedAt =
      s.publishDelayMs !== undefined && ["METRIK_BEKLIYOR", "TAMAMLANDI"].includes(s.status)
        ? new Date(s.plannedAt.getTime() + s.publishDelayMs)
        : null;

    const created = await prisma.deliverable.create({
      data: {
        assignmentId: a.id, platform: s.platform, contentType: s.contentType,
        plannedAt: s.plannedAt, approvalDeadline: new Date(s.plannedAt.getTime() - 2 * DAY),
        status: s.status, caption: s.caption, hashtags: c.hashtags, mentions: c.mentions,
        disclosureRequired: true,
        postUrl: publishedAt && s.code ? postUrl(s.platform, account.handle, s.code) : null,
        publishedAt,
        createdAt: new Date(Math.min(s.plannedAt.getTime() - 12 * DAY, now.getTime() - 5 * DAY)),
      },
    });
    await prisma.deliverable.update({
      where: { id: created.id },
      data: {
        link: buildUtmLink(c.base, {
          platform: s.platform, influencerHandle: account.handle, campaignSlug: c.slug, deliverableId: created.id,
        }),
      },
    });
    dl[s.key] = { id: created.id, plannedAt: s.plannedAt };

    // Durum geçmişi
    revisionToggle = !revisionToggle;
    const steps = pathTo(s.status, revisionToggle && s.status === "TAMAMLANDI");
    const end = publishedAt ?? new Date(Math.min(now.getTime() - 2 * HOUR, s.plannedAt.getTime() - 3 * DAY));
    const prePublish = steps.filter((st) => !["YAYINLANDI", "METRIK_BEKLIYOR", "TAMAMLANDI"].includes(st));
    const changes: { from: DeliverableStatus | null; to: DeliverableStatus; at: Date; byUserId: string | null; note: string | null }[] = [];
    let prev: DeliverableStatus | null = null;
    prePublish.forEach((st, i) => {
      const atTime = new Date(end.getTime() - (prePublish.length - i) * DAY);
      changes.push({
        from: prev, to: st, at: atTime,
        byUserId: influencerSteps.has(st) ? infRec.userId : admin.id,
        note: st === "REVIZYON" ? "Ürün adı ilk 3 saniyede görünmüyor, kupon kodu eksik." : st === "IPTAL" ? s.caption : null,
      });
      prev = st;
    });
    if (publishedAt) {
      changes.push({ from: prev, to: "YAYINLANDI", at: publishedAt, byUserId: infRec.userId, note: null });
      changes.push({ from: "YAYINLANDI", to: "METRIK_BEKLIYOR", at: publishedAt, byUserId: null, note: "Otomatik" });
      prev = "METRIK_BEKLIYOR";
    }
    const metricTimes = (s.stages ?? [])
      .map((st) => new Date((publishedAt ?? now).getTime() + stageOffset[st]))
      .filter((d) => d <= now);
    if (s.status === "TAMAMLANDI") {
      const last = metricTimes[metricTimes.length - 1] ?? now;
      changes.push({ from: prev, to: "TAMAMLANDI", at: new Date(Math.min(last.getTime() + 2 * HOUR, now.getTime())), byUserId: admin.id, note: null });
    }
    await prisma.deliverableStatusChange.createMany({
      data: changes.map((ch) => ({ deliverableId: created.id, ...ch })),
    });

    // Taslak / ham dosyalar
    if (s.draft) {
      const fileName = `${s.key}-taslak-v${s.status === "REVIZYON" ? 1 : 2}.mp4`;
      await prisma.asset.create({
        data: {
          deliverableId: created.id, key: buildKey("TASLAK", { campaignId: c.id, deliverableId: created.id }, fileName),
          fileName, mime: "video/mp4", size: 48_211_904, kind: "TASLAK", direction: "INFLUENCER_TO_AJANS",
          uploadedById: infRec.userId, uploadStatus: "TAMAM",
        },
      });
    }
    if (s.raw && publishedAt) {
      const fileName = `${s.key}-ham.mov`;
      await prisma.asset.create({
        data: {
          deliverableId: created.id, key: buildKey("HAM_DOSYA", { campaignId: c.id, deliverableId: created.id }, fileName),
          fileName, mime: "video/quicktime", size: 734_003_200, kind: "HAM_DOSYA", direction: "INFLUENCER_TO_AJANS",
          usageDurationDays: 90, usageEndsAt: new Date(publishedAt.getTime() + 90 * DAY),
          usageChannel: "PAID_DAHIL", usageGeography: ["TR"],
          uploadedById: infRec.userId, uploadStatus: "TAMAM",
        },
      });
    }

    // Metrik snapshot'ları
    if (publishedAt) {
      for (const st of s.stages ?? []) {
        const measuredAt = new Date(publishedAt.getTime() + stageOffset[st] - HOUR);
        if (measuredAt > now) continue;
        const m = buildMetrics(s.platform, s.contentType, account.followers, account.er, st, s.metricFactor ?? 1);
        const withScreenshot = (s.screenshotStages ?? []).includes(st) || isStory(s);
        let screenshotAssetId: string | null = null;
        let source: MetricSource = "MANUEL";
        if (withScreenshot) {
          const fileName = s.screenshotName ?? `${s.key}-${st.toLowerCase()}-istatistik.png`;
          const asset = await prisma.asset.create({
            data: {
              deliverableId: created.id, key: buildKey("METRIK_SS", { campaignId: c.id, deliverableId: created.id }, fileName),
              fileName, mime: "image/png", size: 412_880, kind: "METRIK_SS", direction: "INFLUENCER_TO_AJANS",
              uploadedById: infRec.userId, uploadStatus: "TAMAM", createdAt: measuredAt,
            },
          });
          screenshotAssetId = asset.id;
          source = "EKRAN_GORUNTUSU";
        }
        await prisma.metricSnapshot.create({
          data: {
            deliverableId: created.id, stage: st, source, measuredAt, ...m,
            screenshotAssetId, enteredById: infRec.userId, createdAt: measuredAt,
          },
        });
      }
      if (s.brandData) {
        const measuredAt = new Date(Math.min(publishedAt.getTime() + 14 * DAY, now.getTime() - HOUR));
        await prisma.metricSnapshot.create({
          data: {
            deliverableId: created.id, stage: "ARA", source: "MARKA", measuredAt,
            clicks: s.brandData.clicks, sales: s.brandData.sales, revenueKurus: kurus(s.brandData.revenueTl),
            platformMetrics: {}, enteredById: admin.id, createdAt: measuredAt,
          },
        });
      }
    }

    if (s.status === "TAMAMLANDI") completed.push(created.id);
  }
  const D = (key: string) => {
    const r = dl[key];
    if (!r) throw new Error(`deliverable yok: ${key}`);
    return r;
  };

  // ───── Marka incelemeleri ─────
  await prisma.deliverableReview.createMany({
    data: [
      { deliverableId: D("c2-e-reels").id, brandUserId: brandUsers.mira.id, decision: "REVIZYON", note: "Paletin adı ilk 3 saniyede okunmuyor; kapanışta kupon kodunu ekranda tutalım.", createdAt: ago(5 * HOUR) },
      { deliverableId: D("c3-s-carousel").id, brandUserId: brandUsers.kahve.id, decision: "ONAY", note: "Görseller çok iyi, 3. karede şube adı da görünsün yeter.", createdAt: ago(3 * HOUR) },
      { deliverableId: D("c2-z-reels").id, brandUserId: brandUsers.mira.id, decision: "REVIZYON", note: "Gece makyajı geçişi daha uzun gösterilmeli.", createdAt: ago(2 * DAY) },
    ],
  });

  // ───── Ledger: tamamlanan işler için hakediş (çift kayıt) ─────
  await prisma.$transaction(
    async (tx) => {
      for (const id of completed) await recordEarning(tx, id, { id: admin.id, role: "ADMIN" });
    },
    { timeout: 60_000 },
  );

  // ───── Çekim talepleri ─────
  const infRow = async (key: string) =>
    prisma.influencer.findUniqueOrThrow({ where: { id: I(key).id }, select: { iban: true, ibanHolder: true } });
  const zeynepIban = await infRow("zeynep");
  const eceIban = await infRow("ece");
  const defneIban = await infRow("defne");

  const sentBatch = await prisma.payoutBatch.create({ data: { createdById: admin.id, format: "CSV", createdAt: ago(9 * DAY) } });
  const openBatch = await prisma.payoutBatch.create({ data: { createdById: admin.id, format: "XML", createdAt: ago(1 * DAY) } });

  const sentPayout = await prisma.payoutRequest.create({
    data: {
      influencerId: I("zeynep").id, amountKurus: kurus(20_000), status: "ODEME_LISTESINDE",
      ibanSnapshot: zeynepIban.iban, ibanHolderSnapshot: zeynepIban.ibanHolder,
      adminNote: "Fatura alındı (FTR-2026-118).", batchId: sentBatch.id,
      createdAt: ago(12 * DAY), approvedAt: ago(10 * DAY),
    },
  });
  await prisma.$transaction((tx) => recordPayoutSent(tx, sentPayout.id, { id: admin.id, role: "ADMIN" }));

  await prisma.payoutRequest.createMany({
    data: [
      {
        influencerId: I("zeynep").id, amountKurus: kurus(15_000), status: "TALEP_EDILDI",
        ibanSnapshot: zeynepIban.iban, ibanHolderSnapshot: zeynepIban.ibanHolder, createdAt: ago(6 * HOUR),
      },
      {
        influencerId: I("ece").id, amountKurus: kurus(30_000), status: "ODEME_LISTESINDE",
        ibanSnapshot: eceIban.iban, ibanHolderSnapshot: eceIban.ibanHolder,
        adminNote: "Stopaj kesintisi muhasebeye iletildi.", batchId: openBatch.id,
        createdAt: ago(3 * DAY), approvedAt: ago(2 * DAY),
      },
      {
        influencerId: I("defne").id, amountKurus: kurus(25_000), status: "ONAYLANDI",
        ibanSnapshot: defneIban.iban, ibanHolderSnapshot: defneIban.ibanHolder,
        adminNote: "Gider pusulası düzenlenecek.", createdAt: ago(2 * DAY), approvedAt: ago(1 * DAY),
      },
    ],
  });

  // ───── Agent bulguları (açık) ─────
  const runs: {
    check: "BRIEF_UYUM" | "YAYIN_KONTROL" | "SILINME_KONTROL" | "METRIK_TUTARLILIK" | "SAHTE_ETKILESIM" | "HEDEF_PROJEKSIYON";
    targetType: string; targetId: string; severity: Severity; summary: string; findings: Record<string, unknown>;
    model: string; promptVersion: string; createdAt: Date;
  }[] = [
    {
      check: "BRIEF_UYUM", targetType: "Deliverable", targetId: D("c2-e-reels").id, severity: "UYARI",
      summary: "Taslakta #BaharMakyajı hashtag'i ve \"lansmana özel\" ifadesi eksik.",
      findings: { missingHashtags: ["#BaharMakyajı"], missingPhrases: ["lansmana özel"], bannedPhrases: [], disclosureOk: true },
      model: "mock-v1", promptVersion: "brief-uyum@1", createdAt: ago(4 * HOUR),
    },
    {
      check: "YAYIN_KONTROL", targetType: "Deliverable", targetId: D("c3-c-story").id, severity: "UYARI",
      summary: "Planlanan saatten 30 dakika sonra paylaşım bağlantısı girilmedi.",
      findings: { plannedAt: D("c3-c-story").plannedAt.toISOString(), postUrl: null },
      model: "kural", promptVersion: "yayin-kontrol@1", createdAt: new Date(D("c3-c-story").plannedAt.getTime() + 30 * 60_000),
    },
    {
      check: "SILINME_KONTROL", targetType: "Deliverable", targetId: D("c3-s-tt").id, severity: "KRITIK",
      summary: "TikTok içeriği erişilemiyor (silinmiş olabilir). Sözleşme ihlali şüphesi.",
      findings: { httpStatus: 404, checkedAt: ago(2 * HOUR).toISOString() },
      model: "kural", promptVersion: "silinme-kontrol@1", createdAt: ago(2 * HOUR),
    },
    {
      check: "METRIK_TUTARLILIK", targetType: "Deliverable", targetId: D("c3-c-reels").id, severity: "UYARI",
      summary: "Ekran görüntüsündeki erişim, forma girilen değerden %30 düşük okunuyor.",
      findings: { field: "reach", reportedDelta: -0.3 },
      model: "mock-v1", promptVersion: "metrik-tutarlilik@1", createdAt: ago(20 * HOUR),
    },
    {
      check: "SAHTE_ETKILESIM", targetType: "Influencer", targetId: I("kaan").id, severity: "UYARI",
      summary: "Son ayda takipçi %85 arttı, ER %0,6'ya düştü. Risk skoru 72.",
      findings: { riskScore: 72, followerGrowth30d: 0.85, engagementRate: 0.006 },
      model: "mock-v1", promptVersion: "sahte-etkilesim@1", createdAt: ago(1 * DAY),
    },
    {
      check: "HEDEF_PROJEKSIYON", targetType: "Campaign", targetId: C("c3").id, severity: "BILGI",
      summary: "Kahve Durağı Sonbahar Menüsü mevcut eğriyle satış hedefinin %47'sinde kalıyor.",
      findings: { kpi: "sales", projectionRatio: 0.47 },
      model: "kural", promptVersion: "hedef-projeksiyon@1", createdAt: ago(7 * HOUR),
    },
  ];
  await prisma.agentRun.createMany({
    data: runs.map((r) => ({
      targetType: r.targetType, targetId: r.targetId, checkType: r.check, findings: r.findings as object,
      summary: r.summary, severity: r.severity, status: "ACIK" as const, model: r.model,
      promptVersion: r.promptVersion, idempotencyKey: `${r.check}:${r.targetType}:${r.targetId}:seed`,
      createdAt: r.createdAt,
    })),
  });
  // Silinme kontrolündeki içerik için sözleşme ihlali bayrağı.
  await prisma.deliverable.update({ where: { id: D("c3-s-tt").id }, data: { contractViolation: true } });

  // ───── Bildirimler ─────
  await prisma.notification.createMany({
    data: [
      { userId: admin.id, title: "Yeni çekim talebi", body: "Zeynep Yıldız 15.000,00 ₺ çekim talebi oluşturdu.", href: "/admin/finans", createdAt: ago(6 * HOUR) },
      { userId: admin.id, title: "Kritik agent uyarısı", body: "Selin Çelik'in TikTok videosu erişilemiyor.", href: "/admin", createdAt: ago(2 * HOUR) },
      { userId: I("ece").userId, title: "Story hatırlatması", body: "Mira Bahar Story'nin metrik ekran görüntüsünü 4 saat içinde yükle.", href: "/influencer", createdAt: ago(1 * HOUR) },
      { userId: I("zeynep").userId, title: "Paylaşım saati güncellendi", body: "Mira Bahar TikTok videonun yayın saati 19:00 olarak güncellendi.", href: "/influencer", createdAt: ago(1 * DAY) },
      { userId: I("burak").userId, title: "Brief gönderildi", body: "Mira Bahar Lansmanı brief v2 hazır.", href: "/influencer", createdAt: ago(2 * DAY), readAt: ago(1 * DAY) },
      { userId: brandUsers.mira.id, title: "Onay bekleyen taslak", body: "Ece Şahin'in Reels taslağı incelemenizi bekliyor.", href: "/marka", createdAt: ago(8 * HOUR) },
      { userId: brandUsers.kahve.id, title: "Onay bekleyen taslak", body: "Selin Çelik'in Carousel taslağı incelemenizi bekliyor.", href: "/marka", createdAt: ago(4 * HOUR) },
    ],
  });

  const counts = {
    deliverables: await prisma.deliverable.count(),
    snapshots: await prisma.metricSnapshot.count(),
    ledger: await prisma.ledgerEntry.count(),
    payouts: await prisma.payoutRequest.count(),
    agentRuns: await prisma.agentRun.count(),
  };
  await seedAddon();
  console.log("seed: tamamlandı", counts);
  console.log(`\nGiriş bilgileri (yalnızca geliştirme, şifre: ${PASSWORD})`);
  const users = await prisma.user.findMany({ orderBy: [{ role: "asc" }, { email: "asc" }], select: { email: true, role: true, name: true } });
  for (const u of users) console.log(`  ${u.role.padEnd(10)} ${u.email.padEnd(28)} ${u.name}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await closeAuditPool();
  });
