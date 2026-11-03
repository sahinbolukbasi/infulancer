"use server";
import { z } from "zod";
import { audit } from "@infulancer/core/audit";
import { toAuditActor } from "@infulancer/core/access/actor";
import { runInfluencerRecommendation } from "@infulancer/core/agents/influencer-recommendation";
import { prisma } from "@infulancer/core/db";
import { DomainError } from "@infulancer/core/domain/errors";
import type { ActionState } from "@/lib/action-state";
import { attempt, parseInput, revalidateAll, str } from "@/lib/action-utils";
import { requireActor } from "@/lib/auth-guard";

const idSchema = z.object({ id: z.string().min(1).max(64) });

/** Kampanya için influencer öneri agent'ını hemen çalıştırır (yalnızca AgentRun yazar). */
export async function recommendCandidates(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireActor("ADMIN");
  return attempt(async () => {
    const { id } = parseInput(idSchema, { id: str(fd, "id") });
    // Elle tetikleme her seferinde yeni öneri üretir (dakika kovası).
    const created = await runInfluencerRecommendation({ campaignId: id, bucket: `elle:${new Date().toISOString().slice(0, 16)}` });
    revalidateAll();
    return { ok: true, message: created ? "Aday önerileri güncellendi." : "Öneriler zaten güncel." };
  });
}

/** Onaylanan kampanya özeti taslağını Campaign.reportSummary'ye aktarır. */
export async function approveCampaignSummary(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const actor = await requireActor("ADMIN");
  return attempt(async () => {
    const { id } = parseInput(idSchema, { id: str(fd, "id") });
    await prisma.$transaction(async (tx) => {
      const run = await tx.agentRun.findUnique({ where: { id } });
      if (!run || run.checkType !== "KAMPANYA_OZETI") throw new DomainError("BULUNAMADI", "Özet taslağı bulunamadı.");
      const draft = (run.findings as { draft?: unknown } | null)?.draft;
      if (typeof draft !== "string" || !draft.trim()) throw new DomainError("DOGRULAMA", "Taslak metni boş.");
      await tx.campaign.update({ where: { id: run.targetId }, data: { reportSummary: draft } });
      if (run.status === "ACIK") {
        await tx.agentRun.update({ where: { id }, data: { status: "ONAYLANDI", resolvedById: actor.userId, resolvedAt: new Date() } });
      }
      await audit.append({
        actor: toAuditActor(actor),
        action: "CAMPAIGN_SUMMARY_APPROVED",
        entityType: "Campaign",
        entityId: run.targetId,
        data: { agentRunId: id },
      });
    });
    revalidateAll();
    return { ok: true, message: "Özet rapora aktarıldı." };
  });
}
