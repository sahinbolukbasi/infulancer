import { prisma } from "../db";
import { assertCampaignCanGoLive, CampaignGateError } from "../compliance/disclosure";
import { parseTargets } from "./campaign-score";

/**
 * Kampanya kurulum adımları — oluşturma sihirbazı ve kampanya detayı AYNI kaynaktan okur, böylece
 * oluştururken girilen ile sonradan gösterilen bilgi birebir aynıdır.
 */
export type SetupStepKey = "bilgiler" | "hedefler" | "influencerlar" | "icerik" | "brief" | "yayin";

export type SetupStep = { key: SetupStepKey; title: string; done: boolean; summary: string; issues: string[] };

export async function campaignSetup(campaignId: string) {
  const c = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: {
      brand: { select: { name: true } },
      briefs: { orderBy: { version: "desc" }, take: 1, select: { version: true } },
      assignments: {
        where: { contractStatus: { not: "RED" } },
        include: {
          influencer: { select: { name: true } },
          deliverables: { where: { status: { not: "IPTAL" } }, select: { id: true, contentType: true, frameCount: true, frameTexts: true, usageRightsDays: true, usageRightsChannel: true, usageRightsGeo: true } },
        },
      },
    },
  });
  if (!c) return null;
  let targets: ReturnType<typeof parseTargets> = [];
  try {
    targets = parseTargets(c.targets);
  } catch {
    targets = [];
  }
  const deliverables = c.assignments.flatMap((a) => a.deliverables);
  const withoutDeliverables = c.assignments.filter((a) => a.deliverables.length === 0).map((a) => a.influencer.name);
  const missingRights = deliverables.filter((d) => d.usageRightsDays == null || !d.usageRightsChannel || d.usageRightsGeo.length === 0).length;
  const storyMissingFrames = deliverables.filter((d) => d.contentType === "STORY" && d.frameTexts.length < d.frameCount).length;

  let goLiveIssues: { deliverableId: string; issues: string[] }[] = [];
  if (deliverables.length) {
    try {
      await assertCampaignCanGoLive(campaignId);
    } catch (e) {
      if (e instanceof CampaignGateError) goLiveIssues = e.details;
      else throw e;
    }
  }

  const steps: SetupStep[] = [
    { key: "bilgiler", title: "Kampanya bilgileri", done: true, summary: `${c.brand.name} · ${c.name}`, issues: [] },
    {
      key: "hedefler",
      title: "Hedefler (KPI)",
      done: targets.length > 0,
      summary: targets.length ? `${targets.length} hedef` : "Hedef tanımlanmadı",
      issues: targets.length ? [] : ["Kampanya skoru için en az bir KPI hedefi girin."],
    },
    {
      key: "influencerlar",
      title: "Influencer'lar",
      done: c.assignments.length > 0,
      summary: c.assignments.length ? `${c.assignments.length} influencer (${c.assignments.filter((a) => a.contractStatus === "KABUL").length} kabul)` : "Influencer atanmadı",
      issues: c.assignments.length ? [] : ["En az bir influencer atayın."],
    },
    {
      key: "icerik",
      title: "İçerik planı",
      done: c.assignments.length > 0 && withoutDeliverables.length === 0 && missingRights === 0 && storyMissingFrames === 0,
      summary: `${deliverables.length} içerik${deliverables.some((d) => d.contentType === "STORY") ? ` · ${deliverables.filter((d) => d.contentType === "STORY").reduce((s, d) => s + d.frameCount, 0)} story karesi` : ""}`,
      issues: [
        ...withoutDeliverables.map((n) => `${n} için içerik planlanmadı.`),
        ...(missingRights ? [`${missingRights} içerikte kullanım hakkı eksik.`] : []),
        ...(storyMissingFrames ? [`${storyMissingFrames} story'de kare metinleri eksik.`] : []),
      ],
    },
    {
      key: "brief",
      title: "Brief",
      done: c.briefs.length > 0,
      summary: c.briefs[0] ? `Sürüm ${c.briefs[0].version}` : "Brief yazılmadı",
      issues: c.briefs.length ? [] : ["Influencer'lara gidecek brief'i yazın."],
    },
    {
      key: "yayin",
      title: "Yayın kontrolü",
      done: c.status === "AKTIF" || c.status === "KAPANDI",
      summary: c.status === "AKTIF" ? "Yayında" : c.status === "KAPANDI" ? "Kapandı" : goLiveIssues.length ? `${goLiveIssues.length} içerikte md. 23/A sorunu` : "Kontroller hazır",
      issues: goLiveIssues.flatMap((g) => g.issues.map((i) => `İçerik ${g.deliverableId.slice(-6)}: ${i}`)).slice(0, 20),
    },
  ];
  const readyToActivate = c.status === "TASLAK" && steps.filter((s) => s.key !== "yayin").every((s) => s.done) && goLiveIssues.length === 0;
  return { campaign: c, steps, readyToActivate, completed: steps.filter((s) => s.done).length };
}
