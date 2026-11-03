/**
 * Yerel zamanlayıcı: her job'ı kendi aralığında çalıştırır (AWS'de EventBridge Scheduler'ın karşılığı).
 * Uzun süre çalışır; arka planda başlatın: npm run agents:scheduler
 */
import { scheduledJobs, type ScheduledJob } from "../src/agents/registry";

const running = new Set<string>();

async function tick(job: ScheduledJob) {
  if (running.has(job.name)) return; // üst üste binmeyi önle
  running.add(job.name);
  try {
    const r = await job.run();
    console.log(`[${new Date().toISOString()}] ${job.name} oluşturulan=${r.created} atlanan=${r.skipped}`);
  } catch (err) {
    console.error(`[${new Date().toISOString()}] ${job.name} hata`, err);
  } finally {
    running.delete(job.name);
  }
}

for (const job of scheduledJobs) {
  void tick(job);
  setInterval(() => void tick(job), job.intervalMs);
}
console.log(`Zamanlayıcı başladı: ${scheduledJobs.map((j) => j.name).join(", ")}`);
