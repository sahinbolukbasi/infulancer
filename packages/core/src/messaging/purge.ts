import { prisma } from "../db";
import { objectStore } from "../channels/raw-store";
import { bumpDailyStat } from "./send";

/**
 * Mesaj silme (unsend webhook / App Review zorunluluğu): mesaj ID'siyle anahtarlı HARD-DELETE.
 * Postgres satırı, S3 medyası, vector index kaydı (knowledge_chunks) ve analitik agregasyon
 * birlikte silinir/düşülür. Faturalama satırı (message_cost_ledger) içerik taşımaz ve korunur. Yedekler: RDS yedekleri saklama süresi sonunda düşer (README).
 */
export type PurgeResult = { found: boolean; mediaDeleted: boolean; chunksDeleted: number };

export async function purgeMessage(tenantId: string, ref: { id?: string; externalId?: string }): Promise<PurgeResult> {
  const msg = await prisma.message.findFirst({
    where: { tenantId, ...(ref.id ? { id: ref.id } : { externalId: ref.externalId }) },
    include: { conversation: { select: { channel: true } } },
  });
  if (!msg) return { found: false, mediaDeleted: false, chunksDeleted: 0 };

  let mediaDeleted = false;
  if (msg.mediaS3Key) {
    await objectStore().delete(msg.mediaS3Key);
    mediaDeleted = true;
  }
  const chunksDeleted = await prisma.$transaction(async (tx) => {
    const ids = [msg.id, msg.externalId].filter((x): x is string => !!x);
    const c = await tx.knowledgeChunk.deleteMany({ where: { tenantId, messageId: { in: ids } } });
    await tx.knowledgeSource.deleteMany({ where: { tenantId, messageId: { in: ids } } });
    await bumpDailyStat(tx, tenantId, msg.conversation.channel, msg.direction, msg.createdAt, -1);
    await tx.message.delete({ where: { id: msg.id } });
    return c.count;
  });
  return { found: true, mediaDeleted, chunksDeleted };
}
