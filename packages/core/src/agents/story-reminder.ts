import { prisma } from "../db";
import { prompts } from "../llm";
import { HOUR_MS, notifyInfluencer, recordRun } from "./common";

/**
 * Instagram Story'ler 24 saatte kaybolur: yayından 20 saat geçti ve ekran görüntüsü
 * kaynaklı metrik yoksa influencer'a bir kez hatırlatma gider.
 */
export async function runStoryReminder(now = new Date()): Promise<boolean[]> {
  const stories = await prisma.deliverable.findMany({
    where: {
      platform: "INSTAGRAM",
      contentType: "STORY",
      publishedAt: { lte: new Date(now.getTime() - 20 * HOUR_MS) },
      metricSnapshots: { none: { source: "EKRAN_GORUNTUSU" } },
      status: { not: "IPTAL" },
    },
    include: { assignment: { include: { campaign: { select: { name: true } } } } },
  });
  const out: boolean[] = [];
  for (const d of stories) {
    const created = await recordRun({
      checkType: "STORY_HATIRLATMA",
      targetType: "Deliverable",
      targetId: d.id,
      bucket: "tek",
      severity: "UYARI",
      summary: `Story ekran görüntüsü eksik (${d.assignment.campaign.name}); story kaybolmadan yüklenmeli.`,
      findings: { publishedAt: d.publishedAt!.toISOString() },
      model: "kod",
      promptVersion: prompts.kod.version,
    });
    if (created) {
      await notifyInfluencer(
        d.assignment.influencerId,
        "Story ekran görüntüsü bekleniyor",
        `${d.assignment.campaign.name} story'n 24 saatte kaybolacak. İstatistik ekran görüntüsünü şimdi yükle.`,
        `/influencer/isler/${d.id}`,
      );
    }
    out.push(created);
  }
  return out;
}
