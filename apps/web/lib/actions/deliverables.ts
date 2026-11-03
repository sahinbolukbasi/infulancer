"use server";

import { z } from "zod";
import { audit } from "@infulancer/core/audit";
import { requireRole, toAuditActor } from "@infulancer/core/access/actor";
import { assertDeliverableAccess } from "@infulancer/core/access/ownership";
import { prisma, type DeliverableStatus } from "@infulancer/core/db";
import { statusOrder, transitionDeliverable } from "@infulancer/core/domain/deliverable-status";
import { DomainError } from "@infulancer/core/domain/errors";
import { contentTypeLabels, deliverableStatusLabels, platformLabels } from "@infulancer/core/domain/labels";
import { assertContentType } from "@infulancer/core/domain/platform-rules";
import { buildUtmLink } from "@infulancer/core/domain/utm";
import { publish } from "@infulancer/core/events";
import type { ActionState } from "@/lib/action-state";
import { attempt, bool, optStr, parseInput, revalidateAll, str, tags } from "@/lib/action-utils";
import { requireActor } from "@/lib/auth-guard";
import { notifyAdmins, notifyInfluencer } from "@/lib/notify";
import { fmtDateTime, isDay, isTime, parseLocalInput, zonedToUtc } from "@/lib/time";

const PLATFORMS = ["INSTAGRAM", "TIKTOK", "YOUTUBE"] as const;
const CONTENT_TYPES = ["REELS", "STORY", "CAROUSEL", "FEED", "LIVE", "VIDEO", "PHOTO", "SHORTS", "COMMUNITY"] as const;

const deliverableSchema = z.object({
  assignmentId: z.string().min(1).max(64),
  platform: z.enum(PLATFORMS, { error: "Platform seçin." }),
  contentType: z.enum(CONTENT_TYPES, { error: "İçerik tipi seçin." }),
  plannedAt: z.string(),
  approvalDeadline: z.string(),
  caption: z.string().max(5000).nullable(),
  hashtags: z.array(z.string().regex(/^#[\p{L}\p{N}_]+$/u, { error: "Etiketler # ile başlamalı." })).max(30),
  mentions: z.array(z.string().regex(/^@[\w.]+$/u, { error: "Bahsetmeler @ ile başlamalı." })).max(30),
  baseLink: z.url({ protocol: /^https?$/, error: "Geçerli bir https:// bağlantısı girin." }).max(1000).nullable(),
  disclosureRequired: z.boolean(),
  frameCount: z.number().int().min(1, { error: "Kare sayısı en az 1." }).max(30),
  frameTexts: z.array(z.string().max(500)).max(30),
  paidPartnershipToggle: z.boolean(),
  commercialContentToggle: z.boolean(),
  hasAudio: z.boolean(),
  spokenDisclosure: z.boolean(),
  isLive: z.boolean(),
  usageRightsDays: z.number().int().min(0).max(3650).nullable(),
  usageRightsChannel: z.enum(["ORGANIK", "PAID_DAHIL"]).nullable(),
  usageRightsGeo: z.array(z.string().regex(/^[A-Z]{2}$/, { error: "Coğrafya ülke kodu olmalı (TR, DE…)." })).max(30),
});

/** Deliverable oluşturur/günceller. Saatler influencer kitlesinin saat diliminde girilir, UTC saklanır. */
export async function saveDeliverable(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const actor = await requireActor("ADMIN");
  const id = optStr(fd, "id");
  return attempt(async () => {
    const input = parseInput(
      deliverableSchema,
      {
        assignmentId: str(fd, "assignmentId"),
        platform: str(fd, "platform"),
        contentType: str(fd, "contentType"),
        plannedAt: str(fd, "plannedAt"),
        approvalDeadline: str(fd, "approvalDeadline"),
        caption: optStr(fd, "caption"),
        hashtags: tags(str(fd, "hashtags")).map((h) => (h.startsWith("#") ? h : `#${h}`)),
        mentions: tags(str(fd, "mentions")).map((m) => (m.startsWith("@") ? m : `@${m}`)),
        baseLink: optStr(fd, "baseLink"),
        disclosureRequired: bool(fd, "disclosureRequired"),
        frameCount: Number(str(fd, "frameCount") || "1"),
        frameTexts: str(fd, "frameTexts").split(/\r?\n/).map((l) => l.trim()).filter(Boolean),
        paidPartnershipToggle: bool(fd, "paidPartnershipToggle"),
        commercialContentToggle: bool(fd, "commercialContentToggle"),
        hasAudio: bool(fd, "hasAudio"),
        spokenDisclosure: bool(fd, "spokenDisclosure"),
        isLive: bool(fd, "isLive"),
        usageRightsDays: str(fd, "usageRightsDays") === "" ? null : Number(str(fd, "usageRightsDays")),
        usageRightsChannel: optStr(fd, "usageRightsChannel"),
        usageRightsGeo: str(fd, "usageRightsGeo").toUpperCase().split(/[\s,]+/).filter(Boolean),
      },
      {
        platform: "Platform",
        contentType: "İçerik tipi",
        caption: "Caption",
        hashtags: "Hashtag",
        mentions: "Bahsetme",
        baseLink: "Bağlantı",
      },
    );
    assertContentType(input.platform, input.contentType);

    const assignment = await prisma.assignment.findUnique({
      where: { id: input.assignmentId },
      select: {
        id: true,
        contractStatus: true,
        influencerId: true,
        influencer: { select: { audienceTimezone: true, name: true, socialAccounts: { select: { platform: true, handle: true } } } },
        campaign: { select: { id: true, slug: true, status: true } },
      },
    });
    if (!assignment) throw new DomainError("BULUNAMADI", "Atama bulunamadı.");
    if (assignment.contractStatus === "RED") throw new DomainError("KURAL_IHLALI", "Reddedilmiş atamaya iş eklenemez.");
    if (assignment.campaign.status === "KAPANDI" || assignment.campaign.status === "IPTAL") {
      throw new DomainError("KURAL_IHLALI", "Kapanmış/iptal kampanyada iş planlanamaz.");
    }
    const tz = assignment.influencer.audienceTimezone;
    const planned = parseLocalInput(input.plannedAt);
    const deadline = parseLocalInput(input.approvalDeadline);
    if (!planned) throw new DomainError("DOGRULAMA", "Paylaşım zamanı geçersiz.");
    if (!deadline) throw new DomainError("DOGRULAMA", "Onay son tarihi geçersiz.");
    const plannedAt = zonedToUtc(planned.day, planned.time, tz);
    const approvalDeadline = zonedToUtc(deadline.day, deadline.time, tz);
    if (approvalDeadline >= plannedAt) throw new DomainError("DOGRULAMA", "Onay son tarihi paylaşım zamanından önce olmalı.");

    const handle =
      assignment.influencer.socialAccounts.find((s) => s.platform === input.platform)?.handle ?? assignment.influencer.name;
    const base = {
      platform: input.platform,
      contentType: input.contentType,
      plannedAt,
      approvalDeadline,
      caption: input.caption,
      hashtags: input.hashtags,
      mentions: input.mentions,
      disclosureRequired: input.disclosureRequired,
      // Story serisinde md. 23/A kontrolü kare başınadır; kare metinleri kare sayısıyla hizalanır.
      frameCount: input.contentType === "STORY" ? Math.max(input.frameCount, input.frameTexts.length) : 1,
      frameTexts: input.contentType === "STORY" ? input.frameTexts : [],
      paidPartnershipToggle: input.paidPartnershipToggle,
      commercialContentToggle: input.commercialContentToggle,
      hasAudio: input.hasAudio,
      spokenDisclosure: input.spokenDisclosure,
      isLive: input.isLive || input.contentType === "LIVE",
      usageRightsDays: input.usageRightsDays,
      usageRightsChannel: input.usageRightsChannel,
      usageRightsGeo: input.usageRightsGeo,
    };
    const utm = (deliverableId: string) =>
      input.baseLink
        ? buildUtmLink(input.baseLink, {
            platform: input.platform,
            influencerHandle: handle,
            campaignSlug: assignment.campaign.slug,
            deliverableId,
          })
        : null;

    await prisma.$transaction(async (tx) => {
      if (id) {
        const current = await tx.deliverable.findUnique({ where: { id }, select: { assignmentId: true, status: true, platform: true, contentType: true, plannedAt: true } });
        if (!current || current.assignmentId !== assignment.id) throw new DomainError("BULUNAMADI", "İş bulunamadı.");
        if (current.status === "IPTAL" || current.status === "TAMAMLANDI") {
          throw new DomainError("KURAL_IHLALI", `"${deliverableStatusLabels[current.status]}" durumundaki iş düzenlenemez.`);
        }
        const published = statusOrder[current.status] >= statusOrder.YAYINLANDI;
        if (
          published &&
          (current.platform !== base.platform || current.contentType !== base.contentType || current.plannedAt.getTime() !== plannedAt.getTime())
        ) {
          throw new DomainError("KURAL_IHLALI", "Yayınlanmış işin platformu, tipi ve paylaşım zamanı değiştirilemez.");
        }
        await tx.deliverable.update({ where: { id }, data: { ...base, link: utm(id) } });
        await audit.append({
          actor: toAuditActor(actor),
          action: "DELIVERABLE_UPDATED",
          entityType: "Deliverable",
          entityId: id,
          data: { ...base, plannedAt: plannedAt.toISOString(), approvalDeadline: approvalDeadline.toISOString(), timezone: tz },
        });
      } else {
        const d = await tx.deliverable.create({ data: { ...base, assignmentId: assignment.id } });
        await tx.deliverable.update({ where: { id: d.id }, data: { link: utm(d.id) } });
        await tx.deliverableStatusChange.create({ data: { deliverableId: d.id, from: null, to: d.status, byUserId: actor.userId, note: "Oluşturuldu" } });
        await audit.append({
          actor: toAuditActor(actor),
          action: "DELIVERABLE_CREATED",
          entityType: "Deliverable",
          entityId: d.id,
          data: { ...base, assignmentId: assignment.id, plannedAt: plannedAt.toISOString(), approvalDeadline: approvalDeadline.toISOString(), timezone: tz },
        });
      }
    });
    revalidateAll();
    return { ok: true, message: id ? "İş güncellendi." : "İş planlandı." };
  });
}

const STATUSES = Object.keys(statusOrder) as [DeliverableStatus, ...DeliverableStatus[]];

const transitionSchema = z.object({
  id: z.string().min(1).max(64),
  to: z.enum(STATUSES),
  note: z.string().max(2000).nullable(),
  postUrl: z.string().max(1000).nullable(),
});

/** Durum geçişi — her zaman core durum makinesi üzerinden (audit dahil). */
export async function changeDeliverableStatus(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const actor = requireRole(await requireActor("ADMIN", "INFLUENCER"), "ADMIN", "INFLUENCER");
  return attempt(async () => {
    const input = parseInput(transitionSchema, {
      id: str(fd, "id"),
      to: str(fd, "to"),
      note: optStr(fd, "note"),
      postUrl: optStr(fd, "postUrl"),
    });
    if (actor.role === "ADMIN" && (input.to === "IPTAL" || input.to === "REVIZYON") && !input.note) {
      throw new DomainError("DOGRULAMA", input.to === "IPTAL" ? "İptal için not zorunlu." : "Revizyon notu zorunlu.");
    }
    const result = await prisma.$transaction(async (tx) => {
      const access = await assertDeliverableAccess(tx, actor, input.id);
      const r = await transitionDeliverable(tx, {
        deliverableId: input.id,
        to: input.to,
        actor,
        note: input.note,
        postUrl: input.postUrl,
      });
      const toLabel = deliverableStatusLabels[input.to];
      if (actor.role === "INFLUENCER") {
        await notifyAdmins(tx, {
          title: `İş durumu: ${toLabel}`,
          body: input.to === "YAYINLANDI" ? "Influencer paylaşım bağlantısını girdi." : "Influencer işi güncelledi.",
          href: `/admin/teslimler/${input.id}`,
        });
      } else if (["BRIEF_GONDERILDI", "REVIZYON", "ONAYLANDI", "IPTAL"].includes(input.to)) {
        await notifyInfluencer(tx, access.assignment.influencerId, {
          title: `İş durumu: ${toLabel}`,
          body: input.note ? `Ajans notu: ${input.note}` : `İşiniz "${toLabel}" durumuna geçti.`,
          href: `/influencer/isler/${input.id}`,
        });
      }
      return r;
    });
    if (result.published) await publish({ type: "DELIVERABLE_PUBLISHED", deliverableId: result.id });
    revalidateAll();
    return { ok: true, message: `Durum: ${deliverableStatusLabels[result.status]}` };
  });
}

const rescheduleSchema = z.object({
  deliverableId: z.string().min(1).max(64),
  day: z.string().refine(isDay),
  time: z.string().refine(isTime),
});

/**
 * Takvimden yeniden planlama (yalnız admin). Gün + saat influencer kitlesinin
 * saat diliminde yorumlanır; onay son tarihi aynı farkla kaydırılır.
 */
export async function rescheduleDeliverable(raw: { deliverableId: string; day: string; time: string }): Promise<ActionState> {
  const actor = await requireActor("ADMIN");
  return attempt(async () => {
    const parsed = rescheduleSchema.safeParse(raw);
    if (!parsed.success) throw new DomainError("DOGRULAMA", "Geçersiz tarih/saat.");
    const input = parsed.data;
    const formatted = await prisma.$transaction(async (tx) => {
      const d = await tx.deliverable.findUnique({
        where: { id: input.deliverableId },
        select: {
          id: true,
          status: true,
          plannedAt: true,
          approvalDeadline: true,
          platform: true,
          contentType: true,
          assignment: { select: { influencerId: true, influencer: { select: { audienceTimezone: true } }, campaign: { select: { name: true } } } },
        },
      });
      if (!d) throw new DomainError("BULUNAMADI", "İş bulunamadı.");
      if (d.status === "IPTAL" || statusOrder[d.status] >= statusOrder.YAYINLANDI) {
        throw new DomainError("KURAL_IHLALI", `"${deliverableStatusLabels[d.status]}" durumundaki iş yeniden planlanamaz.`);
      }
      const tz = d.assignment.influencer.audienceTimezone;
      const plannedAt = zonedToUtc(input.day, input.time, tz);
      if (plannedAt.getTime() === d.plannedAt.getTime()) return null;
      const delta = plannedAt.getTime() - d.plannedAt.getTime();
      const approvalDeadline = new Date(d.approvalDeadline.getTime() + delta);
      await tx.deliverable.update({ where: { id: d.id }, data: { plannedAt, approvalDeadline } });
      await audit.append({
        actor: toAuditActor(actor),
        action: "DELIVERABLE_RESCHEDULED",
        entityType: "Deliverable",
        entityId: d.id,
        data: {
          from: d.plannedAt.toISOString(),
          to: plannedAt.toISOString(),
          approvalDeadline: approvalDeadline.toISOString(),
          timezone: tz,
        },
      });
      const when = `${fmtDateTime(plannedAt, tz)} (${tz})`;
      await notifyInfluencer(tx, d.assignment.influencerId, {
        title: "Paylaşım saatiniz değişti",
        body: `Paylaşım saatiniz değişti: ${d.assignment.campaign.name} · ${platformLabels[d.platform]} ${contentTypeLabels[d.contentType]} → ${when}`,
        href: `/influencer/isler/${d.id}`,
      });
      return when;
    });
    revalidateAll();
    return { ok: true, message: formatted ? `Yeni zaman: ${formatted}` : "Değişiklik yok." };
  });
}
