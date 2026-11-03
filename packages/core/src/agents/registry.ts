import type { AppEvent, AppEventType } from "../events";
import { runBriefCompliance, runBriefComplianceAll } from "./brief-compliance";
import { runCampaignSummary, runCampaignSummaryAll } from "./campaign-summary";
import { tally, type JobResult } from "./common";
import { runDeletionCheck } from "./deletion-check";
import { runFakeEngagement, runFakeEngagementAll } from "./fake-engagement";
import { runInfluencerRecommendationAll } from "./influencer-recommendation";
import { runMetricConsistency, runMetricConsistencyAll } from "./metric-consistency";
import { runPublishCheck } from "./publish-check";
import { runStoryReminder } from "./story-reminder";
import { runTargetProjection } from "./target-projection";
import { runBudgetBatch } from "../ads/budget-optimizer";
import { healthCheckConnections } from "../channels/onboarding";
import { purgeExpiredDedupe } from "../channels/webhook";
import { checkIysSla, registerPendingConsents } from "../compliance/iys";
import { remindKvkkFilings } from "../compliance/kvkk";
import { warnClosingWindows } from "../messaging/inbox";

export type EventHandler<T extends AppEventType = AppEventType> = (
  event: Extract<AppEvent, { type: T }>,
) => Promise<void>;

export type HandlerRegistry = { [T in AppEventType]?: EventHandler<T>[] };

/**
 * Olay → agent job eşlemesi. Agent'lar iş durumunu değiştirmez; yalnızca
 * AgentRun/Notification yazar (riskScore ve contractViolation türetilmiş alanları hariç).
 */
export const handlers: HandlerRegistry = {
  ASSET_UPLOADED: [
    async (e) => {
      if (e.deliverableId) await runBriefCompliance({ deliverableId: e.deliverableId });
    },
  ],
  METRIC_SUBMITTED: [async (e) => void (await runMetricConsistency({ metricSnapshotId: e.metricSnapshotId }))],
  CAMPAIGN_CLOSED: [async (e) => void (await runCampaignSummary({ campaignId: e.campaignId }))],
  INFLUENCER_CREATED: [async (e) => void (await runFakeEngagement({ influencerId: e.influencerId }))],
  DELIVERABLE_PUBLISHED: [async () => void (await runPublishCheck())],
};

export type ScheduledJob = {
  name: string;
  /** EventBridge Scheduler ifadesi (Terraform ile aynı). */
  schedule: string;
  /** Yerel zamanlayıcı aralığı (ms). */
  intervalMs: number;
  run: () => Promise<JobResult>;
};

const MIN = 60_000;
const HOUR = 60 * MIN;

export const scheduledJobs: ScheduledJob[] = [
  { name: "publish-check", schedule: "rate(15 minutes)", intervalMs: 15 * MIN, run: async () => tally(await runPublishCheck()) },
  { name: "story-reminder", schedule: "rate(1 hour)", intervalMs: HOUR, run: async () => tally(await runStoryReminder()) },
  { name: "deletion-check", schedule: "cron(0 4 * * ? *)", intervalMs: 24 * HOUR, run: async () => tally(await runDeletionCheck()) },
  { name: "target-projection", schedule: "cron(0 5 * * ? *)", intervalMs: 24 * HOUR, run: async () => tally(await runTargetProjection()) },
  { name: "fake-engagement", schedule: "cron(0 3 1 * ? *)", intervalMs: 30 * 24 * HOUR, run: async () => tally(await runFakeEngagementAll()) },
  // Olay tabanlı job'ların geriye dönük toplu taraması (kaçırılan olaylar için).
  { name: "brief-compliance", schedule: "rate(1 hour)", intervalMs: HOUR, run: async () => tally(await runBriefComplianceAll()) },
  { name: "metric-consistency", schedule: "rate(1 hour)", intervalMs: HOUR, run: async () => tally(await runMetricConsistencyAll()) },
  { name: "campaign-summary", schedule: "rate(1 hour)", intervalMs: HOUR, run: async () => tally(await runCampaignSummaryAll()) },
  // Ek modül: kanallar, uyum, reklam
  { name: "iys-register", schedule: "rate(1 hour)", intervalMs: HOUR, run: async () => ({ created: (await registerPendingConsents()).registered, skipped: 0 }) },
  { name: "iys-sla", schedule: "rate(1 hour)", intervalMs: HOUR, run: async () => ({ created: (await checkIysSla()).aging.length, skipped: 0 }) },
  { name: "kvkk-reminders", schedule: "cron(0 7 * * ? *)", intervalMs: 24 * HOUR, run: async () => ({ created: await remindKvkkFilings(), skipped: 0 }) },
  { name: "channel-health", schedule: "rate(1 hour)", intervalMs: HOUR, run: async () => ({ created: (await healthCheckConnections()).revoked, skipped: 0 }) },
  { name: "window-warnings", schedule: "rate(5 minutes)", intervalMs: 5 * MIN, run: async () => ({ created: await warnClosingWindows(), skipped: 0 }) },
  { name: "ads-budget-batch", schedule: "cron(0 * * * ? *)", intervalMs: HOUR, run: async () => ({ created: (await runBudgetBatch()).applied, skipped: 0 }) },
  { name: "webhook-dedupe-ttl", schedule: "cron(30 3 * * ? *)", intervalMs: 24 * HOUR, run: async () => ({ created: await purgeExpiredDedupe(), skipped: 0 }) },
  { name: "influencer-recommendation", schedule: "cron(0 6 * * ? *)", intervalMs: 24 * HOUR, run: async () => tally(await runInfluencerRecommendationAll()) },
];

export function findJob(name: string): ScheduledJob | undefined {
  return scheduledJobs.find((j) => j.name === name);
}
