"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { audit } from "@infulancer/core/audit";
import { requireRole, toAuditActor } from "@infulancer/core/access/actor";
import { assertAssignmentAccess } from "@infulancer/core/access/ownership";
import { prisma } from "@infulancer/core/db";
import { checkBrandConflict, enforceBrandConflict } from "@infulancer/core/domain/brand-conflict";
import { transitionDeliverable } from "@infulancer/core/domain/deliverable-status";
import { DomainError } from "@infulancer/core/domain/errors";
import { assertInfluencerFitsCampaign } from "@infulancer/core/domain/campaign-region";
import { assertCanManageCampaign } from "@infulancer/core/domain/campaign-manage-guard";
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

type AssignmentInput = z.infer<typeof assignmentSchema>;
type Actor = Awaited<ReturnType<typeof requireActor>>;
/** Tek atama: kapalı kampanya, mükerrer atama, kupon ve marka çakışması kuralları burada; audit + bildirim aynı işlemde. */
async function insertAssignment(actor: Actor, input: AssignmentInput, opts: { accepted?: boolean } = {}): Promise<string> {
  return prisma.$transaction(async (tx) => {
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
    // Ülke ayrımı: hedef ülkede kayıtlı ve kampanya para biriminde ödenebilir olmalı.
    await assertInfluencerFitsCampaign(tx, input.campaignId, input.influencerId);
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
        ...(opts.accepted ? { contractStatus: "KABUL" as const } : {}),
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
    await notifyInfluencer(tx, input.influencerId, opts.accepted
      ? { title: "İş birliği kampanyaya eklendi", body: `Kabul ettiğiniz teklif "${campaign.name}" kampanyasına eklendi. Brief ve tarihler İşlerim'de.`, href: "/influencer" }
      : { title: "Yeni iş teklifi", body: `"${campaign.name}" kampanyası için teklif aldınız. Kabul veya red seçin.`, href: "/influencer" });
    return a.id;
  });
}
/** Kampanyaya influencer atar; marka çakışması varsa yalnız yazılı gerekçeyle ezilebilir. */
export async function createAssignment(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const actor = await requireActor("ADMIN", "BRAND");
  return attempt(async () => {
    await assertCanManageCampaign(actor, str(fd, "campaignId"));
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
    const assignmentId = await insertAssignment(actor, input);
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

const bulkSchema = z.object({
  campaignId: z.string().min(1).max(64),
  commissionPct: z.number().min(0).max(100),
  items: z
    .array(z.object({ influencerId: z.string().min(1).max(64), feeKurus: z.number().int().positive({ error: "Bedel girin." }) }))
    .min(1, { error: "En az bir influencer seçin." })
    .max(50, { error: "Tek seferde en fazla 50 influencer." }),
});
export type BulkAssignResult = {
  ok: boolean;
  error?: string;
  created: { influencerId: string; name: string }[];
  failed: { influencerId: string; name: string; reason: string; conflict: boolean }[];
};
/**
 * Çoklu atama: her influencer kendi işleminde eklenir (biri hata verirse diğerleri etkilenmez).
 * Marka çakışması olanlar eklenmez; gerekçeyle tekli formdan atanmaları gerekir.
 */
export async function createAssignmentsBulk(input: {
  campaignId: string;
  commissionPct: number;
  items: { influencerId: string; feeKurus: number }[];
}): Promise<BulkAssignResult> {
  const actor = await requireActor("ADMIN", "BRAND");
  try {
    await assertCanManageCampaign(actor, input.campaignId);
  } catch (e) {
    return { ok: false, error: e instanceof DomainError ? e.message : "Yetki yok.", created: [], failed: [] };
  }
  const parsed = bulkSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Geçersiz giriş.", created: [], failed: [] };
  const { campaignId, commissionPct, items } = parsed.data;
  const names = new Map(
    (await prisma.influencer.findMany({ where: { id: { in: items.map((i) => i.influencerId) } }, select: { id: true, name: true } })).map((i) => [i.id, i.name]),
  );
  const created: BulkAssignResult["created"] = [];
  const failed: BulkAssignResult["failed"] = [];
  for (const it of items) {
    const name = names.get(it.influencerId) ?? it.influencerId;
    try {
      const conflict = await checkBrandConflict(prisma, { campaignId, influencerId: it.influencerId });
      if (conflict.blocked) {
        failed.push({ influencerId: it.influencerId, name, conflict: true, reason: conflict.conflicts.map((c) => c.message).join(" · ") });
        continue;
      }
      await insertAssignment(actor, {
        campaignId,
        influencerId: it.influencerId,
        feeKurus: it.feeKurus,
        commissionKurus: Math.round((it.feeKurus * commissionPct) / 100),
        exclusivityDays: 0,
        exclusivityCategory: null,
        couponCode: null,
        overrideReason: null,
      });
      created.push({ influencerId: it.influencerId, name });
    } catch (err) {
      failed.push({ influencerId: it.influencerId, name, conflict: false, reason: err instanceof DomainError ? err.message : "Beklenmeyen hata." });
    }
  }
  if (created.length) revalidateAll();
  return { ok: created.length > 0, created, failed, error: created.length ? undefined : "Hiçbir influencer eklenemedi." };
}

/**
 * Kabul edilen teklifi kampanyaya atamaya çevirir (ajans). Bedel = teklif toplamı; marka çakışması
 * ve kupon/münhasırlık kuralları tekli atamayla aynıdır. Teklif "Kampanyaya eklendi" olur.
 */
export async function assignFromOfferAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const actor = await requireActor("ADMIN");
  const res = await attempt(async () => {
    const offerId = str(fd, "offerId");
    const campaignId = str(fd, "campaignId");
    const commissionPct = Number(str(fd, "commissionPct").replace(",", ".") || "0");
    const offer = await prisma.offer.findUnique({ where: { id: offerId } });
    if (!offer) throw new DomainError("BULUNAMADI", "Teklif bulunamadı.");
    if (offer.status !== "KABUL") throw new DomainError("GECERSIZ_GECIS", "Yalnız kabul edilen teklif kampanyaya eklenebilir.");
    const camp = await prisma.campaign.findUnique({ where: { id: campaignId }, select: { brandId: true } });
    if (!camp || camp.brandId !== offer.brandId) throw new DomainError("DOGRULAMA", "Teklifi veren markanın kampanyasını seçin.");
    if (!Number.isFinite(commissionPct) || commissionPct < 0 || commissionPct > 100) throw new DomainError("DOGRULAMA", "Komisyon 0–100 arası olmalı.");
    const assignmentId = await insertAssignment(actor, {
      campaignId,
      influencerId: offer.influencerId,
      feeKurus: offer.totalKurus,
      commissionKurus: Math.round((offer.totalKurus * commissionPct) / 100),
      exclusivityDays: 0,
      exclusivityCategory: null,
      couponCode: null,
      overrideReason: null,
    }, { accepted: true });
    await prisma.offer.update({ where: { id: offer.id }, data: { status: "KAMPANYAYA_EKLENDI", campaignId, assignmentId } });
    await audit.append({ actor: toAuditActor(actor), action: "OFFER_CONVERTED", entityType: "Offer", entityId: offer.id, data: { campaignId, assignmentId } });
    revalidateAll();
    return { ok: true, message: "Kampanyaya eklendi.", data: { campaignId } };
  });
  if (res.ok) redirect(`/admin/teklifler?durum=KAMPANYAYA_EKLENDI&sonuc=eklendi&kampanya=${res.data?.campaignId ?? ""}`);
  return res;
}
