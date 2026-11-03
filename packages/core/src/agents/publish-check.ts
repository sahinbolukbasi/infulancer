import { prisma } from "../db";
import { prompts } from "../llm";
import { dayBucket, notifyAdmins, recordRun } from "./common";
import { isLinkAlive } from "./link-checker";

const GRACE_MS = 30 * 60_000;

/**
 * Yayın kontrolü: planlanan saat + 30 dk geçmiş ve yayın linki yoksa 'Gecikme';
 * link varsa canlılığı kontrol edilir.
 */
export async function runPublishCheck(now = new Date()): Promise<boolean[]> {
  const due = await prisma.deliverable.findMany({
    where: {
      plannedAt: { lt: new Date(now.getTime() - GRACE_MS) },
      status: { in: ["ATANDI", "BRIEF_GONDERILDI", "ICERIK_YUKLENDI", "REVIZYON", "ONAYLANDI", "YAYINLANDI"] },
    },
    include: { assignment: { include: { influencer: { select: { name: true } }, campaign: { select: { name: true } } } } },
  });
  const out: boolean[] = [];
  for (const d of due) {
    const who = `${d.assignment.influencer.name} · ${d.assignment.campaign.name}`;
    if (!d.postUrl || !d.publishedAt) {
      const created = await recordRun({
        checkType: "YAYIN_KONTROL",
        targetType: "Deliverable",
        targetId: d.id,
        bucket: `gecikme:${dayBucket(now)}`,
        severity: "UYARI",
        summary: `Gecikme: ${who} — planlanan saatten 30 dk sonra hâlâ yayın linki yok.`,
        findings: { plannedAt: d.plannedAt.toISOString(), status: d.status },
        model: "kod",
        promptVersion: prompts.kod.version,
      });
      if (created) await notifyAdmins("Yayın gecikmesi", `${who} planlanan saatte yayınlanmadı.`, `/admin/teslimler/${d.id}`);
      out.push(created);
      continue;
    }
    const alive = await isLinkAlive(d.postUrl);
    out.push(
      await recordRun({
        checkType: "YAYIN_KONTROL",
        targetType: "Deliverable",
        targetId: d.id,
        bucket: `yayin:${d.publishedAt.toISOString()}`,
        severity: alive ? "BILGI" : "UYARI",
        summary: alive ? `Yayın doğrulandı: ${who}.` : `Yayın linkine erişilemiyor: ${who}.`,
        findings: { postUrl: d.postUrl, alive },
        model: "kod",
        promptVersion: prompts.kod.version,
      }),
    );
  }
  return out;
}
