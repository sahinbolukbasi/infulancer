/**
 * Yapılandırma tohum değerleri. Çalışma zamanında config_values tablosundan okunur
 * (src/config/store.ts); bu dosya yalnızca ilk kurulumda tabloya yazılan başlangıç
 * değerlerini ve tiplerini tanımlar. `verified=false` olan değerler UI'da
 * "doğrulanmadı" etiketiyle gösterilir.
 */
export type HalfDay = { date: string; until: string };

export type ConfigShape = {
  /** Türkiye resmî tatilleri (YYYY-MM-DD) — her yıl güncellenir. */
  "calendar.tr.holidays": string[];
  /** Yarım gün (arife) — saat 13:00'ten sonrası iş günü sayılmaz. */
  "calendar.tr.halfDays": HalfDay[];
  "whatsapp.tiers": string[];
  "whatsapp.freeServicePerNumberPerMonth": number;
  "whatsapp.serviceWindowHours": number;
  "whatsapp.fepWindowDays": number;
  "whatsapp.humanAgentWindowDays": number;
  "whatsapp.windowWarningMinutes": number;
  "whatsapp.templatePauseHours": number[];
  "whatsapp.throughputByLevel": Record<string, number>;
  "whatsapp.graphApiVersion": string;
  "meta.ads.writeLimits": {
    mutationQps: number;
    sameObjectEditSeconds: number;
    spendCapChangesPerDay: number;
    adSetBudgetChangesPerHour: number;
  };
  "meta.ads.quota": {
    full: { adsManagementBase: number; adsInsightsBase: number; customAudienceBase: number; maxScore: number; blockSeconds: number };
    development: { adsManagementBase: number; adsInsightsBase: number; customAudienceBase: number; maxScore: number; blockSeconds: number };
    perActiveAd: { adsManagement: number; adsInsights: number };
    perActiveAudience: number;
    customAudienceCap: number;
    decaySeconds: number;
    readPoints: number;
    writePoints: number;
    fullAccessThreshold: { calls: number; days: number; maxErrorRate: number; window: number };
  };
  "bedrock.models": { text: string; vision: string; embedding: string; region: string };
  "bedrock.guardrails": { enabled: boolean; guardrailId: string | null; version: string | null };
  "rag.embeddingDims": number;
  "iys.batch": { maxPerRequest: number; chunkSize: number; slaBusinessDays: number; alarmAfterBusinessDays: number };
  "kvkk.filingBusinessDays": number;
  "pricing.metaBusinessAgent": { usdPerMillionTokens: number; usdPerMessageApprox: [number, number] };
  "pricing.competitors": { name: string; detail: string }[];
  "pricing.bsp360dialog": { tier: string; eurPerMonth: number; channels: number }[];
  "pricing.markup": { messageMarkupPct: number; creditUsd: number; creditMarkup: [number, number] };
  "tax.gvk103.fourthBracketTry": { year: number; amount: number | null };
  "tiktok.contentPosting": { unauditedMaxUsersPer24h: number };
  "features": Record<string, boolean>;
  "sensitive.keywords": Record<string, string[]>;
  "policy.prohibitedVerticals": { key: string; label: string; banned: boolean }[];
  "creative.knownPersons": string[];
};

export type ConfigKey = keyof ConfigShape;

type Entry<K extends ConfigKey> = { value: ConfigShape[K]; verified: boolean; note: string };

export const defaultConfig: { [K in ConfigKey]: Entry<K> } = {
  "calendar.tr.holidays": {
    verified: false,
    note: "Resmî tatiller (dini bayram tarihleri Diyanet takvimine göre her yıl teyit edilmeli)",
    value: [
      "2026-01-01", "2026-03-20", "2026-03-21", "2026-03-22", "2026-04-23", "2026-05-01", "2026-05-19",
      "2026-05-27", "2026-05-28", "2026-05-29", "2026-05-30", "2026-07-15", "2026-08-30", "2026-10-29",
      "2027-01-01", "2027-03-10", "2027-03-11", "2027-03-12", "2027-04-23", "2027-05-01", "2027-05-16",
      "2027-05-17", "2027-05-18", "2027-05-19", "2027-07-15", "2027-08-30", "2027-10-29",
    ],
  },
  "calendar.tr.halfDays": {
    verified: false,
    note: "Arife yarım günleri",
    value: [
      { date: "2026-03-19", until: "13:00" },
      { date: "2026-05-26", until: "13:00" },
      { date: "2026-10-28", until: "13:00" },
      { date: "2027-03-09", until: "13:00" },
      { date: "2027-05-15", until: "13:00" },
      { date: "2027-10-28", until: "13:00" },
    ],
  },
  "whatsapp.tiers": { verified: true, note: "Tekil alıcı / 24 saat hareketli pencere; portfolio düzeyinde", value: ["TIER_250", "TIER_2K", "TIER_10K", "TIER_100K", "TIER_UNLIMITED"] },
  "whatsapp.freeServicePerNumberPerMonth": { verified: true, note: "Numara başına, devretmez", value: 1000 },
  "whatsapp.serviceWindowHours": { verified: true, note: "", value: 24 },
  "whatsapp.fepWindowDays": { verified: true, note: "Click-to-WhatsApp ücretsiz giriş noktası", value: 7 },
  "whatsapp.humanAgentWindowDays": { verified: true, note: "IG/Messenger HUMAN_AGENT", value: 7 },
  "whatsapp.windowWarningMinutes": { verified: true, note: "", value: 15 },
  "whatsapp.templatePauseHours": { verified: true, note: "1. ve 2. duraklatma; 3.'de devre dışı", value: [3, 6] },
  "whatsapp.throughputByLevel": { verified: false, note: "phone_number_quality_update'ten öğrenilir", value: {} },
  "whatsapp.graphApiVersion": { verified: false, note: "Meta Graph API sürümü", value: "v24.0" },
  "meta.ads.writeLimits": {
    verified: true,
    note: "Mutation 100 QPS, aynı nesne 30 sn, harcama limiti günde 10, ad set bütçe saatte 4",
    value: { mutationQps: 100, sameObjectEditSeconds: 30, spendCapChangesPerDay: 10, adSetBudgetChangesPerHour: 4 },
  },
  "meta.ads.quota": {
    verified: true,
    note: "Marketing API Access Tier (4 Mayıs 2026)",
    value: {
      full: { adsManagementBase: 100_000, adsInsightsBase: 190_000, customAudienceBase: 190_000, maxScore: 9000, blockSeconds: 60 },
      development: { adsManagementBase: 300, adsInsightsBase: 600, customAudienceBase: 5000, maxScore: 60, blockSeconds: 300 },
      perActiveAd: { adsManagement: 40, adsInsights: 400 },
      perActiveAudience: 40,
      customAudienceCap: 700_000,
      decaySeconds: 300,
      readPoints: 1,
      writePoints: 3,
      fullAccessThreshold: { calls: 500, days: 15, maxErrorRate: 0.15, window: 500 },
    },
  },
  "bedrock.models": {
    verified: true,
    note: "eu-central-1'de list-foundation-models ile doğrulandı (Kasım 2026)",
    value: {
      text: "eu.anthropic.claude-haiku-4-5-20251001-v1:0",
      vision: "eu.anthropic.claude-haiku-4-5-20251001-v1:0",
      embedding: "amazon.titan-embed-text-v2:0",
      region: "eu-central-1",
    },
  },
  "bedrock.guardrails": { verified: false, note: "Guardrail ID kurulumda atanır", value: { enabled: true, guardrailId: null, version: null } },
  "rag.embeddingDims": { verified: true, note: "", value: 256 },
  "iys.batch": { verified: true, note: "iys-register 1–5.000, atomik (422)", value: { maxPerRequest: 5000, chunkSize: 1000, slaBusinessDays: 3, alarmAfterBusinessDays: 1 } },
  "kvkk.filingBusinessDays": { verified: true, note: "Standart sözleşme imzasından sonra", value: 5 },
  "pricing.metaBusinessAgent": { verified: false, note: "Meta Business Agent kategorisi", value: { usdPerMillionTokens: 2, usdPerMessageApprox: [0.04, 0.05] } },
  "pricing.competitors": {
    verified: false,
    note: "Kamuya açık fiyat sayfaları (Kasım 2026)",
    value: [
      { name: "Respond.io", detail: "Kademe başına 5.000–40.000 kredi, aşım $15/1.000, tavan kotanın %200'ü" },
      { name: "Trengo", detail: "AI ile işlenen konuşma başına €0,25–0,30" },
      { name: "ManyChat", detail: "Pro $29/ay, AI dahil (RAG değil)" },
      { name: "Desk360", detail: "Panel, koltuk, mesaj ve ek numara ücreti yok" },
      { name: "Teamfluencer", detail: "₺1.999 / ₺9.999 / ₺39.999" },
    ],
  },
  "pricing.bsp360dialog": {
    verified: false,
    note: "360dialog partner-paid referansı",
    value: [
      { tier: "Starter", eurPerMonth: 250, channels: 5 },
      { tier: "Growth", eurPerMonth: 500, channels: 10 },
      { tier: "Premium", eurPerMonth: 1000, channels: 20 },
    ],
  },
  "pricing.markup": { verified: false, note: "Ürün kararı", value: { messageMarkupPct: 0, creditUsd: 0.05, creditMarkup: [3, 5] } },
  "tax.gvk103.fourthBracketTry": { verified: false, note: "gib.gov.tr'den yıllık okunup girilmeli", value: { year: 2026, amount: null } },
  "tiktok.contentPosting": { verified: true, note: "Audit öncesi", value: { unauditedMaxUsersPer24h: 5 } },
  "features": {
    verified: true,
    note: "Özellik bayrakları",
    value: {
      "tokens.refresh": false,
      "tiktok.sparkAdsAuthCode": false,
      "creative.flux": false,
      "creative.researchModels": false,
      "whatsapp.calling": false,
    },
  },
  "sensitive.keywords": {
    verified: true,
    note: "Hassas konu → insana aktarma",
    value: {
      saglik: ["ilaç", "hastalık", "doktor", "tedavi", "reçete", "alerji"],
      odeme: ["kart numarası", "kredi kartı", "cvv", "iban", "ödeme sorunu", "para iadesi"],
      hukuki: ["avukat", "dava", "mahkeme", "tüketici hakem", "ihtarname"],
      kvkk: ["kvkk", "kişisel verilerimi", "verilerimin silinmesi", "veri sahibi", "unutulma hakkı"],
      sikayet: ["şikayet", "rezalet", "berbat", "dolandırıcı", "memnun değilim", "iade istiyorum"],
    },
  },
  "policy.prohibitedVerticals": {
    verified: true,
    note: "WhatsApp Business Platform yasak/kısıtlı dikeyler",
    value: [
      { key: "siyaset", label: "Siyasi parti / politikacı", banned: true },
      { key: "silah", label: "Silah", banned: false },
      { key: "alkol_tutun", label: "Alkol ve tütün", banned: false },
      { key: "uyusturucu", label: "Uyuşturucu", banned: false },
      { key: "medikal", label: "Medikal ürünler", banned: false },
      { key: "kumar", label: "Gerçek parayla kumar", banned: false },
      { key: "yetiskin", label: "Yetişkin ürünleri", banned: false },
      { key: "flort", label: "Flört hizmetleri", banned: false },
      { key: "mlm", label: "Çok katlı pazarlama (MLM)", banned: false },
      { key: "borc", label: "Payday / borç tahsilat kredisi", banned: false },
    ],
  },
  "creative.knownPersons": { verified: false, note: "md. 27/12 — ek tanınmış kişi listesi (sistemdeki influencer'lar otomatik eklenir)", value: [] },
};
