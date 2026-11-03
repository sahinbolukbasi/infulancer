import { prisma } from "../db";
import { computeCampaignScore } from "../domain/campaign-score";
import { prompts } from "../llm";
import { dayBucket, recordRun } from "./common";

/** Hedef projeksiyonu (günlük): aktif kampanyada tahmini skor %100'ün altındaysa UYARI. */
export async function runTargetProjection(now = new Date()): Promise<boolean[]> {
  const campaigns = await prisma.campaign.findMany({
    where: { status: "AKTIF" },
    include: { assignments: { include: { deliverables: { include: { metricSnapshots: true } } } } },
  });
  const out: boolean[] = [];
  for (const c of campaigns) {
    const deliverables = c.assignments.flatMap((a) =>
      a.deliverables.map((d) => ({ platform: d.platform, status: d.status, publishedAt: d.publishedAt, snapshots: d.metricSnapshots })),
    );
    let score;
    try {
      score = computeCampaignScore(c, deliverables, now);
    } catch {
      continue; // geçersiz hedef tanımı: değerlendirilemez
    }
    if (!score.kpis.length) continue;
    let weighted = 0;
    let total = 0;
    for (const k of score.kpis) {
      weighted += Math.min(k.projectionRatio ?? k.ratio, 1.5) * k.weight;
      total += k.weight;
    }
    const projected = total ? weighted / total : 0;
    const pct = Math.round(projected * 100);
    out.push(
      await recordRun({
        checkType: "HEDEF_PROJEKSIYON",
        targetType: "Campaign",
        targetId: c.id,
        bucket: dayBucket(now),
        severity: projected < 1 ? "UYARI" : "BILGI",
        summary: projected < 1 ? `${c.name}: mevcut gidişle hedefin %${pct}'inde kalacak.` : `${c.name}: hedefe ulaşma yolunda (%${pct}).`,
        findings: { projected, kpis: score.kpis.map((k) => ({ kpi: k.kpi, ratio: k.ratio, projectionRatio: k.projectionRatio ?? null })) },
        model: "kod",
        promptVersion: prompts.kod.version,
      }),
    );
  }
  return out;
}
