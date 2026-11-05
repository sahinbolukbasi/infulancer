import { randomUUID } from "node:crypto";
import { prisma } from "../db";
import { DomainError } from "../domain/errors";

/**
 * Reklam taslağı akışı (MOCK): Creative çıktısı veya metinden Meta/TikTok reklam taslağı
 * hazırlanır ve onay kuyruğuna alınır. GERÇEK YAYIN/HARCAMA YOKTUR — taslaklar yalnız
 * TASLAK → ONAY_BEKLIYOR → ONAYLANDI/REDDEDILDI durumları arasında dolaşır. Canlı yayın,
 * Meta/TikTok anahtarları eklendiğinde ayrı bir adımda devreye girecektir.
 */
export type AdPlatform = "META" | "TIKTOK";

export const AD_OBJECTIVES: { key: string; label: string; platforms: AdPlatform[] }[] = [
  { key: "TRAFFIC", label: "Trafik (web sitesine yönlendirme)", platforms: ["META", "TIKTOK"] },
  { key: "ENGAGEMENT", label: "Etkileşim (beğeni, yorum, DM)", platforms: ["META", "TIKTOK"] },
  { key: "REACH", label: "Erişim (mümkün olduğunca çok kişi)", platforms: ["META", "TIKTOK"] },
  { key: "LEADS", label: "Potansiyel müşteri (form/DM)", platforms: ["META", "TIKTOK"] },
  { key: "SALES", label: "Satış / dönüşüm", platforms: ["META", "TIKTOK"] },
  { key: "VIDEO_VIEWS", label: "Video izlenme", platforms: ["TIKTOK"] },
];

export function objectivesFor(platform: AdPlatform) {
  return AD_OBJECTIVES.filter((o) => o.platforms.includes(platform));
}

export type CreateDraftInput = {
  tenantId: string;
  platform: AdPlatform;
  name: string;
  objective: string;
  dailyBudgetKurus: number;
  primaryText: string;
  assetId?: string | null;
  campaignId?: string | null;
  createdByUserId?: string | null;
  batchId?: string | null;
};

function assertObjective(platform: AdPlatform, objective: string) {
  if (!objectivesFor(platform).some((o) => o.key === objective)) {
    throw new DomainError("DOGRULAMA", "Seçilen hedef bu platformda desteklenmiyor.");
  }
}

/** Tek bir reklam taslağı oluşturur (TASLAK durumunda). */
export async function createAdDraft(input: CreateDraftInput) {
  assertObjective(input.platform, input.objective);
  if (input.dailyBudgetKurus < 1000) throw new DomainError("DOGRULAMA", "Günlük bütçe en az 10 TL olmalı.");
  if (input.assetId) {
    const asset = await prisma.generatedAsset.findFirst({ where: { id: input.assetId, tenantId: input.tenantId }, select: { id: true } });
    if (!asset) throw new DomainError("BULUNAMADI", "Seçilen görsel bulunamadı.");
  }
  return prisma.adDraft.create({
    data: {
      tenantId: input.tenantId,
      platform: input.platform,
      name: input.name,
      objective: input.objective,
      dailyBudgetKurus: input.dailyBudgetKurus,
      primaryText: input.primaryText,
      assetId: input.assetId ?? null,
      campaignId: input.campaignId ?? null,
      createdByUserId: input.createdByUserId ?? null,
      batchId: input.batchId ?? null,
    },
  });
}

/** Toplu oluşturma: tek seferde birden çok platform/taslak. Aynı batchId ile gruplanır. */
export async function createAdDraftsBulk(base: Omit<CreateDraftInput, "platform" | "batchId">, platforms: AdPlatform[]) {
  if (!platforms.length) throw new DomainError("DOGRULAMA", "En az bir platform seçin.");
  const batchId = randomUUID();
  const created = [];
  for (const platform of [...new Set(platforms)]) {
    // Hedef platformda desteklenmiyorsa o platform için ilk uygun hedefe düş.
    const objective = objectivesFor(platform).some((o) => o.key === base.objective) ? base.objective : objectivesFor(platform)[0]!.key;
    created.push(await createAdDraft({ ...base, platform, objective, batchId }));
  }
  return { batchId, drafts: created };
}

const TRANSITIONS: Record<string, string[]> = {
  TASLAK: ["ONAY_BEKLIYOR"],
  ONAY_BEKLIYOR: ["ONAYLANDI", "REDDEDILDI"],
  ONAYLANDI: [],
  REDDEDILDI: ["ONAY_BEKLIYOR"],
};

export type AdDraftStatus = "TASLAK" | "ONAY_BEKLIYOR" | "ONAYLANDI" | "REDDEDILDI";

/**
 * Durum geçişi. ONAYLANDI yalnız onay anlamına gelir; HİÇBİR dış API çağrılmaz, harcama
 * başlamaz. Canlı yayın anahtarlar eklendiğinde ayrı adımda ele alınır.
 */
export async function transitionAdDraft(tenantId: string, id: string, to: AdDraftStatus, reviewNote?: string | null) {
  const d = await prisma.adDraft.findFirst({ where: { id, tenantId } });
  if (!d) throw new DomainError("BULUNAMADI", "Reklam taslağı bulunamadı.");
  if (!TRANSITIONS[d.status]!.includes(to)) {
    throw new DomainError("KURAL_IHLALI", `'${d.status}' durumundan '${to}' durumuna geçilemez.`);
  }
  return prisma.adDraft.update({ where: { id }, data: { status: to, reviewNote: reviewNote ?? null } });
}
