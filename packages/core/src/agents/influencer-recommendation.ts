import { prisma } from "../db";
import { checkBrandConflict } from "../domain/brand-conflict";
import { getLlm, prompts } from "../llm";
import { recordRun } from "./common";

export type Recommendation = { influencerId: string; name: string; score: number; rationale: string };

/**
 * Influencer önerisi: kategori uyumu, geçmiş performans (ER), müsaitlik ve marka çakışması
 * (çakışanlar elenir). İlk 5 aday için LLM tek cümlelik gerekçe yazar. Yalnız AgentRun (BILGI).
 */
export async function runInfluencerRecommendation(input: { campaignId: string; bucket?: string }): Promise<boolean> {
  const campaign = await prisma.campaign.findUnique({
    where: { id: input.campaignId },
    include: { brand: { select: { category: true, name: true } }, assignments: { select: { influencerId: true } } },
  });
  if (!campaign) return false;
  const assigned = new Set(campaign.assignments.map((a) => a.influencerId));

  const pool = await prisma.influencer.findMany({
    where: { id: { notIn: [...assigned] } },
    include: {
      socialAccounts: true,
      assignments: { include: { deliverables: { select: { plannedAt: true, status: true } } } },
    },
  });

  const category = campaign.brand.category.toLocaleLowerCase("tr");
  const scored: (Recommendation & { conflicts: number })[] = [];
  for (const inf of pool) {
    const conflict = await checkBrandConflict(prisma, { influencerId: inf.id, campaignId: campaign.id });
    if (conflict.blocked) continue;
    const catMatch = inf.category.toLocaleLowerCase("tr").includes(category) || category.includes(inf.category.toLocaleLowerCase("tr"));
    const bestEr = Math.max(0, ...inf.socialAccounts.map((a) => Number(a.engagementRate)));
    const busy = inf.assignments.some((a) =>
      a.deliverables.some((d) => d.status !== "IPTAL" && d.plannedAt >= campaign.startsAt && d.plannedAt <= campaign.endsAt),
    );
    const risk = inf.riskScore ?? 0;
    const score = Math.round((catMatch ? 40 : 10) + Math.min(bestEr * 400, 40) + (busy ? 0 : 20) - risk * 0.3);
    scored.push({ influencerId: inf.id, name: inf.name, score, rationale: "", conflicts: 0 });
  }
  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, 5);

  let model = "kod";
  for (const r of top) {
    const llm = await getLlm().completeText({
      system: prompts.influencerOneri.system,
      promptVersion: prompts.influencerOneri.version,
      prompt: `${r.name} için ${campaign.name} (${campaign.brand.name}, kategori ${campaign.brand.category}) uygunluk skoru ${r.score}.`,
    });
    r.rationale = llm.text;
    model = llm.model;
  }

  return recordRun({
    checkType: "INFLUENCER_ONERI",
    targetType: "Campaign",
    targetId: campaign.id,
    bucket: input.bucket ?? `havuz:${pool.length}:${assigned.size}`,
    severity: "BILGI",
    summary: top.length ? `Önerilen adaylar: ${top.map((t) => t.name).join(", ")}.` : "Uygun aday bulunamadı.",
    findings: { recommendations: top.map(({ conflicts: _c, ...r }) => r) },
    model,
    promptVersion: prompts.influencerOneri.version,
  });
}

export async function runInfluencerRecommendationAll(): Promise<boolean[]> {
  const list = await prisma.campaign.findMany({ where: { status: { in: ["TASLAK", "AKTIF"] } }, select: { id: true } });
  const out: boolean[] = [];
  for (const c of list) out.push(await runInfluencerRecommendation({ campaignId: c.id }));
  return out;
}
