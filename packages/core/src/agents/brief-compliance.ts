import { prisma } from "../db";
import { getLlm, prompts } from "../llm";
import { recordRun } from "./common";

const DISCLOSURE_RE = /(^|\s)(reklam|tanıtım|#reklam|#işbirliği|#sponsor)(\s|$|[.,:!])/iu;

/**
 * Brief uyumu: kod tarafı (hashtag, mention, zorunlu/yasaklı ifade, reklam açıklaması)
 * + LLM ton/iddia değerlendirmesi. Bir deliverable'ın caption sürümü başına bir kez çalışır.
 */
export async function runBriefCompliance(input: { deliverableId: string }): Promise<boolean> {
  const d = await prisma.deliverable.findUnique({
    where: { id: input.deliverableId },
    include: { assignment: { include: { campaign: { include: { briefs: { orderBy: { version: "desc" }, take: 1 } } } } } },
  });
  if (!d) return false;
  const brief = d.assignment.campaign.briefs[0];
  if (!brief) return false;

  const caption = d.caption ?? "";
  const lower = caption.toLocaleLowerCase("tr");
  const tags = new Set([...d.hashtags, ...(caption.match(/#[\p{L}\d_]+/gu) ?? [])].map((t) => t.toLocaleLowerCase("tr")));
  const ments = new Set([...d.mentions, ...(caption.match(/@[\w.]+/g) ?? [])].map((t) => t.toLocaleLowerCase("tr")));

  const norm = (s: string, prefix: string) => (s.startsWith(prefix) ? s : prefix + s).toLocaleLowerCase("tr");
  const missingHashtags = brief.hashtags.filter((h) => !tags.has(norm(h, "#")));
  const missingMentions = brief.mentions.filter((m) => !ments.has(norm(m, "@")));
  const missingPhrases = brief.requiredPhrases.filter((p) => !lower.includes(p.toLocaleLowerCase("tr")));
  const bannedFound = brief.bannedPhrases.filter((p) => lower.includes(p.toLocaleLowerCase("tr")));
  const disclosureMissing = (brief.disclosureRequired || d.disclosureRequired) && !DISCLOSURE_RE.test(caption);

  const issues = missingHashtags.length + missingMentions.length + missingPhrases.length + bannedFound.length + (disclosureMissing ? 1 : 0);

  const llm = await getLlm().completeText({
    system: prompts.briefUyum.system,
    promptVersion: prompts.briefUyum.version,
    prompt: `Caption: ${caption || "(boş)"}\nBrief: ${brief.text}\nYapılacaklar: ${brief.dos.join("; ")}\nYapılmayacaklar: ${brief.donts.join("; ")}`,
  });

  const parts: string[] = [];
  if (missingHashtags.length) parts.push(`eksik hashtag: ${missingHashtags.join(", ")}`);
  if (missingMentions.length) parts.push(`eksik etiket: ${missingMentions.join(", ")}`);
  if (missingPhrases.length) parts.push(`eksik zorunlu ifade: ${missingPhrases.join(", ")}`);
  if (bannedFound.length) parts.push(`yasaklı ifade: ${bannedFound.join(", ")}`);
  if (disclosureMissing) parts.push("reklam açıklaması (Reklam/Tanıtım) yok");

  // Caption değiştikçe yeniden değerlendirilsin diye kova = caption'ın kısa özeti.
  const bucket = `v${brief.version}:${hash(caption)}`;
  return recordRun({
    checkType: "BRIEF_UYUM",
    targetType: "Deliverable",
    targetId: d.id,
    bucket,
    severity: issues ? "UYARI" : "BILGI",
    summary: issues ? `Brief uyumsuzluğu: ${parts.join("; ")}.` : "Caption brief ile uyumlu.",
    findings: { missingHashtags, missingMentions, missingPhrases, bannedFound, disclosureMissing, llm: llm.text, briefVersion: brief.version },
    model: llm.model,
    promptVersion: prompts.briefUyum.version,
  });
}

function hash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

/** Planlı job: brief'i olan ve caption'ı bulunan, henüz yayınlanmamış deliverable'lar. */
export async function runBriefComplianceAll(): Promise<boolean[]> {
  const list = await prisma.deliverable.findMany({
    where: { caption: { not: null }, status: { in: ["ICERIK_YUKLENDI", "REVIZYON", "ONAYLANDI"] } },
    select: { id: true },
  });
  const out: boolean[] = [];
  for (const d of list) out.push(await runBriefCompliance({ deliverableId: d.id }));
  return out;
}
