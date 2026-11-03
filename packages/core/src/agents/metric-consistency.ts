import { GetObjectCommand } from "@aws-sdk/client-s3";
import { prisma } from "../db";
import { engagementRate, engagementSanityRanges, isEngagementInRange } from "../domain/platform-rules";
import { getLlm, prompts } from "../llm";
import { bucket, s3 } from "../storage/s3";
import { recordRun } from "./common";

const TOLERANCE = 0.05;
const FIELDS = ["reach", "impressions", "likes", "comments", "saves", "shares", "clicks"] as const;

async function readObject(key: string): Promise<Uint8Array | null> {
  try {
    const res = await s3().send(new GetObjectCommand({ Bucket: bucket(), Key: key }));
    return res.Body ? await res.Body.transformToByteArray() : null;
  } catch {
    return null;
  }
}

/**
 * Metrik tutarlılığı: girilen değerleri ekran görüntüsünden okunanla karşılaştırır (%5 tolerans)
 * ve ER'nin platform için makul aralıkta olup olmadığına bakar. Snapshot başına bir kez.
 */
export async function runMetricConsistency(input: { metricSnapshotId: string }): Promise<boolean> {
  const snap = await prisma.metricSnapshot.findUnique({
    where: { id: input.metricSnapshotId },
    include: { screenshotAsset: true, deliverable: { select: { id: true, platform: true } } },
  });
  if (!snap) return false;

  const entered: Record<string, number> = {};
  for (const f of FIELDS) if (snap[f] != null) entered[f] = snap[f]!;

  const mismatches: { field: string; entered: number; read: number | null }[] = [];
  let model = "kod";
  let promptVersion: string = prompts.kod.version;
  let screenshotRead = false;

  if (snap.screenshotAsset && Object.keys(entered).length) {
    const bytes = await readObject(snap.screenshotAsset.key);
    if (bytes) {
      const res = await getLlm().readScreenshotNumbers({
        imageBytes: bytes,
        mime: snap.screenshotAsset.mime,
        expectedFields: entered,
        fileName: snap.screenshotAsset.fileName,
        promptVersion: prompts.metrikOkuma.version,
      });
      model = res.model;
      promptVersion = prompts.metrikOkuma.version;
      screenshotRead = true;
      for (const [field, value] of Object.entries(entered)) {
        const read = res.values[field] ?? null;
        if (read == null || Math.abs(read - value) > Math.max(1, value * TOLERANCE)) {
          mismatches.push({ field, entered: value, read });
        }
      }
    }
  }

  const er = engagementRate(snap);
  const erOut = er != null && !isEngagementInRange(snap.deliverable.platform, er);
  const flagged = mismatches.length > 0 || erOut;
  const parts: string[] = [];
  if (mismatches.length) parts.push(`ekran görüntüsüyle uyuşmayan alan: ${mismatches.map((m) => m.field).join(", ")}`);
  if (erOut) {
    const r = engagementSanityRanges[snap.deliverable.platform];
    parts.push(`ER %${(er! * 100).toFixed(1)} makul aralığın (%${r.min * 100}–%${r.max * 100}) dışında`);
  }

  return recordRun({
    checkType: "METRIK_TUTARLILIK",
    targetType: "MetricSnapshot",
    targetId: snap.id,
    bucket: "ilk",
    severity: flagged ? "UYARI" : "BILGI",
    summary: flagged ? `Metrik tutarsızlığı: ${parts.join("; ")}.` : "Metrikler tutarlı.",
    findings: { mismatches, er, erOutOfRange: erOut, screenshotRead, deliverableId: snap.deliverable.id },
    model,
    promptVersion,
  });
}

export async function runMetricConsistencyAll(): Promise<boolean[]> {
  const snaps = await prisma.metricSnapshot.findMany({ select: { id: true } });
  const out: boolean[] = [];
  for (const s of snaps) out.push(await runMetricConsistency({ metricSnapshotId: s.id }));
  return out;
}
