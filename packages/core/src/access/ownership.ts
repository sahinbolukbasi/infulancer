import type { Tx } from "../db";
import { DomainError } from "../domain/errors";
import type { Actor } from "./actor";

/**
 * Sahiplik kontrolleri: marka → kendi kampanyaları, influencer → kendi atamaları.
 * Admin her şeye erişir. Kayıt yoksa ya da erişim yoksa aynı hata döner
 * (varlık sızdırmamak için).
 */

const notFound = () => new DomainError("BULUNAMADI", "Kayıt bulunamadı veya erişim yetkiniz yok.");

export async function assertCampaignAccess(db: Tx, actor: Actor, campaignId: string) {
  const campaign = await db.campaign.findUnique({
    where: { id: campaignId },
    select: { id: true, brandId: true },
  });
  if (!campaign) throw notFound();
  if (actor.role === "ADMIN") return campaign;
  if (actor.role === "BRAND") {
    if (campaign.brandId !== actor.brandId) throw notFound();
    return campaign;
  }
  const assignment = await db.assignment.findFirst({
    where: {
      campaignId,
      influencerId: actor.influencerId ?? "__none__",
      contractStatus: { not: "RED" },
    },
    select: { id: true },
  });
  if (!assignment) throw notFound();
  return campaign;
}

export async function assertAssignmentAccess(db: Tx, actor: Actor, assignmentId: string) {
  const assignment = await db.assignment.findUnique({
    where: { id: assignmentId },
    select: { id: true, influencerId: true, campaignId: true, campaign: { select: { brandId: true } } },
  });
  if (!assignment) throw notFound();
  if (actor.role === "ADMIN") return assignment;
  if (actor.role === "BRAND" && assignment.campaign.brandId === actor.brandId) return assignment;
  if (actor.role === "INFLUENCER" && assignment.influencerId === actor.influencerId) return assignment;
  throw notFound();
}

export async function assertDeliverableAccess(db: Tx, actor: Actor, deliverableId: string) {
  const deliverable = await db.deliverable.findUnique({
    where: { id: deliverableId },
    select: {
      id: true,
      assignmentId: true,
      assignment: {
        select: { influencerId: true, campaignId: true, campaign: { select: { brandId: true } } },
      },
    },
  });
  if (!deliverable) throw notFound();
  if (actor.role === "ADMIN") return deliverable;
  if (actor.role === "BRAND" && deliverable.assignment.campaign.brandId === actor.brandId) {
    return deliverable;
  }
  if (actor.role === "INFLUENCER" && deliverable.assignment.influencerId === actor.influencerId) {
    return deliverable;
  }
  throw notFound();
}
