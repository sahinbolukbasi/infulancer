"use server";

import { z } from "zod";
import { audit } from "@infulancer/core/audit";
import { toAuditActor } from "@infulancer/core/access/actor";
import { assertDeliverableAccess } from "@infulancer/core/access/ownership";
import { prisma } from "@infulancer/core/db";
import { DomainError } from "@infulancer/core/domain/errors";
import { contentTypeLabels, platformLabels, reviewDecisionLabels } from "@infulancer/core/domain/labels";
import type { ActionState } from "@/lib/action-state";
import { attempt, parseInput, revalidateAll, str } from "@/lib/action-utils";
import { requireActor } from "@/lib/auth-guard";
import { notifyAdmins } from "@/lib/notify";

const schema = z
  .object({
    deliverableId: z.string().min(1).max(64),
    decision: z.enum(["ONAY", "REVIZYON"]),
    note: z.string().max(2000),
  })
  .refine((v) => v.decision === "ONAY" || v.note.length >= 3, {
    message: "Revizyon isterken ne değişmesi gerektiğini yazın.",
    path: ["note"],
  });

/**
 * Marka taslak görüşü: "Onaylıyorum" / "Revizyon istiyorum" + not.
 * Yalnız DeliverableReview kaydı ve admin bildirimi oluşur; durumu admin değiştirir.
 */
export async function submitBrandReview(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const actor = await requireActor("BRAND");
  return attempt(async () => {
    const input = parseInput(
      schema,
      { deliverableId: str(fd, "deliverableId"), decision: str(fd, "decision"), note: str(fd, "note") },
      { note: "Not" },
    );
    await prisma.$transaction(async (tx) => {
      await assertDeliverableAccess(tx, actor, input.deliverableId);
      const d = await tx.deliverable.findUniqueOrThrow({
        where: { id: input.deliverableId },
        select: {
          status: true,
          platform: true,
          contentType: true,
          assignment: { select: { contractStatus: true, influencer: { select: { name: true } }, campaign: { select: { name: true } } } },
        },
      });
      if (d.status !== "ICERIK_YUKLENDI" || d.assignment.contractStatus === "RED") {
        throw new DomainError("GECERSIZ_GECIS", "Bu taslak artık görüş beklemiyor.");
      }
      const review = await tx.deliverableReview.create({
        data: { deliverableId: input.deliverableId, brandUserId: actor.userId, decision: input.decision, note: input.note },
        select: { id: true },
      });
      await audit.append({
        actor: toAuditActor(actor),
        action: "BRAND_REVIEW",
        entityType: "Deliverable",
        entityId: input.deliverableId,
        data: { reviewId: review.id, decision: input.decision, note: input.note },
      });
      await notifyAdmins(tx, {
        title: `Marka görüşü: ${reviewDecisionLabels[input.decision]}`,
        body: `${d.assignment.campaign.name} · ${d.assignment.influencer.name} · ${platformLabels[d.platform]} ${contentTypeLabels[d.contentType]}${input.note ? ` — ${input.note}` : ""}`,
        href: `/admin/teslimler/${input.deliverableId}`,
      });
    });
    revalidateAll();
    return { ok: true, message: "Görüşünüz ajansa iletildi." };
  });
}
