import { prisma } from "../db";
import { computeCampaignScore, kpiLabels } from "../domain/campaign-score";
import { getLlm, prompts } from "../llm";
import { notifyAdmins, recordRun } from "./common";

/**
 * Kampanya özeti (kampanya kapanınca): rapor taslağı yalnızca AgentRun.findings'e yazılır;
 * admin onaylayınca Campaign.reportSummary'ye aktarılır (apps/web admin aksiyonu).
 */
export async function runCampaignSummary(input: { campaignId: string }): Promise<boolean> {
  const c = await prisma.campaign.findUnique({
    where: { id: input.campaignId },
    include: {
      brand: { select: { name: true } },
      assignments: { include: { influencer: { select: { name: true } }, deliverables: { include: { metricSnapshots: true } } } },
    },
  });
  if (!c || c.status !== "KAPANDI") return false;

  const deliverables = c.assignments.flatMap((a) =>
    a.deliverables.map((d) => ({ platform: d.platform, status: d.status, publishedAt: d.publishedAt, snapshots: d.metricSnapshots })),
  );
  let scoreLine = "Skor hesaplanamadı.";
  let kpiLines = "";
  try {
    const s = computeCampaignScore(c, deliverables);
    if (s.score != null) scoreLine = `Kampanya skoru: %${Math.round(s.score * 100)}.`;
    kpiLines = s.kpis.map((k) => `${kpiLabels[k.kpi]}: ${Math.round(k.actual)} / ${k.target}`).join("; ");
  } catch {
    // hedef tanımı geçersiz
  }
  const published = deliverables.filter((d) => d.publishedAt).length;
  const facts = [
    `Kampanya: ${c.name} (${c.brand.name})`,
    `Influencer sayısı: ${c.assignments.length}, yayınlanan içerik: ${published}`,
    scoreLine,
    kpiLines && `KPI'lar: ${kpiLines}`,
  ].filter(Boolean).join("\n");

  const llm = await getLlm().completeText({ system: prompts.kampanyaOzeti.system, promptVersion: prompts.kampanyaOzeti.version, prompt: facts });
  const draft = llm.text.startsWith("[Otomatik") ? `${facts}\n\n${llm.text}` : llm.text;

  const created = await recordRun({
    checkType: "KAMPANYA_OZETI",
    targetType: "Campaign",
    targetId: c.id,
    bucket: c.closedAt?.toISOString() ?? "kapanis",
    severity: "BILGI",
    summary: `${c.name} için rapor özeti taslağı hazır; onaylanınca rapora eklenir.`,
    findings: { draft, facts },
    model: llm.model,
    promptVersion: prompts.kampanyaOzeti.version,
  });
  if (created) await notifyAdmins("Rapor özeti hazır", `${c.name} kampanya özeti onayınızı bekliyor.`, `/admin/kampanyalar/${c.id}`);
  return created;
}

export async function runCampaignSummaryAll(): Promise<boolean[]> {
  const list = await prisma.campaign.findMany({ where: { status: "KAPANDI" }, select: { id: true } });
  const out: boolean[] = [];
  for (const c of list) out.push(await runCampaignSummary({ campaignId: c.id }));
  return out;
}
