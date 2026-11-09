"use server";
import { audit } from "@infulancer/core/audit";
import { toAuditActor } from "@infulancer/core/access/actor";
import { prisma } from "@infulancer/core/db";
import { contentPlanSchema, expandPlanSchedule, type ContentPlanItem } from "@infulancer/core/domain/campaign-plan";
import { DomainError } from "@infulancer/core/domain/errors";
import { assertContentType } from "@infulancer/core/domain/platform-rules";
import { buildUtmLink } from "@infulancer/core/domain/utm";
import { ruleFor } from "@infulancer/core/compliance/country-rules";
import type { ActionState } from "@/lib/action-state";
import { attempt, bool, optStr, revalidateAll, str, tags } from "@/lib/action-utils";
import { requireActor } from "@/lib/auth-guard";
import { assertCanManageCampaign } from "@infulancer/core/domain/campaign-manage-guard";
import { isDay, isTime, zonedToUtc } from "@/lib/time";

/**
 * Toplu içerik planı: seçilen tüm influencerlara aynı planı tek işlemde uygular.
 * Saatler her influencer'ın kendi kitle saat diliminde yorumlanır (aynı yerel saatte paylaşım).
 * Reddedilmiş atamalar ve kapanmış kampanya atlanır; her influencer kendi işleminde yazılır.
 */
const label = (country: string) => {
  const w = ruleFor(country).words[0]!;
  return w.length <= 3 ? `#${w}` : w[0]!.toUpperCase() + w.slice(1);
};
export async function applyContentPlanBulk(_p: ActionState, fd: FormData): Promise<ActionState> {
  const actor = await requireActor("ADMIN", "BRAND");
  return attempt(async () => {
    const campaignId = str(fd, "campaignId");
    await assertCanManageCampaign(actor, campaignId);
    const assignmentIds = [...new Set(fd.getAll("assignmentIds").map(String).filter(Boolean))];
    if (assignmentIds.length === 0) throw new DomainError("DOGRULAMA", "En az bir influencer seçin.");
    let planRaw: unknown;
    try {
      planRaw = JSON.parse(str(fd, "plan") || "[]");
    } catch {
      throw new DomainError("DOGRULAMA", "İçerik planı okunamadı.");
    }
    const parsed = contentPlanSchema.safeParse(planRaw);
    if (!parsed.success || parsed.data.length === 0) throw new DomainError("DOGRULAMA", parsed.success ? "En az bir içerik satırı ekleyin." : (parsed.error.issues[0]?.message ?? "Plan geçersiz."));
    const plan = parsed.data as ContentPlanItem[];
    const startDay = str(fd, "startDay");
    const time = str(fd, "time") || "19:00";
    if (!isDay(startDay)) throw new DomainError("DOGRULAMA", "İlk paylaşım gününü seçin.");
    if (!isTime(time)) throw new DomainError("DOGRULAMA", "Paylaşım saati SS:dd biçiminde olmalı.");
    const spacingDays = Math.min(30, Math.max(0, Number(str(fd, "spacingDays") || "2")));
    const approvalHours = Math.min(24 * 14, Math.max(1, Number(str(fd, "approvalHours") || "48")));
    const usageRightsDays = str(fd, "usageRightsDays") === "" ? 365 : Number(str(fd, "usageRightsDays"));
    if (!Number.isInteger(usageRightsDays) || usageRightsDays < 0 || usageRightsDays > 3650) throw new DomainError("DOGRULAMA", "Kullanım hakkı süresi 0–3650 gün olmalı.");
    const usageRightsChannel = str(fd, "usageRightsChannel") === "PAID_DAHIL" ? "PAID_DAHIL" : "ORGANIK";
    const usageRightsGeo = str(fd, "usageRightsGeo").toUpperCase().split(/[\s,]+/).filter((g) => /^[A-Z]{2}$/.test(g));
    if (usageRightsGeo.length === 0) throw new DomainError("DOGRULAMA", "Kullanım hakkı coğrafyası için en az bir ülke kodu girin (TR, DE…).");
    const hashtags = tags(str(fd, "hashtags")).map((h) => (h.startsWith("#") ? h : `#${h}`));
    const mentions = tags(str(fd, "mentions")).map((m) => (m.startsWith("@") ? m : `@${m}`));
    if (hashtags.some((h) => !/^#[\p{L}\p{N}_]+$/u.test(h))) throw new DomainError("DOGRULAMA", "Etiketler # ile başlamalı.");
    if (mentions.some((m) => !/^@[\w.]+$/u.test(m))) throw new DomainError("DOGRULAMA", "Bahsetmeler @ ile başlamalı.");
    const baseLink = optStr(fd, "baseLink");
    if (baseLink && !/^https?:\/\/\S+$/i.test(baseLink)) throw new DomainError("DOGRULAMA", "Geçerli bir https:// bağlantısı girin.");
    const caption = optStr(fd, "caption")?.slice(0, 5000) ?? null;
    const disclosureRequired = bool(fd, "disclosureRequired");
    for (const p of plan) assertContentType(p.platform, p.contentType);

    const campaign = await prisma.campaign.findUnique({ where: { id: campaignId }, select: { id: true, slug: true, status: true, brand: { select: { name: true } } } });
    if (!campaign) throw new DomainError("BULUNAMADI", "Kampanya bulunamadı.");
    if (campaign.status === "KAPANDI" || campaign.status === "IPTAL") throw new DomainError("KURAL_IHLALI", "Kapanmış/iptal kampanyada iş planlanamaz.");
    const assignments = await prisma.assignment.findMany({
      where: { id: { in: assignmentIds }, campaignId, contractStatus: { not: "RED" } },
      select: { id: true, influencer: { select: { name: true, country: true, audienceTimezone: true, socialAccounts: { select: { platform: true, handle: true } } } } },
    });
    if (assignments.length === 0) throw new DomainError("DOGRULAMA", "Seçilen influencerlar bu kampanyada değil.");
    const schedule = expandPlanSchedule(plan, { startDay, time, spacingDays });
    let created = 0;
    for (const a of assignments) {
      const tz = a.influencer.audienceTimezone;
      await prisma.$transaction(async (tx) => {
        for (const item of schedule) {
          const plannedAt = zonedToUtc(item.day, item.time, tz);
          const approvalDeadline = new Date(plannedAt.getTime() - approvalHours * 3_600_000);
          const story = item.contentType === "STORY";
          const d = await tx.deliverable.create({
            data: {
              assignmentId: a.id,
              platform: item.platform,
              contentType: item.contentType,
              plannedAt,
              approvalDeadline,
              caption: caption ?? (item.notes || null),
              hashtags,
              mentions,
              disclosureRequired,
              frameCount: item.frameCount,
              // Story: her karede ülke kuralının ibaresi + marka (TR: "Reklam | Marka", DE: "Werbung | Marke"…); ajans düzenleyebilir.
              frameTexts: story ? Array.from({ length: item.frameCount }, () => `${label(a.influencer.country)} | ${campaign.brand.name}`) : [],
              paidPartnershipToggle: item.platform === "INSTAGRAM",
              commercialContentToggle: item.platform === "TIKTOK",
              isLive: item.contentType === "LIVE",
              usageRightsDays,
              usageRightsChannel,
              usageRightsGeo,
            },
          });
          const handle = a.influencer.socialAccounts.find((s) => s.platform === item.platform)?.handle ?? a.influencer.name;
          if (baseLink) {
            await tx.deliverable.update({ where: { id: d.id }, data: { link: buildUtmLink(baseLink, { platform: item.platform, influencerHandle: handle, campaignSlug: campaign.slug, deliverableId: d.id }) } });
          }
          await tx.deliverableStatusChange.create({ data: { deliverableId: d.id, from: null, to: d.status, byUserId: actor.userId, note: "Toplu plan" } });
          created++;
        }
      });
    }
    await audit.append({
      actor: toAuditActor(actor),
      action: "DELIVERABLES_BULK_CREATED",
      entityType: "Campaign",
      entityId: campaignId,
      data: { assignments: assignments.map((a) => a.id), perInfluencer: schedule.length, created, startDay, time, spacingDays },
    });
    revalidateAll();
    return { ok: true, message: `${assignments.length} influencer için ${created} içerik planlandı (kişi başı ${schedule.length}).` };
  });
}
