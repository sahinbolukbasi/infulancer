import { findJob } from "../agents/registry";

/** EventBridge Scheduler hedefi. Girdi: { "job": "<ad>" }. */
export async function handler(event: { job?: string }): Promise<{ job: string; created: number; skipped: number }> {
  const name = event?.job;
  const job = name ? findJob(name) : undefined;
  if (!job) throw new Error(`Bilinmeyen job: ${String(name)}`);
  const r = await job.run();
  console.log(JSON.stringify({ job: job.name, ...r }));
  return { job: job.name, ...r };
}
