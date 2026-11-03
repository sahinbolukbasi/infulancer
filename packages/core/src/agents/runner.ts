import { prisma } from "../db";
import { isJobEnabled } from "./catalog";
import { findJob } from "./registry";

/**
 * Tüm job çalıştırmalarının tek girişi: açık/kapalı ayarına uyar ve AgentJobRun'a geçmiş yazar
 * (Agent merkezi "son çalışma" ve hata bilgisini buradan gösterir).
 */
export async function runJob(name: string, trigger: "schedule" | "manual" | "cli" = "schedule") {
  const job = findJob(name);
  if (!job) throw new Error(`Bilinmeyen job: ${name}`);
  if (trigger !== "manual" && !(await isJobEnabled(name))) {
    return { job: name, created: 0, skipped: 0, disabled: true };
  }
  const run = await prisma.agentJobRun.create({ data: { job: name, trigger } });
  try {
    const r = await job.run();
    await prisma.agentJobRun.update({ where: { id: run.id }, data: { finishedAt: new Date(), created: r.created, skipped: r.skipped, ok: true } });
    return { job: name, ...r, disabled: false };
  } catch (e) {
    await prisma.agentJobRun.update({ where: { id: run.id }, data: { finishedAt: new Date(), ok: false, error: String((e as Error).message).slice(0, 500) } });
    throw e;
  }
}
