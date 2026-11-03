import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../src/db";
import { activateAgent } from "../src/assistant/catalog";
import { ingestText } from "../src/assistant/rag";
import { billableAiConversations, HANDOFF_MESSAGE, runAgentTurn, tools } from "../src/assistant/runtime";
import { handleInbound } from "../src/channels/processor";
import { makeTenant, resetDb } from "./helpers";

// Kriter 9: Kullanıcı "insan" dediğinde agent cevap üretmeyi bırakır, konuşma atanır, AI ücreti alınmaz.
describe("K9 insana aktarma", () => {
  let T: Awaited<ReturnType<typeof makeTenant>>;
  const since = new Date(Date.now() - 3_600_000);
  beforeAll(async () => {
    await resetDb();
    T = await makeTenant("Aktarma");
    await activateAgent(T.tenantId, "brand_faq");
    await ingestText(T.tenantId, { type: "manual", uri: "sss", text: "İade: ürünü 14 gün içinde ücretsiz iade edebilirsiniz. Kargo: 500 TL üzeri ücretsiz kargo." });
  });

  async function inbound(from: string, text: string, i: number) {
    return handleInbound(T.tenantId, "WHATSAPP", { externalMessageId: `wamid.h.${from}.${i}`, from, phoneE164: `+${from}`, name: "M", text, at: new Date(), fromAd: false });
  }

  it("bilgi tabanından yanıt verir (güven eşiği üstü)", async () => {
    const r = await inbound("905550000001", "iade kaç gün içinde yapılır", 1);
    const out = await prisma.message.findMany({ where: { conversationId: r.conversationId, direction: "OUTBOUND" } });
    expect(out).toHaveLength(1);
    expect(out[0]!.fromAi).toBe(true);
    expect(out[0]!.body).toContain("14 gün");
  });

  it("'insan' isteyince agent yanıt üretmez; konuşma atanır, SLA başlar, AI ücreti yok", async () => {
    const r = await inbound("905550000002", "bir insan temsilci ile görüşmek istiyorum", 1);
    const conv = await prisma.conversation.findUniqueOrThrow({ where: { id: r.conversationId } });
    expect(conv.status).toBe("awaiting_human");
    expect(conv.assignedUserId).toBe(T.user.id);
    expect(conv.aiChargeable).toBe(false);
    expect(conv.slaStartedAt).not.toBeNull();
    const out = await prisma.message.findMany({ where: { conversationId: conv.id, direction: "OUTBOUND" } });
    expect(out.map((m) => m.body)).toEqual([HANDOFF_MESSAGE]);
    // Sonraki mesajlarda agent sessiz kalır
    await inbound("905550000002", "iade süresi kaç gün", 2);
    expect(await prisma.message.count({ where: { conversationId: conv.id, direction: "OUTBOUND" } })).toBe(1);
    expect(await prisma.notification.count({ where: { userId: T.user.id, title: { contains: "atandı" } } })).toBeGreaterThan(0);
  });

  it("düşük güven, hassas konu, şikâyet ve tool hatasında da aktarır", async () => {
    for (const [i, text] of ["uzaya roket fırlatma takvimi nedir", "kredi kartı numaramı nereye yazayım", "rezalet bir hizmet, şikayet edeceğim"].entries()) {
      const r = await inbound(`90556000000${i}`, text, 1);
      expect((await prisma.conversation.findUniqueOrThrow({ where: { id: r.conversationId } })).status).toBe("awaiting_human");
    }
    await activateAgent(T.tenantId, "order_status");
    const c = await inbound("905570000000", "merhaba", 1);
    await prisma.conversation.update({ where: { id: c.conversationId }, data: { status: "open", agentKey: "order_status" } });
    tools.order_lookup = async () => {
      throw new Error("timeout");
    };
    const d = await runAgentTurn(T.tenantId, c.conversationId, "siparişim 12345 nerede");
    expect(d).toMatchObject({ kind: "handoff", reason: "tool_hatasi" });
  });

  it("faturalanabilir AI konuşmaları yalnız AI'ın çözdükleri", async () => {
    expect(await billableAiConversations(T.tenantId, since)).toBe(1);
  });
});
