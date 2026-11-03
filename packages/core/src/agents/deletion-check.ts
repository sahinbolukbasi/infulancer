import { prisma } from "../db";
import { prompts } from "../llm";
import { DAY_MS, dayBucket, notifyAdmins, recordRun } from "./common";
import { isLinkAlive } from "./link-checker";

/**
 * Silinme kontrolü (günlük): son 30 günde yayınlanmış içeriklerin linki ölüyse KRITIK,
 * Deliverable.contractViolation bayrağı set edilir ve adminlere bildirim gider.
 */
export async function runDeletionCheck(now = new Date()): Promise<boolean[]> {
  const list = await prisma.deliverable.findMany({
    where: { postUrl: { not: null }, publishedAt: { gte: new Date(now.getTime() - 30 * DAY_MS) }, status: { not: "IPTAL" } },
    include: { assignment: { include: { influencer: { select: { name: true } }, campaign: { select: { name: true } } } } },
  });
  const out: boolean[] = [];
  for (const d of list) {
    const alive = await isLinkAlive(d.postUrl!);
    if (alive) {
      out.push(false);
      continue;
    }
    const who = `${d.assignment.influencer.name} · ${d.assignment.campaign.name}`;
    // Ölü link için tek KRITIK kayıt (gün kovası yerine yayın kovası): tekrar tekrar uyarı üretmez.
    const created = await recordRun({
      checkType: "SILINME_KONTROL",
      targetType: "Deliverable",
      targetId: d.id,
      bucket: `olu:${d.publishedAt!.toISOString()}`,
      severity: "KRITIK",
      summary: `İçerik kaldırılmış olabilir: ${who}. Sözleşme ihlali olarak işaretlendi.`,
      findings: { postUrl: d.postUrl, checkedAt: now.toISOString(), checkedDay: dayBucket(now) },
      model: "kod",
      promptVersion: prompts.kod.version,
    });
    if (created) {
      await prisma.deliverable.update({ where: { id: d.id }, data: { contractViolation: true } });
      await notifyAdmins("İçerik silinmiş olabilir", `${who} yayını erişilemiyor (sözleşme ihlali).`, `/admin/teslimler/${d.id}`);
    }
    out.push(created);
  }
  return out;
}
