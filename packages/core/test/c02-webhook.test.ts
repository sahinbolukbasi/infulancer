import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../src/db";
import { processRawWebhook } from "../src/channels/processor";
import { rawBodies, receiveWebhook, setWebhookEnqueue, verifySignature } from "../src/channels/webhook";
import { makeTenant, resetDb, sign, waTextPayload } from "./helpers";

// Kriter 2: Webhook her koşulda 50 ms içinde 200 döner; duplicate payload ikinci işleme üretmez.
describe("K2 webhook alımı", () => {
  let T: Awaited<ReturnType<typeof makeTenant>>;
  const queued: string[] = [];

  beforeAll(async () => {
    await resetDb();
    T = await makeTenant("Webhook");
    setWebhookEnqueue((id) => queued.push(id));
    // Isınma (bağlantı havuzu)
    await receiveWebhook("meta", "{}", sign("{}"));
  });

  it("geçerli imza ile 50 ms içinde 200 döner ve işleme kuyruğa alınır", async () => {
    const body = waTextPayload(T.phoneNumberId, "905321234567", "wamid.A1", "Merhaba");
    const t0 = performance.now();
    const r = await receiveWebhook("meta", body, sign(body));
    const ms = performance.now() - t0;
    expect(r.status).toBe(200);
    expect(r.accepted).toBe(true);
    expect(ms).toBeLessThan(50);
  });

  it("geçersiz imza, bozuk JSON veya aşırı büyük payload'da da 200 döner", async () => {
    expect((await receiveWebhook("meta", "{}", "sha256=00")).status).toBe(200);
    expect((await receiveWebhook("meta", "not-json", sign("not-json"))).status).toBe(200);
    const big = "x".repeat(3 * 1024 * 1024 + 1);
    expect((await receiveWebhook("meta", big, sign(big))).status).toBe(200);
    expect(verifySignature("{}", sign("{}"), "test-app-secret")).toBe(true);
  });

  it("aynı mesaj kimliğiyle gelen retry ikinci kez işlenmez", async () => {
    const body = waTextPayload(T.phoneNumberId, "905321234567", "wamid.DUP", "Kargom nerede?");
    const r1 = await receiveWebhook("meta", body, sign(body));
    const r2 = await receiveWebhook("meta", body, sign(body));
    await processRawWebhook(r1.rawId!, rawBodies.get(r1.rawId!) ?? body);
    await processRawWebhook(r2.rawId!, rawBodies.get(r2.rawId!) ?? body);
    const n = await prisma.message.count({ where: { externalId: "wamid.DUP" } });
    expect(n).toBe(1);
  });

  it("durum güncellemeleri last-write-wins (sıralama garantisi yok)", async () => {
    const { applyMessageStatus } = await import("../src/channels/processor");
    const m = await prisma.message.findFirstOrThrow({ where: { externalId: "wamid.DUP" } });
    await applyMessageStatus(T.tenantId, "wamid.DUP", "read", new Date("2026-11-03T10:00:05Z"));
    await applyMessageStatus(T.tenantId, "wamid.DUP", "delivered", new Date("2026-11-03T10:00:01Z"));
    const after = await prisma.message.findUniqueOrThrow({ where: { id: m.id } });
    expect(after.status).toBe("read");
  });
});
