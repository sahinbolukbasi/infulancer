import { prisma } from "../db";
import { engagementSanityRanges } from "../domain/platform-rules";
import { getLlm, prompts } from "../llm";
import { monthBucket, recordRun } from "./common";

/**
 * Sahte etkileşim taraması (influencer oluşturulunca + aylık): platform normlarına göre ER
 * anomalisi ve snapshot'lar arası ani takipçi sıçraması. Influencer.riskScore (0-100) yazılır.
 */
export async function runFakeEngagement(input: { influencerId: string }, now = new Date()): Promise<boolean> {
  const inf = await prisma.influencer.findUnique({
    where: { id: input.influencerId },
    include: { socialAccounts: { include: { snapshots: { orderBy: { takenAt: "asc" } } } } },
  });
  if (!inf) return false;

  const signals: string[] = [];
  let risk = 0;
  for (const acc of inf.socialAccounts) {
    const er = Number(acc.engagementRate);
    const range = engagementSanityRanges[acc.platform];
    if (er > range.max) {
      risk += 30;
      signals.push(`${acc.platform} ER olağandışı yüksek (%${(er * 100).toFixed(1)})`);
    } else if (er < range.min) {
      risk += 25;
      signals.push(`${acc.platform} ER çok düşük (%${(er * 100).toFixed(2)}) — takipçi kalitesi şüpheli`);
    }
    for (let i = 1; i < acc.snapshots.length; i++) {
      const prev = acc.snapshots[i - 1]!.followers;
      const cur = acc.snapshots[i]!.followers;
      if (prev > 0 && (cur - prev) / prev > 0.25) {
        risk += 25;
        signals.push(`${acc.platform} takipçi sayısında ani sıçrama (+%${Math.round(((cur - prev) / prev) * 100)})`);
        break;
      }
    }
  }
  risk = Math.min(100, risk);

  const llm = await getLlm().completeText({
    system: prompts.sahteEtkilesim.system,
    promptVersion: prompts.sahteEtkilesim.version,
    prompt: signals.length ? `Sinyaller: ${signals.join("; ")}` : "Belirgin anomali sinyali yok.",
  });

  const created = await recordRun({
    checkType: "SAHTE_ETKILESIM",
    targetType: "Influencer",
    targetId: inf.id,
    bucket: monthBucket(now),
    severity: risk >= 50 ? "UYARI" : "BILGI",
    summary: signals.length ? `${inf.name}: risk skoru ${risk}. ${signals.join("; ")}.` : `${inf.name}: anomali bulunmadı (risk ${risk}).`,
    findings: { risk, signals, llm: llm.text },
    model: llm.model,
    promptVersion: prompts.sahteEtkilesim.version,
  });
  if (created) await prisma.influencer.update({ where: { id: inf.id }, data: { riskScore: risk } });
  return created;
}

export async function runFakeEngagementAll(now = new Date()): Promise<boolean[]> {
  const list = await prisma.influencer.findMany({ select: { id: true } });
  const out: boolean[] = [];
  for (const i of list) out.push(await runFakeEngagement({ influencerId: i.id }, now));
  return out;
}
