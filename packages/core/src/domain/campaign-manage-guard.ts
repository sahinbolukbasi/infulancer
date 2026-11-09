import { prisma } from "../db";
import type { Actor } from "../access/actor";
import { DomainError } from "./errors";

type TxLike = {
  campaign: { findUnique: typeof prisma.campaign.findUnique };
  assignment?: { findUnique: typeof prisma.assignment.findUnique };
  deliverable?: { findUnique: typeof prisma.deliverable.findUnique };
};

function allow(
  actor: Actor,
  c: { brandId: string; executionMode: string; status: string },
): { brandId: string; executionMode: string; status: string } {
  if (actor.role === "ADMIN" || actor.role === "AGENCY") return c;
  if (actor.role === "BRAND" && actor.brandId === c.brandId && c.executionMode === "SELF") return c;
  if (actor.role === "BRAND" && actor.brandId === c.brandId && c.executionMode === "AJANS") {
    throw new DomainError("YETKISIZ", "Bu kampanyayı ajansa devrettiniz. Influencer ataması ve yayın kontrolü ajanstadır.");
  }
  throw new DomainError("YETKISIZ", "Bu kampanyayı yönetme yetkiniz yok.");
}

/**
 * Kampanyada operasyonel yönetim (influencer atama, içerik planı, yayına alma, kapatma) yetkisi:
 *  - ADMIN/AGENCY: her kampanya.
 *  - BRAND: yalnız kendi markasının SELF (kendi yürüttüğü) kampanyası.
 * AJANS moduna devredilmiş kampanyada marka yönetemez (yalnız izler / taslak düzenler).
 */
export async function assertCanManageCampaign(actor: Actor, campaignId: string, tx: TxLike = prisma) {
  const c = await tx.campaign.findUnique({ where: { id: campaignId }, select: { brandId: true, executionMode: true, status: true } });
  if (!c) throw new DomainError("BULUNAMADI", "Kampanya bulunamadı.");
  return allow(actor, c);
}

/** assignmentId üzerinden aynı kontrol (içerik planı tek atamaya girilirken). */
export async function assertCanManageByAssignment(actor: Actor, assignmentId: string, tx: TxLike = prisma) {
  const a = await (tx.assignment ?? prisma.assignment).findUnique({
    where: { id: assignmentId },
    select: { campaign: { select: { brandId: true, executionMode: true, status: true } } },
  });
  if (!a) throw new DomainError("BULUNAMADI", "Atama bulunamadı.");
  return allow(actor, a.campaign);
}

/** deliverableId üzerinden aynı kontrol (iş yeniden planlanırken). */
export async function assertCanManageByDeliverable(actor: Actor, deliverableId: string, tx: TxLike = prisma) {
  const d = await (tx.deliverable ?? prisma.deliverable).findUnique({
    where: { id: deliverableId },
    select: { assignment: { select: { campaign: { select: { brandId: true, executionMode: true, status: true } } } } },
  });
  if (!d) throw new DomainError("BULUNAMADI", "İş bulunamadı.");
  return allow(actor, d.assignment.campaign);
}
