import type { SQSBatchResponse, SQSEvent } from "aws-lambda";
import { handlers } from "../agents/registry";
import type { AppEvent } from "../events";

/** SQS agent-events kuyruğu tüketicisi. Başarısız kayıtlar batchItemFailures ile geri döner. */
export async function handler(event: SQSEvent): Promise<SQSBatchResponse> {
  const batchItemFailures: SQSBatchResponse["batchItemFailures"] = [];
  for (const record of event.Records) {
    try {
      const appEvent = JSON.parse(record.body) as AppEvent;
      const list = (handlers[appEvent.type] ?? []) as ((e: AppEvent) => Promise<void>)[];
      for (const h of list) await h(appEvent);
    } catch (err) {
      console.error("[sqs] kayıt işlenemedi", record.messageId, err);
      batchItemFailures.push({ itemIdentifier: record.messageId });
    }
  }
  return { batchItemFailures };
}
