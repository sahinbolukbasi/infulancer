import { audit } from "../audit";
import type { Tx } from "../db";
import { toAuditActor, type Actor } from "../access/actor";
import { DomainError } from "./errors";

/**
 * Marka çakışması / münhasırlık kontrolü (atama öncesi bloklar).
 * - Influencer son 30 günde rakip markayla (aynı kategori veya rakip listesinde) çalıştıysa
 * - veya aktif bir münhasırlık penceresi (kampanya bitişi + exclusivityDays) hedef kategoriyi kapsıyorsa
 * atama engellenir. Admin yalnızca yazılı gerekçeyle ezebilir; ezme audit'e ve AgentRun'a yazılır.
 */

export const CONFLICT_LOOKBACK_DAYS = 30;
export const MIN_OVERRIDE_REASON_LENGTH = 10;
const DAY_MS = 24 * 60 * 60 * 1000;

export type BrandConflict = {
  type: "RAKIP_30_GUN" | "MUNHASIRLIK";
  assignmentId: string;
  campaignId: string;
  campaignName: string;
  brandId: string;
  brandName: string;
  until: Date;
  message: string;
};

export type BrandConflictResult = { blocked: boolean; conflicts: BrandConflict[] };

type BrandLite = { id: string; name: string; category: string; competitorBrandIds: string[] };

export function areCompetitors(a: BrandLite, b: BrandLite): boolean {
  if (a.id === b.id) return false;
  return (
    a.category.toLocaleLowerCase("tr") === b.category.toLocaleLowerCase("tr") ||
    a.competitorBrandIds.includes(b.id) ||
    b.competitorBrandIds.includes(a.id)
  );
}

const fmt = (d: Date) =>
  new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeZone: "Europe/Istanbul" }).format(d);

export async function checkBrandConflict(
  db: Tx,
  input: { influencerId: string; campaignId: string; now?: Date },
): Promise<BrandConflictResult> {
  const now = input.now ?? new Date();
  const campaign = await db.campaign.findUnique({
    where: { id: input.campaignId },
    select: {
      id: true,
      brand: { select: { id: true, name: true, category: true, competitorBrandIds: true } },
    },
  });
  if (!campaign) throw new DomainError("BULUNAMADI", "Kampanya bulunamadı.");
  const target = campaign.brand;

  const others = await db.assignment.findMany({
    where: {
      influencerId: input.influencerId,
      contractStatus: { not: "RED" },
      campaignId: { not: input.campaignId },
      campaign: { status: { not: "IPTAL" } },
    },
    select: {
      id: true,
      exclusivityDays: true,
      exclusivityCategory: true,
      campaign: {
        select: {
          id: true,
          name: true,
          endsAt: true,
          brand: { select: { id: true, name: true, category: true, competitorBrandIds: true } },
        },
      },
    },
  });

  const conflicts: BrandConflict[] = [];
  const lookbackStart = now.getTime() - CONFLICT_LOOKBACK_DAYS * DAY_MS;

  for (const a of others) {
    const other = a.campaign.brand;
    if (other.id === target.id) continue;
    const base = {
      assignmentId: a.id,
      campaignId: a.campaign.id,
      campaignName: a.campaign.name,
      brandId: other.id,
      brandName: other.name,
    };

    if (areCompetitors(target, other) && a.campaign.endsAt.getTime() >= lookbackStart) {
      const until = new Date(a.campaign.endsAt.getTime() + CONFLICT_LOOKBACK_DAYS * DAY_MS);
      conflicts.push({
        ...base,
        type: "RAKIP_30_GUN",
        until,
        message: `Son ${CONFLICT_LOOKBACK_DAYS} günde rakip marka ${other.name} ile çalıştı ("${a.campaign.name}"). ${fmt(until)} tarihine kadar engelli.`,
      });
    }

    if (a.exclusivityDays > 0) {
      const until = new Date(a.campaign.endsAt.getTime() + a.exclusivityDays * DAY_MS);
      const category = (a.exclusivityCategory ?? other.category).toLocaleLowerCase("tr");
      if (now <= until && category === target.category.toLocaleLowerCase("tr")) {
        conflicts.push({
          ...base,
          type: "MUNHASIRLIK",
          until,
          message: `${other.name} ile "${category}" kategorisinde münhasırlık ${fmt(until)} tarihine kadar sürüyor.`,
        });
      }
    }
  }

  return { blocked: conflicts.length > 0, conflicts };
}

/**
 * Çakışma varsa engeller; admin gerekçe verdiyse ezmeyi audit + AgentRun
 * (MARKA_CAKISMASI) olarak kaydeder. prisma.$transaction içinde çağrılmalıdır.
 * Dönen değer: ezme gerekçesi (Assignment.conflictOverrideReason'a yazılır) veya null.
 */
export async function enforceBrandConflict(
  tx: Tx,
  input: { influencerId: string; campaignId: string; actor: Actor; overrideReason?: string | null },
): Promise<{ overrideReason: string | null; result: BrandConflictResult }> {
  const result = await checkBrandConflict(tx, input);
  if (!result.blocked) return { overrideReason: null, result };

  const reason = input.overrideReason?.trim() ?? "";
  if (input.actor.role !== "ADMIN" || reason.length < MIN_OVERRIDE_REASON_LENGTH) {
    throw new DomainError(
      "CAKISMA",
      result.conflicts.map((c) => c.message).join(" "),
      { conflicts: result.conflicts },
    );
  }

  const key = `MARKA_CAKISMASI:Influencer:${input.influencerId}:${input.campaignId}`;
  await tx.agentRun.upsert({
    where: { idempotencyKey: key },
    create: {
      targetType: "Influencer",
      targetId: input.influencerId,
      checkType: "MARKA_CAKISMASI",
      findings: { campaignId: input.campaignId, conflicts: result.conflicts, overrideReason: reason },
      summary: `Marka çakışması admin tarafından ezildi: ${reason}`,
      severity: "UYARI",
      status: "EZILDI",
      model: "kural",
      promptVersion: "brand-conflict@1",
      idempotencyKey: key,
      resolvedById: input.actor.userId,
      resolutionNote: reason,
      resolvedAt: new Date(),
    },
    update: {},
  });
  await audit.append({
    actor: toAuditActor(input.actor),
    action: "BRAND_CONFLICT_OVERRIDE",
    entityType: "Campaign",
    entityId: input.campaignId,
    data: { influencerId: input.influencerId, reason, conflicts: result.conflicts },
  });
  return { overrideReason: reason, result };
}
