import type { AgentCheck, AgentRunStatus, Severity } from "@infulancer/core/enums";
import { agentCheckLabels, agentRunStatusLabels, severityLabels } from "@infulancer/core/domain/labels";
import { AgentRunResolve } from "@/components/forms/small-forms";
import { ActionQueueItem } from "@/components/ui/status";
import { fmtDateTime } from "@/lib/time";

export type AgentRunRow = {
  id: string;
  checkType: AgentCheck;
  severity: Severity;
  status: AgentRunStatus;
  summary: string;
  model: string;
  promptVersion: string;
  createdAt: Date;
  resolutionNote: string | null;
  resolvedByName?: string | null;
};

/** Agent bulguları: açık olanlar için tek tık Onayla / Ez. */
export function AgentRunList({ runs, emptyText = "Agent bulgusu yok." }: { runs: AgentRunRow[]; emptyText?: string }) {
  if (runs.length === 0) return <p className="text-sm text-fg-passive">{emptyText}</p>;
  return (
    <ul className="flex flex-col gap-3">
      {runs.map((r) => (
        <ActionQueueItem
          key={r.id}
          severity={r.severity}
          severityLabel={severityLabels[r.severity]}
          title={r.summary}
          meta={
            <>
              {agentCheckLabels[r.checkType]} · {severityLabels[r.severity]} · {fmtDateTime(r.createdAt)} · {r.model} / {r.promptVersion}
              {r.status !== "ACIK" ? ` · ${agentRunStatusLabels[r.status]}${r.resolvedByName ? ` (${r.resolvedByName})` : ""}` : ""}
              {r.resolutionNote ? ` · Not: ${r.resolutionNote}` : ""}
            </>
          }
          actions={r.status === "ACIK" ? <AgentRunResolve id={r.id} /> : undefined}
        />
      ))}
    </ul>
  );
}
