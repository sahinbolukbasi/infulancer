"use server";

import { z } from "zod";
import { audit } from "@infulancer/core/audit";
import { toAuditActor } from "@infulancer/core/access/actor";
import { prisma } from "@infulancer/core/db";
import { DomainError } from "@infulancer/core/domain/errors";
import type { ActionState } from "@/lib/action-state";
import { attempt, optStr, parseInput, revalidateAll, str } from "@/lib/action-utils";
import { requireActor } from "@/lib/auth-guard";

const schema = z.object({
  id: z.string().min(1).max(64),
  decision: z.enum(["ONAYLANDI", "EZILDI"]),
  note: z.string().max(1000).nullable(),
});

/** Agent bulgusunu tek tıkla onayla / ez (opsiyonel not). Agent iş durumunu değiştirmez. */
export async function resolveAgentRun(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const actor = await requireActor("ADMIN");
  return attempt(async () => {
    const input = parseInput(schema, { id: str(fd, "id"), decision: str(fd, "decision"), note: optStr(fd, "note") });
    await prisma.$transaction(async (tx) => {
      const run = await tx.agentRun.findUnique({ where: { id: input.id }, select: { status: true } });
      if (!run) throw new DomainError("BULUNAMADI", "Agent bulgusu bulunamadı.");
      if (run.status !== "ACIK") throw new DomainError("GECERSIZ_GECIS", "Bu bulgu zaten sonuçlandırılmış.");
      await tx.agentRun.update({
        where: { id: input.id },
        data: { status: input.decision, resolvedById: actor.userId, resolutionNote: input.note, resolvedAt: new Date() },
      });
      await audit.append({
        actor: toAuditActor(actor),
        action: "AGENT_RUN_RESOLVED",
        entityType: "AgentRun",
        entityId: input.id,
        data: { decision: input.decision, note: input.note },
      });
    });
    revalidateAll();
    return { ok: true, message: input.decision === "ONAYLANDI" ? "Bulgu onaylandı." : "Bulgu ezildi." };
  });
}
