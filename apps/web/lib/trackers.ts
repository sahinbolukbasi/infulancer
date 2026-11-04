import { TRACKER_KEYS, TRACKER_TEMPLATES, type Finding } from "@infulancer/core/agents/trackers";
import { prisma, type Prisma } from "@infulancer/core/db";
import type { TargetOption, TemplateView, TrackerView } from "@/components/agent/tracker-ui";
import { fmtDateTime } from "@/lib/time";

export function templateViews(): TemplateView[] {
  return TRACKER_KEYS.map((k) => {
    const t = TRACKER_TEMPLATES[k];
    return { key: k, title: t.title, scope: t.scope, summary: t.summary, checks: t.checks, defaults: t.defaults };
  });
}

/** Takipçileri hedef adlarıyla birlikte yükler. */
export async function loadTrackerViews(where: Prisma.TrackerAgentWhereInput = {}): Promise<TrackerView[]> {
  const rows = await prisma.trackerAgent.findMany({ where, orderBy: [{ enabled: "desc" }, { createdAt: "desc" }], take: 200 });
  const ids = (scope: string) => rows.filter((r) => r.scope === scope).map((r) => r.targetId);
  const [c, i, b] = await Promise.all([
    prisma.campaign.findMany({ where: { id: { in: ids("CAMPAIGN") } }, select: { id: true, name: true } }),
    prisma.influencer.findMany({ where: { id: { in: ids("INFLUENCER") } }, select: { id: true, name: true } }),
    prisma.brand.findMany({ where: { id: { in: ids("BRAND") } }, select: { id: true, name: true } }),
  ]);
  const names = new Map([...c, ...i, ...b].map((x) => [x.id, x.name]));
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    templateTitle: TRACKER_TEMPLATES[r.template as keyof typeof TRACKER_TEMPLATES]?.title ?? r.template,
    targetName: names.get(r.targetId) ?? "silinmiş kayıt",
    enabled: r.enabled,
    lastRunAt: r.lastRunAt ? fmtDateTime(r.lastRunAt) : null,
    findings: (Array.isArray(r.lastFindings) ? (r.lastFindings as unknown as Finding[]) : []).sort((a, z) => rank(z.severity) - rank(a.severity)),
  }));
}
const rank = (s: string) => (s === "KRITIK" ? 3 : s === "UYARI" ? 2 : 1);

export async function trackerTargets(): Promise<Record<"CAMPAIGN" | "INFLUENCER" | "BRAND", TargetOption[]>> {
  const [CAMPAIGN, INFLUENCER, BRAND] = await Promise.all([
    prisma.campaign.findMany({ where: { status: { in: ["TASLAK", "AKTIF"] } }, orderBy: { startsAt: "desc" }, select: { id: true, name: true }, take: 300 }),
    prisma.influencer.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true }, take: 500 }),
    prisma.brand.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true }, take: 300 }),
  ]);
  return { CAMPAIGN, INFLUENCER, BRAND };
}
