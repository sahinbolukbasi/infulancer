import { beforeAll, describe, expect, it } from "vitest";
import { ingestText } from "../src/assistant/rag";
import { isWithinHours } from "../src/assistant/runtime";
import { simulateReply, type SimConfig } from "../src/assistant/simulate";
import { makeTenant, resetDb } from "./helpers";

// Kriter 25: Test ekranı — asistanı canlıya almadan, yan etkisiz dener.
describe("K25 asistan önizleme (simulateReply)", () => {
  let T: Awaited<ReturnType<typeof makeTenant>>;
  const base: Omit<SimConfig, "businessHours"> = {
    agentId: "brand_faq",
    systemPrompt: "Markanın müşteri asistanısın. Kısa Türkçe yanıt ver.",
    handoffKeywords: ["insan", "temsilci"],
    confidenceThreshold: 0.1,
    maxTurnsBeforeHandoff: 4,
    outOfHoursBehavior: "auto_reply_then_queue",
  };
  const always: SimConfig = { ...base, businessHours: null };

  beforeAll(async () => {
    await resetDb();
    T = await makeTenant("Önizleme");
    await ingestText(T.tenantId, { type: "manual", uri: "sss", text: "İade: ürünü 14 gün içinde ücretsiz iade edebilirsiniz. Kargo: 500 TL üzeri ücretsiz." });
  });

  it("bilgi tabanından yanıt üretir ve hiçbir konuşma/mesaj oluşturmaz", async () => {
    const r = await simulateReply(T.tenantId, always, "iade kaç gün içinde yapılır");
    expect(r.decision.kind).toBe("reply");
    expect(r.botText).toContain("14 gün");
    expect(r.usedKnowledge.length).toBeGreaterThan(0);
  });

  it("anahtar kelimede temsilciye aktarır", async () => {
    const r = await simulateReply(T.tenantId, always, "bir insan ile görüşmek istiyorum");
    expect(r.decision.kind).toBe("handoff");
    expect(r.botText).not.toBeNull();
    expect(r.handoffLabel).toBeTruthy();
  });

  it("düşük güvende (eşik yüksek) aktarır", async () => {
    const r = await simulateReply(T.tenantId, { ...always, confidenceThreshold: 0.99 }, "mağazanızda hangi renkler var");
    expect(r.decision.kind).toBe("handoff");
  });

  it("mesai dışında queue davranışıyla sessiz kalır", async () => {
    // Pazar (gün 0) mesaide değil: days boş → her zaman mesai dışı.
    const bh = { days: [] as number[], start: "09:00", end: "18:00" };
    const r = await simulateReply(T.tenantId, { ...base, businessHours: bh, outOfHoursBehavior: "queue" }, "insan temsilci");
    expect(r.outOfHours).toBe(true);
    expect(r.botText).toBeNull();
  });
});

describe("isWithinHours", () => {
  it("tanımsız mesai = her zaman açık", () => {
    expect(isWithinHours(null, new Date())).toBe(true);
    expect(isWithinHours({}, new Date())).toBe(true);
  });
  it("gün ve saate göre değerlendirir (Europe/Istanbul UTC+3)", () => {
    const bh = { days: [1, 2, 3, 4, 5], start: "09:00", end: "18:00" };
    // 2024-06-03 Pazartesi 12:00 UTC => 15:00 İstanbul (mesai içi)
    expect(isWithinHours(bh, new Date("2024-06-03T12:00:00Z"))).toBe(true);
    // 2024-06-03 Pazartesi 20:00 UTC => 23:00 İstanbul (mesai dışı)
    expect(isWithinHours(bh, new Date("2024-06-03T20:00:00Z"))).toBe(false);
    // 2024-06-02 Pazar => gün listede değil
    expect(isWithinHours(bh, new Date("2024-06-02T12:00:00Z"))).toBe(false);
  });
});
