import { SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs";
import { envStr, loadEnv, requireEnv } from "./env";

/**
 * Uygulama olayları. EVENT_MODE=inline (yerel): eşleşen agent job'ları aynı
 * süreçte, çağıranı bekletmeden çalışır. EVENT_MODE=sqs: AGENT_QUEUE_URL'e gönderilir.
 */
export type AppEvent =
  | { type: "ASSET_UPLOADED"; assetId: string; deliverableId?: string | null; campaignId?: string | null }
  | { type: "METRIC_SUBMITTED"; metricSnapshotId: string; deliverableId: string }
  | { type: "CAMPAIGN_CLOSED"; campaignId: string }
  | { type: "INFLUENCER_CREATED"; influencerId: string }
  | { type: "DELIVERABLE_PUBLISHED"; deliverableId: string };

export type AppEventType = AppEvent["type"];

let sqsClient: SQSClient | undefined;

async function runInline(event: AppEvent): Promise<void> {
  const { handlers } = await import("./agents/registry");
  const list = (handlers[event.type] ?? []) as ((e: AppEvent) => Promise<void>)[];
  for (const handler of list) {
    try {
      await handler(event);
    } catch (err) {
      console.error(`[events] ${event.type} işleyicisi hata verdi`, err);
    }
  }
}

/**
 * Olayı yayınlar. Mutasyon transaction'ı tamamlandıktan sonra çağrılmalıdır.
 * Inline modda beklemeden döner (işleyici hataları loglanır, çağırana yansımaz).
 */
export async function publish(event: AppEvent): Promise<void> {
  loadEnv();
  const mode = envStr("EVENT_MODE", "inline");
  if (mode === "sqs") {
    sqsClient ??= new SQSClient({ region: envStr("AWS_REGION", envStr("S3_REGION", "eu-central-1")) });
    await sqsClient.send(
      new SendMessageCommand({
        QueueUrl: requireEnv("AGENT_QUEUE_URL"),
        MessageBody: JSON.stringify(event),
        MessageAttributes: { type: { DataType: "String", StringValue: event.type } },
      }),
    );
    return;
  }
  void runInline(event).catch((err) => console.error("[events] inline çalıştırma hatası", err));
}
