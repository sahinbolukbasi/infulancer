import type { Metadata } from "next";
import { prisma, type AgentCheck, type AgentRunStatus, type Severity } from "@infulancer/core/db";
import { agentCheckLabels, agentRunStatusLabels, severityLabels } from "@infulancer/core/domain/labels";
import { AgentRunList } from "@/components/agent/agent-run-list";
import { Button, ButtonLink, Select } from "@/components/ui/form";
import { PageHeader } from "@/components/ui/layout";
import { requireActor } from "@/lib/auth-guard";

export const metadata: Metadata = { title: "Agent" };

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function AgentPage({
  searchParams,
}: {
  searchParams: Promise<{ kontrol?: string | string[]; onem?: string | string[]; durum?: string | string[] }>;
}) {
  await requireActor("ADMIN");
  const sp = await searchParams;
  const checks = Object.keys(agentCheckLabels) as AgentCheck[];
  const severities = Object.keys(severityLabels) as Severity[];
  const statuses = Object.keys(agentRunStatusLabels) as AgentRunStatus[];
  const check = checks.find((c) => c === one(sp.kontrol));
  const severity = severities.find((s) => s === one(sp.onem));
  const rawStatus = one(sp.durum);
  const status = rawStatus === "TUMU" ? undefined : (statuses.find((s) => s === rawStatus) ?? "ACIK");

  const runs = await prisma.agentRun.findMany({
    where: { ...(check ? { checkType: check } : {}), ...(severity ? { severity } : {}), ...(status ? { status } : {}) },
    orderBy: [{ createdAt: "desc" }],
    include: { resolvedBy: { select: { name: true } } },
    take: 200,
  });
  const sorted = [...runs].sort((a, b) => {
    const rank = { KRITIK: 3, UYARI: 2, BILGI: 1 } as const;
    return rank[b.severity] - rank[a.severity] || b.createdAt.getTime() - a.createdAt.getTime();
  });

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Agent bulguları" description="Agent iş durumunu değiştirmez; öneri ve uyarılar burada onaylanır ya da ezilir." />
      <form method="get" className="flex flex-wrap items-end gap-3" aria-label="Filtre">
        <label className="flex flex-col gap-2">
          <span className="text-label text-fg-muted">Kontrol</span>
          <Select name="kontrol" defaultValue={check ?? ""} className="w-52">
            <option value="">Tümü</option>
            {checks.map((c) => (
              <option key={c} value={c}>
                {agentCheckLabels[c]}
              </option>
            ))}
          </Select>
        </label>
        <label className="flex flex-col gap-2">
          <span className="text-label text-fg-muted">Önem</span>
          <Select name="onem" defaultValue={severity ?? ""} className="w-36">
            <option value="">Tümü</option>
            {severities.map((s) => (
              <option key={s} value={s}>
                {severityLabels[s]}
              </option>
            ))}
          </Select>
        </label>
        <label className="flex flex-col gap-2">
          <span className="text-label text-fg-muted">Durum</span>
          <Select name="durum" defaultValue={status ?? "TUMU"} className="w-36">
            <option value="TUMU">Tümü</option>
            {statuses.map((s) => (
              <option key={s} value={s}>
                {agentRunStatusLabels[s]}
              </option>
            ))}
          </Select>
        </label>
        <Button type="submit" variant="secondary">
          Filtrele
        </Button>
        <ButtonLink href="/admin/agent" variant="ghost">
          Sıfırla
        </ButtonLink>
      </form>
      <p className="text-[13px] text-fg-passive tabular-nums">{sorted.length} bulgu</p>
      <AgentRunList runs={sorted.map((r) => ({ ...r, resolvedByName: r.resolvedBy?.name }))} emptyText="Filtreye uyan bulgu yok." />
    </div>
  );
}
