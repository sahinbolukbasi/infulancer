import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../src/db";
import { ingestText } from "../src/assistant/rag";
import { processRawWebhook } from "../src/channels/processor";
import { memoryStore } from "../src/channels/raw-store";
import { receiveWebhook, setWebhookEnqueue } from "../src/channels/webhook";
import { bumpDailyStat } from "../src/messaging/send";
import { purgeMessage } from "../src/messaging/purge";
import { makeConversation, makeTenant, resetDb, sign } from "./helpers";

// Kriter 8: unsend webhook'u Postgres satırını, S3 medyasını ve vector kaydını siler.
describe("K8 mesaj silme (hard-delete cascade)", () => {
  let T: Awaited<ReturnType<typeof makeTenant>>;
  beforeAll(async () => {
    await resetDb();
    T = await makeTenant("Silme");
    setWebhookEnqueue(() => {});
  });

  async function seedMessage(mid: string, channel: "WHATSAPP" | "INSTAGRAM" = "INSTAGRAM") {
    const c = await makeConversation(T.tenantId, { channel });
    const key = `media/${T.tenantId}/${mid}.jpg`;
    await memoryStore.put(key, "img", "image/jpeg");
    const m = await prisma.message.create({ data: { tenantId: T.tenantId, conversationId: c.id, externalId: mid, direction: "INBOUND", body: "silinecek mesaj içeriği hakkında bilgi", mediaS3Key: key } });
    await ingestText(T.tenantId, { type: "message", uri: `msg://${mid}`, text: "silinecek mesaj içeriği hakkında bilgi", messageId: mid });
    await bumpDailyStat(prisma, T.tenantId, channel, "INBOUND", m.createdAt, 1);
    return { m, key };
  }

  it("purge yolu satır, medya, vector ve agregasyonu siler", async () => {
    const { m, key } = await seedMessage("mid.purge.1");
    const day = m.createdAt.toISOString().slice(0, 10);
    const before = await prisma.messageDailyStat.findFirstOrThrow({ where: { tenantId: T.tenantId, day, channel: "INSTAGRAM", direction: "INBOUND" } });
    const r = await purgeMessage(T.tenantId, { id: m.id });
    expect(r).toMatchObject({ found: true, mediaDeleted: true });
    expect(r.chunksDeleted).toBeGreaterThan(0);
    expect(await prisma.message.findUnique({ where: { id: m.id } })).toBeNull();
    expect(await memoryStore.has(key)).toBe(false);
    expect(await prisma.knowledgeChunk.count({ where: { messageId: "mid.purge.1" } })).toBe(0);
    const after = await prisma.messageDailyStat.findFirstOrThrow({ where: { tenantId: T.tenantId, day, channel: "INSTAGRAM", direction: "INBOUND" } });
    expect(after.count).toBe(before.count - 1);
  });

  it("Instagram unsend (is_deleted) webhook'u aynı silmeyi tetikler", async () => {
    await prisma.channelConnection.create({ data: { tenantId: T.tenantId, provider: "INSTAGRAM", externalIds: { ig_user_id: "IG-SILME", page_id: "P1" }, tokenRef: "x", scopes: [], status: "ACTIVE" } });
    const { m, key } = await seedMessage("mid.unsend.2");
    const body = JSON.stringify({ object: "instagram", entry: [{ id: "IG-SILME", time: Date.now(), messaging: [{ sender: { id: "u1" }, recipient: { id: "IG-SILME" }, timestamp: Date.now(), message: { mid: "mid.unsend.2", is_deleted: true } }] }] });
    const rec = await receiveWebhook("meta", body, sign(body));
    await processRawWebhook(rec.rawId!, body);
    expect(await prisma.message.findUnique({ where: { id: m.id } })).toBeNull();
    expect(await memoryStore.has(key)).toBe(false);
    expect(await prisma.knowledgeChunk.count({ where: { messageId: "mid.unsend.2" } })).toBe(0);
  });
});
