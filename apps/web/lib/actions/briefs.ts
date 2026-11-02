"use server";

import { z } from "zod";
import { audit } from "@infulancer/core/audit";
import { toAuditActor } from "@infulancer/core/access/actor";
import { prisma } from "@infulancer/core/db";
import { DomainError } from "@infulancer/core/domain/errors";
import type { ActionState } from "@/lib/action-state";
import { attempt, bool, lines, parseInput, revalidateAll, str, tags } from "@/lib/action-utils";
import { requireActor } from "@/lib/auth-guard";

const list = z.array(z.string().max(300)).max(50);

const briefSchema = z.object({
  campaignId: z.string().min(1).max(64),
  text: z.string().min(10, { error: "En az 10 karakter olmalı." }).max(20_000),
  dos: list,
  donts: list,
  hashtags: z.array(z.string().regex(/^#[\p{L}\p{N}_]+$/u, { error: "Etiketler # ile başlamalı." })).max(30),
  mentions: z.array(z.string().regex(/^@[\w.]+$/u, { error: "Bahsetmeler @ ile başlamalı." })).max(30),
  requiredPhrases: list,
  bannedPhrases: list,
  disclosureRequired: z.boolean(),
});

/** Brief yerinde düzenlenmez; her kayıt yeni bir sürüm oluşturur. */
export async function createBriefVersion(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const actor = await requireActor("ADMIN");
  return attempt(async () => {
    const input = parseInput(
      briefSchema,
      {
        campaignId: str(fd, "campaignId"),
        text: str(fd, "text"),
        dos: lines(str(fd, "dos")),
        donts: lines(str(fd, "donts")),
        hashtags: tags(str(fd, "hashtags")).map((h) => (h.startsWith("#") ? h : `#${h}`)),
        mentions: tags(str(fd, "mentions")).map((m) => (m.startsWith("@") ? m : `@${m}`)),
        requiredPhrases: lines(str(fd, "requiredPhrases")),
        bannedPhrases: lines(str(fd, "bannedPhrases")),
        disclosureRequired: bool(fd, "disclosureRequired"),
      },
      {
        text: "Brief metni",
        dos: "Yapılacaklar",
        donts: "Yapılmayacaklar",
        hashtags: "Hashtag",
        mentions: "Bahsetme",
        requiredPhrases: "Zorunlu ifadeler",
        bannedPhrases: "Yasaklı ifadeler",
      },
    );
    const version = await prisma.$transaction(async (tx) => {
      const campaign = await tx.campaign.findUnique({ where: { id: input.campaignId }, select: { status: true } });
      if (!campaign) throw new DomainError("BULUNAMADI", "Kampanya bulunamadı.");
      if (campaign.status === "KAPANDI" || campaign.status === "IPTAL") {
        throw new DomainError("KURAL_IHLALI", "Kapanmış/iptal kampanyanın briefi değiştirilemez.");
      }
      const last = await tx.campaignBrief.findFirst({
        where: { campaignId: input.campaignId },
        orderBy: { version: "desc" },
        select: { version: true },
      });
      const next = (last?.version ?? 0) + 1;
      const brief = await tx.campaignBrief.create({ data: { ...input, version: next, createdById: actor.userId } });
      await audit.append({
        actor: toAuditActor(actor),
        action: "BRIEF_VERSION_CREATED",
        entityType: "CampaignBrief",
        entityId: brief.id,
        data: { campaignId: input.campaignId, version: next },
      });
      return next;
    });
    revalidateAll();
    return { ok: true, message: `Brief v${version} kaydedildi.` };
  });
}
