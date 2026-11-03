import { prisma } from "../db";
import { getConfig } from "../config/store";

/**
 * Meta Marketing API yazma limitleri otomasyon tasarımını belirler:
 * - aynı nesneye 30 sn'de bir düzenleme (subcode 4841018)
 * - ad set bütçe değişikliği saatte 4 (sonrasında 1 saat blok)
 * - mutation 100 istek/sn (app + ad account)
 * Bu yüzden bütçe motoru SAATLİK BATCH çalışır; dakikalık nudge yapan kural motoru YOK.
 * Fazla değişiklikler REDDEDİLMEZ, sonraki saate ötelenir ve UI'da gösterilir.
 */
export type BudgetDecision = { status: "applied" | "deferred"; scheduledFor: Date; reason: string | null; changeId: string };

const HOUR = 3_600_000;

export async function requestBudgetChange(
  input: { tenantId: string; adSetId: string; newBudgetMinor: number; now?: Date },
  apply: (adSetId: string, budget: number) => Promise<void> = async () => {},
): Promise<BudgetDecision> {
  const now = input.now ?? new Date();
  const limits = await getConfig("meta.ads.writeLimits");
  const windowStart = new Date(now.getTime() - HOUR);
  const appliedLastHour = await prisma.adBudgetChange.findMany({
    where: { adSetId: input.adSetId, status: "applied", appliedAt: { gt: windowStart } },
    orderBy: { appliedAt: "asc" },
  });
  const mutation = await prisma.adObjectMutation.findUnique({ where: { objectId: input.adSetId } });

  let scheduledFor = now;
  let reason: string | null = null;
  if (appliedLastHour.length >= limits.adSetBudgetChangesPerHour) {
    // Kayan pencere: en eski değişiklikten 1 saat sonra bir hak açılır; saatlik batch'e hizala.
    const freeAt = new Date(appliedLastHour[0]!.appliedAt!.getTime() + HOUR);
    scheduledFor = nextHourBoundary(freeAt);
    reason = `Ad set bütçesi son 1 saatte ${limits.adSetBudgetChangesPerHour} kez değişti; değişiklik sonraki saate ötelendi.`;
  } else if (mutation && now.getTime() - mutation.lastMutationAt.getTime() < limits.sameObjectEditSeconds * 1000) {
    scheduledFor = new Date(mutation.lastMutationAt.getTime() + limits.sameObjectEditSeconds * 1000);
    reason = `Aynı nesne ${limits.sameObjectEditSeconds} sn içinde tekrar düzenlenemez (4841018); kuyruğa alındı.`;
  }

  // Aynı ad set için sırada bekleyenler varsa onların arkasına geç.
  const queued = await prisma.adBudgetChange.findFirst({ where: { adSetId: input.adSetId, status: "queued" }, orderBy: { scheduledFor: "desc" } });
  if (queued && queued.scheduledFor > scheduledFor) {
    scheduledFor = queued.scheduledFor;
    reason ??= "Önceki ötelenmiş değişiklik bekleniyor.";
  }

  if (scheduledFor.getTime() <= now.getTime()) {
    await apply(input.adSetId, input.newBudgetMinor);
    const c = await prisma.adBudgetChange.create({
      data: { tenantId: input.tenantId, adSetId: input.adSetId, newBudgetMinor: input.newBudgetMinor, requestedAt: now, scheduledFor: now, appliedAt: now, status: "applied" },
    });
    await touchMutation(input.adSetId, "adset", now);
    return { status: "applied", scheduledFor: now, reason: null, changeId: c.id };
  }
  const c = await prisma.adBudgetChange.create({
    data: { tenantId: input.tenantId, adSetId: input.adSetId, newBudgetMinor: input.newBudgetMinor, requestedAt: now, scheduledFor, status: "queued", reason },
  });
  return { status: "deferred", scheduledFor, reason, changeId: c.id };
}

export async function touchMutation(objectId: string, objectType: string, at: Date) {
  await prisma.adObjectMutation.upsert({
    where: { objectId },
    create: { objectId, objectType, lastMutationAt: at },
    update: { lastMutationAt: at },
  });
}

function nextHourBoundary(d: Date): Date {
  const t = new Date(d);
  if (t.getUTCMinutes() || t.getUTCSeconds() || t.getUTCMilliseconds()) {
    t.setUTCMinutes(0, 0, 0);
    t.setUTCHours(t.getUTCHours() + 1);
  }
  return t;
}

/** Saatlik batch: vadesi gelen ötelenmiş değişiklikleri limitlere uyarak uygular. */
export async function runBudgetBatch(now = new Date(), apply: (adSetId: string, budget: number) => Promise<void> = async () => {}) {
  const due = await prisma.adBudgetChange.findMany({ where: { status: "queued", scheduledFor: { lte: now } }, orderBy: { scheduledFor: "asc" } });
  const limiter = new MutationRateLimiter((await getConfig("meta.ads.writeLimits")).mutationQps);
  let applied = 0;
  let deferred = 0;
  // Ad set başına yalnız en son değer anlamlıdır; aradaki değerler atlanır.
  const latest = new Map<string, (typeof due)[number]>();
  for (const c of due) latest.set(c.adSetId, c);
  for (const c of due) if (latest.get(c.adSetId) !== c) await prisma.adBudgetChange.update({ where: { id: c.id }, data: { status: "superseded" } });
  for (const c of latest.values()) {
    await limiter.wait();
    await prisma.adBudgetChange.update({ where: { id: c.id }, data: { status: "processing" } });
    const d = await requestBudgetChange({ tenantId: c.tenantId, adSetId: c.adSetId, newBudgetMinor: c.newBudgetMinor, now }, apply);
    await prisma.adBudgetChange.update({ where: { id: c.id }, data: { status: d.status === "applied" ? "merged" : "superseded" } });
    if (d.status === "applied") applied++;
    else deferred++;
  }
  return { applied, deferred };
}

/** app + ad account başına mutation QPS sınırı (saniyelik kayan pencere). */
export class MutationRateLimiter {
  private stamps: number[] = [];
  constructor(private readonly qps: number, private readonly now: () => number = Date.now, private readonly sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))) {}
  async wait() {
    for (;;) {
      const t = this.now();
      this.stamps = this.stamps.filter((s) => t - s < 1000);
      if (this.stamps.length < this.qps) {
        this.stamps.push(t);
        return;
      }
      await this.sleep(1000 - (t - this.stamps[0]!));
    }
  }
}
