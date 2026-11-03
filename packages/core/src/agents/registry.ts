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
  { name: "influencer-recommendation", schedule: "cron(0 6 * * ? *)", intervalMs: 24 * HOUR, run: async () => tally(await runInfluencerRecommendationAll()) },
];

export function findJob(name: string): ScheduledJob | undefined {
  return scheduledJobs.find((j) => j.name === name);
}
