"use server";
import { z } from "zod";
import { prisma } from "@infulancer/core/db";
import { audit } from "@infulancer/core/audit";
import { toAuditActor } from "@infulancer/core/access/actor";
import { activateAgent, AGENT_TEMPLATES, type AgentKey } from "@infulancer/core/assistant/catalog";
import { AUDIT_AGENTS, setJobEnabled } from "@infulancer/core/agents/catalog";
import { runJob } from "@infulancer/core/agents/runner";
import { DomainError } from "@infulancer/core/domain/errors";
import type { ActionState } from "@/lib/action-state";
import { attempt, bool, parseInput, revalidateAll, str } from "@/lib/action-utils";
import { requireActor } from "@/lib/auth-guard";

/** Denetim agent'ını aç/kapa (yasal zorunlu olanlar kapatılamaz). */
export async function toggleAuditAgent(_p: ActionState, fd: FormData): Promise<ActionState> {
  const actor = await requireActor("ADMIN");
  return attempt(async () => {
    const job = str(fd, "job");
    const enabled = str(fd, "enabled") === "true";
    if (!AUDIT_AGENTS.some((a) => a.job === job)) throw new DomainError("BULUNAMADI", "Agent bulunamadı.");
    try {
      await setJobEnabled(job, enabled);
    } catch (e) {
      throw new DomainError("KURAL_IHLALI", (e as Error).message);
    }
    await audit.append({ actor: toAuditActor(actor), action: "AUDIT_AGENT_TOGGLED", entityType: "AgentJob", entityId: job, data: { enabled } });
    revalidateAll();
    return { ok: true, message: enabled ? "Agent açıldı." : "Agent kapatıldı; zamanlanmış çalıştırmalar atlanacak." };
  });
}

export async function runAuditAgentNow(_p: ActionState, fd: FormData): Promise<ActionState> {
  await requireActor("ADMIN");
  return attempt(async () => {
    const job = str(fd, "job");
    if (!AUDIT_AGENTS.some((a) => a.job === job)) throw new DomainError("BULUNAMADI", "Agent bulunamadı.");
    const r = await runJob(job, "manual");
    revalidateAll();
    return { ok: true, message: `Çalıştı: ${r.created} yeni kayıt, ${r.skipped} atlandı.` };
  });
}

const assistantSchema = z.object({
  agentId: z.enum(AGENT_TEMPLATES.map((t) => t.key) as [AgentKey, ...AgentKey[]]),
  enabled: z.boolean(),
  confidencePct: z.number().int().min(30, { error: "Güven eşiği en az %30." }).max(95, { error: "Güven eşiği en fazla %95." }),
  maxTurns: z.number().int().min(1).max(20),
  keywords: z.array(z.string().min(2).max(40)).min(1, { error: "En az bir 'insana aktar' anahtar kelimesi gerekli." }).max(30),
  outOfHours: z.enum(["queue", "auto_reply_then_queue"]),
  days: z.array(z.number().int().min(0).max(6)).max(7),
  start: z.string().regex(/^\d{2}:\d{2}$/),
  end: z.string().regex(/^\d{2}:\d{2}$/),
  systemPrompt: z.string().min(20, { error: "Talimat en az 20 karakter." }).max(4000),
});

/** Sohbet asistanı ayarları. Marka yalnız kendi asistanını, admin her markanınkini düzenler. */
export async function saveAssistant(_p: ActionState, fd: FormData): Promise<ActionState> {
  const actor = await requireActor("ADMIN", "BRAND");
  return attempt(async () => {
    const tenantId = actor.role === "BRAND" ? actor.brandId! : str(fd, "tenantId");
    if (!(await prisma.brand.findUnique({ where: { id: tenantId }, select: { id: true } }))) throw new DomainError("BULUNAMADI", "Marka bulunamadı.");
    const input = parseInput(assistantSchema, {
      agentId: str(fd, "agentId"),
      enabled: bool(fd, "enabled"),
      confidencePct: Number(str(fd, "confidencePct")),
      maxTurns: Number(str(fd, "maxTurns")),
      keywords: str(fd, "keywords").split(",").map((k) => k.trim().toLocaleLowerCase("tr")).filter(Boolean),
      outOfHours: str(fd, "outOfHours"),
      days: fd.getAll("days").map(Number),
      start: str(fd, "start") || "09:00",
      end: str(fd, "end") || "18:00",
      systemPrompt: str(fd, "systemPrompt"),
    });
    if (input.start >= input.end) throw new DomainError("DOGRULAMA", "Mesai bitişi başlangıçtan sonra olmalı.");
    await activateAgent(tenantId, input.agentId);
    await prisma.agentConfig.update({
      where: { tenantId_agentId: { tenantId, agentId: input.agentId } },
      data: {
        enabled: input.enabled,
        confidenceThreshold: input.confidencePct / 100,
        maxTurnsBeforeHandoff: input.maxTurns,
        handoffKeywords: [...new Set(input.keywords)],
        outOfHoursBehavior: input.outOfHours,
        businessHours: { days: input.days, start: input.start, end: input.end, tz: "Europe/Istanbul" },
        systemPrompt: input.systemPrompt,
      },
    });
    await audit.append({ actor: toAuditActor(actor), action: "ASSISTANT_UPDATED", entityType: "AgentConfig", entityId: `${tenantId}:${input.agentId}`, data: { ...input, systemPrompt: undefined } });
    revalidateAll();
    return { ok: true, message: input.enabled ? "Asistan ayarları kaydedildi." : "Asistan kapatıldı; gelen mesajlar doğrudan temsilci kuyruğuna düşer." };
  });
}
