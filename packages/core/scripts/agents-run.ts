/**
 * Planlı agent job'larını bir kez çalıştırır.
 *   npm run agents:run -- --all
 *   npm run agents:run -- --job publish-check
 */
import { findJob, scheduledJobs } from "../src/agents/registry";
import { prisma } from "../src/db";

async function main() {
  const args = process.argv.slice(2);
  const jobIdx = args.indexOf("--job");
  const jobs = args.includes("--all")
    ? scheduledJobs
    : jobIdx >= 0 && args[jobIdx + 1]
      ? [findJob(args[jobIdx + 1]!)].filter((j) => j != null)
      : [];
  if (!jobs.length) {
    console.error(`Kullanım: agents:run -- --all | --job <ad>\nJob'lar: ${scheduledJobs.map((j) => j.name).join(", ")}`);
    process.exit(1);
  }
  let total = 0;
  for (const job of jobs) {
    const r = await job.run();
    total += r.created;
    console.log(`${job.name.padEnd(26)} oluşturulan=${r.created} atlanan=${r.skipped}`);
  }
  console.log(`TOPLAM oluşturulan=${total}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
