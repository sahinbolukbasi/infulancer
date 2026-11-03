import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../src/db";
import { ingestText, retrieve } from "../src/assistant/rag";
import { withTenant } from "../src/tenancy";
import { makeConversation, makeTenant, resetDb } from "./helpers";

// Kriter 1: Tenant A'nın token'ı, mesajı veya bilgi tabanı parçası Tenant B'nin hiçbir sorgusunda görünmez.
describe("K1 tenant izolasyonu (RLS + WHERE)", () => {
  let A: Awaited<ReturnType<typeof makeTenant>>;
  let B: Awaited<ReturnType<typeof makeTenant>>;

  beforeAll(async () => {
    await resetDb();
    A = await makeTenant("Alfa");
    B = await makeTenant("Beta");
    await ingestText(A.tenantId, { type: "manual", uri: "a", text: "Alfa gizli kargo politikası: siparişler aynı gün kargoda." });
    await ingestText(B.tenantId, { type: "manual", uri: "b", text: "Beta gizli kargo politikası: siparişler aynı gün kargoda." });
    const ca = await makeConversation(A.tenantId);
    const cb = await makeConversation(B.tenantId);
    await prisma.message.create({ data: { tenantId: A.tenantId, conversationId: ca.id, direction: "INBOUND", body: "A mesajı" } });
    await prisma.message.create({ data: { tenantId: B.tenantId, conversationId: cb.id, direction: "INBOUND", body: "B mesajı" } });
  });

  it("retrieval yalnız kendi tenant'ının parçalarını döndürür", async () => {
    const hits = await retrieve(A.tenantId, "gizli kargo politikası", 10);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.every((h) => h.content.includes("Alfa"))).toBe(true);
  });

  it("RLS: WHERE olmadan bile başka tenant'ın parçaları, mesajları ve token referansları görünmez", async () => {
    const res = await withTenant(A.tenantId, async (tx) => ({
      chunks: await tx.$queryRaw<{ content: string }[]>`SELECT content FROM knowledge_chunks`,
      messages: await tx.$queryRaw<{ body: string }[]>`SELECT body FROM messages`,
      tokens: await tx.$queryRaw<{ token_ref: string; tenantId: string }[]>`SELECT token_ref, "tenantId" FROM channel_connections`,
    }));
    expect(res.chunks.map((c) => c.content).join(" ")).not.toContain("Beta");
    expect(res.messages.map((m) => m.body)).toEqual(["A mesajı"]);
    expect(res.tokens.every((t) => t.tenantId === A.tenantId)).toBe(true);
  });

  it("RLS: başka tenant adına satır yazılamaz (WITH CHECK)", async () => {
    await expect(
      withTenant(A.tenantId, (tx) => tx.$executeRaw`INSERT INTO knowledge_sources (id, "tenantId", type, uri, status, "createdAt") VALUES ('x1', ${B.tenantId}, 'manual', 'x', 'ready', now())`),
    ).rejects.toThrow();
  });

  it("token'lar veritabanında değil kasada; token_ref ham token içermez", async () => {
    const conns = await prisma.channelConnection.findMany();
    expect(conns.every((c) => !c.tokenRef.includes("token-ok"))).toBe(true);
  });
});
