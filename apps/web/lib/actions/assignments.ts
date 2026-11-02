"use server";

import { z } from "zod";
import { audit } from "@infulancer/core/audit";
import { requireRole, toAuditActor } from "@infulancer/core/access/actor";
import { assertAssignmentAccess } from "@infulancer/core/access/ownership";
import { prisma } from "@infulancer/core/db";
import { checkBrandConflict, enforceBrandConflict } from "@infulancer/core/domain/brand-conflict";
import { transitionDeliverable } from "@infulancer/core/domain/deliverable-status";
import { DomainError } from "@infulancer/core/domain/errors";
import type { ActionState } from "@/lib/action-state";
import { attempt, intOrNull, optStr, parseInput, revalidateAll, str, tlToKurus } from "@/lib/action-utils";
import { requireActor } from "@/lib/auth-guard";
import { notifyAdmins, notifyInfluencer } from "@/lib/notify";

/** Atama formu için önizleme: seçilen influencer'ın marka çakışmaları. */
export async function previewBrandConflict(input: { campaignId: string; influencerId: string }): Promise<{ conflicts: string[] }> {
  await requireActor("ADMIN");
  const parsed = z.object({ campaignId: z.string().min(1).max(64), influencerId: z.string().min(1).max(64) }).safeParse(input);
  if (!parsed.success) return { conflicts: [] };
  try {
    const result = await checkBrandConflict(prisma, parsed.data);
    return { conflicts: result.conflicts.map((c) => c.message) };
  } catch {
    return { conflicts: [] };
  }
}

const assignmentSchema = z.object({
  campaignId: z.string().min(1).max(64),
  influencerId: z.string().min(1, { error: "Influencer seçin." }).max(64),
  feeKurus: z.number({ error: "Geçerli bir tutar girin." }).int().positive(),
  commissionKurus: z.number({ error: "Geçerli bir tutar girin." }).int().nonnegative(),
  exclusivityDays: z.number({ error: "Tam sayı girin." }).int().min(0).max(365),
  exclusivityCategory: z.string().max(60).nullable(),
  couponCode: z.string().regex(/^[A-Za-z0-9_-]{3,40}$/, { error: "Harf, rakam, - ve _ (3–40)." }).nullable(),
  overrideReason: z.string().max(1000).nullable(),
});

/** Kampanyaya influencer atar; marka çakışması varsa yalnız yazılı gerekçeyle ezilebilir. */
export async function createAssignment(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const actor = await requireActor("ADMIN");
  return attempt(async () => {
    const input = parseInput(
      assignmentSchema,
      {
        campaignId: str(fd, "campaignId"),
        influencerId: str(fd, "influencerId"),
        feeKurus: tlToKurus(str(fd, "fee")),
        commissionKurus: str(fd, "commission") ? tlToKurus(str(fd, "commission")) : 0,
        exclusivityDays: intOrNull(str(fd, "exclusivityDays")) ?? 0,
        exclusivityCategory: optStr(fd, "exclusivityCategory")?.toLocaleLowerCase("tr") ?? null,
        couponCode: optStr(fd, "couponCode")?.toUpperCase() ?? null,
        overrideReason: optStr(fd, "overrideReason"),
      },
      {
        influencerId: "Influencer",
        feeKurus: "Influencer bedeli",
        commissionKurus: "Ajans komisyonu",
        exclusivityDays: "Münhasırlık (gün)",
        couponCode: "Kupon kodu",
      },
    );
    const assignmentId = await prisma.$transaction(async (tx) => {
      const campaign = await tx.campaign.findUnique({ where: { id: input.campaignId }, select: { name: true, status: true } });
      if (!campaign) throw new DomainError("BULUNAMADI", "Kampanya bulunamadı.");
      if (campaign.status === "KAPANDI" || campaign.status === "IPTAL") {
        throw new DomainError("KURAL_IHLALI", "Kapanmış/iptal kampanyaya atama yapılamaz.");
      }
      const dup = await tx.assignment.findFirst({
        where: { campaignId: input.campaignId, influencerId: input.influencerId, contractStatus: { not: "RED" } },
        select: { id: true },
      });
      if (dup) throw new DomainError("DOGRULAMA", "Bu influencer kampanyada zaten atanmış.");
      if (input.couponCode) {
        const coupon = await tx.assignment.findFirst({
          where: { campaignId: input.campaignId, couponCode: input.couponCode, contractStatus: { not: "RED" } },
          select: { id: true },
        });
        if (coupon) throw new DomainError("DOGRULAMA", "Bu kupon kodu kampanyada başka bir atamada kullanılıyor.");
      }
      const { overrideReason } = await enforceBrandConflict(tx, {
        influencerId: input.influencerId,
        campaignId: input.campaignId,
        actor,
        overrideReason: input.overrideReason,
      });
      const a = await tx.assignment.create({
        data: {
          campaignId: input.campaignId,
          influencerId: input.influencerId,
          feeKurus: input.feeKurus,
          commissionKurus: input.commissionKurus,
          exclusivityDays: input.exclusivityDays,
          exclusivityCategory: input.exclusivityCategory,
          couponCode: input.couponCode,
          conflictOverrideReason: overrideReason,
        },
      });
      await audit.append({
        actor: toAuditActor(actor),
        action: "ASSIGNMENT_CREATED",
        entityType: "Assignment",
        entityId: a.id,
        data: {
          campaignId: input.campaignId,
          influencerId: input.influencerId,
          feeKurus: input.feeKurus,
          commissionKurus: input.commissionKurus,
          exclusivityDays: input.exclusivityDays,
          conflictOverrideReason: overrideReason,
        },
      });
      await notifyInfluencer(tx, input.influencerId, {
        title: "Yeni iş teklifi",
        body: `"${campaign.name}" kampanyası için teklif aldınız. Kabul veya red seçin.`,
        href: "/influencer",
      });
      return a.id;
    });
    revalidateAll();
    return { ok: true, message: "Influencer atandı; sözleşme teklifi gönderildi.", data: { assignmentId } };
  });
}

const decisionSchema = z.object({
  assignmentId: z.string().min(1).max(64),
  decision: z.enum(["KABUL", "RED"]),
  note: z.string().max(1000).nullable(),
});

/**
 * Sözleşme kararı: influencer (kendi ataması, yalnız TEKLIF'ten) ya da admin.
 * RED: atamanın açık işleri durum makinesiyle İPTAL'e taşınır; influencer seçime döner.
 */
export async function decideContract(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const actor = requireRole(await requireActor("ADMIN", "INFLUENCER"), "ADMIN", "INFLUENCER");
  return attempt(async () => {
    const input = parseInput(decisionSchema, {
      assignmentId: str(fd, "assignmentId"),
      decision: str(fd, "decision"),
      note: optStr(fd, "note"),
    });
    await prisma.$transaction(async (tx) => {
      await assertAssignmentAccess(tx, actor, input.assignmentId);
      const a = await tx.assignment.findUniqueOrThrow({
        where: { id: input.assignmentId },
        select: {
          id: true,
          contractStatus: true,
          influencerId: true,
          influencer: { select: { name: true } },
          campaign: { select: { id: true, name: true } },
          deliverables: { select: { id: true, status: true } },
        },
      });
      if (a.contractStatus === input.decision) throw new DomainError("GECERSIZ_GECIS", "Sözleşme zaten bu durumda.");
      if (a.contractStatus === "RED") throw new DomainError("GECERSIZ_GECIS", "Reddedilmiş sözleşme yeniden açılamaz; yeni atama yapın.");
      if (actor.role === "INFLUENCER" && a.contractStatus !== "TEKLIF") {
        throw new DomainError("YETKISIZ", "Kararınız kaydedilmiş; değişiklik için ajansla iletişime geçin.");
      }
      await tx.assignment.update({ where: { id: a.id }, data: { contractStatus: input.decision } });
      await audit.append({
        actor: toAuditActor(actor),
        action: "CONTRACT_DECISION",
        entityType: "Assignment",
        entityId: a.id,
        data: { from: a.contractStatus, to: input.decision, note: input.note },
      });
      if (input.decision === "RED") {
        for (const d of a.deliverables) {
          if (d.status === "IPTAL" || d.status === "TAMAMLANDI") continue;
          await transitionDeliverable(tx, {
            deliverableId: d.id,
            to: "IPTAL",
            actor,
            asSystem: true,
            note: "Sözleşme reddedildi",
          });
        }
      }
      const label = input.decision === "KABUL" ? "kabul etti" : "reddetti";
      if (actor.role === "INFLUENCER") {
        await notifyAdmins(tx, {
          title: `Sözleşme kararı: ${a.influencer.name}`,
          body: `${a.influencer.name}, "${a.campaign.name}" teklifini ${label}.${input.decision === "RED" ? " Influencer seçimine dönün." : ""}`,
          href: `/admin/kampanyalar/${a.campaign.id}`,
        });
      } else {
        await notifyInfluencer(tx, a.influencerId, {
          title: "Sözleşme durumu güncellendi",
          body: `"${a.campaign.name}" sözleşmesi ajans tarafından ${input.decision === "KABUL" ? "kabul" : "red"} olarak işaretlendi.`,
          href: "/influencer",
        });
      }
    });
    revalidateAll();
    return { ok: true, message: input.decision === "KABUL" ? "Sözleşme kabul edildi." : "Sözleşme reddedildi; işler iptal edildi." };
  });
}
