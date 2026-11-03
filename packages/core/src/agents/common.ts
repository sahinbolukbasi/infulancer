import { prisma, type Prisma } from "../db";
import type { AgentCheck, Severity } from "../generated/prisma/enums";

/**
 * Agent job'larının ortak yardımcıları. Agent'lar iş durumunu değiştirmez;
 * yalnızca AgentRun / Notification yazar (izin verilen türetilmiş alanlar hariç).
 */
export type JobResult = { created: number; skipped: number };

export const DAY_MS = 24 * 60 * 60 * 1000;
export const HOUR_MS = 60 * 60 * 1000;

/** Takvim günü kovası (UTC, YYYY-MM-DD) — günlük job'ların idempotency anahtarı için. */
export function dayBucket(now: Date): string {
  return now.toISOString().slice(0, 10);
}
export function monthBucket(now: Date): string {
  return now.toISOString().slice(0, 7);
}

export type RunInput = {
  checkType: AgentCheck;
  targetType: string;
  targetId: string;
  bucket: string;
  findings: Prisma.InputJsonValue;
  summary: string;
  severity: Severity;
  model: string;
  promptVersion: string;
};

export function idempotencyKey(i: Pick<RunInput, "checkType" | "targetType" | "targetId" | "bucket">): string {
  return `${i.checkType}:${i.targetType}:${i.targetId}:${i.bucket}`;
}

export async function runExists(i: Pick<RunInput, "checkType" | "targetType" | "targetId" | "bucket">): Promise<boolean> {
  const found = await prisma.agentRun.findUnique({ where: { idempotencyKey: idempotencyKey(i) }, select: { id: true } });
  return found != null;
}

/** AgentRun'ı idempotency anahtarıyla yazar. Yeni kayıt oluştuysa true döner. */
export async function recordRun(input: RunInput): Promise<boolean> {
  const key = idempotencyKey(input);
  const existing = await prisma.agentRun.findUnique({ where: { idempotencyKey: key }, select: { id: true } });
  if (existing) return false;
  try {
    await prisma.agentRun.create({
      data: {
        idempotencyKey: key,
        checkType: input.checkType,
        targetType: input.targetType,
        targetId: input.targetId,
        findings: input.findings,
        summary: input.summary,
        severity: input.severity,
        model: input.model,
        promptVersion: input.promptVersion,
      },
    });
    return true;
  } catch (err) {
    // Eşzamanlı çalıştırmada unique ihlali: zaten yazılmış demektir.
    if ((err as { code?: string }).code === "P2002") return false;
    throw err;
  }
}

export async function notifyAdmins(title: string, body: string, href?: string): Promise<void> {
  const admins = await prisma.user.findMany({ where: { role: "ADMIN" }, select: { id: true } });
  if (!admins.length) return;
  await prisma.notification.createMany({ data: admins.map((a) => ({ userId: a.id, title, body, href })) });
}

export async function notifyInfluencer(influencerId: string, title: string, body: string, href?: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { influencerId }, select: { id: true } });
  if (user) await prisma.notification.create({ data: { userId: user.id, title, body, href } });
}

export function tally(results: boolean[]): JobResult {
  const created = results.filter(Boolean).length;
  return { created, skipped: results.length - created };
}
