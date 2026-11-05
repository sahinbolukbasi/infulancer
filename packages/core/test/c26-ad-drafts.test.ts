import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../src/db";
import { createAdDraft, createAdDraftsBulk, objectivesFor, transitionAdDraft } from "../src/ads/drafts";
import { adGuidance } from "../src/ads/guidance";
import { DomainError } from "../src/domain/errors";
import { makeTenant, resetDb } from "./helpers";

// Kriter 26: Reklam taslağı akışı (mock) — onay kuyruğu, toplu oluşturma, yönlendirme.
describe("K26 reklam taslakları", () => {
  let T: Awaited<ReturnType<typeof makeTenant>>;
  beforeAll(async () => {
    await resetDb();
    T = await makeTenant("Reklam");
  });

  it("taslak oluşturur ve onay akışında ilerler", async () => {
    const d = await createAdDraft({ tenantId: T.tenantId, platform: "META", name: "Yaz", objective: "TRAFFIC", dailyBudgetKurus: 10000, primaryText: "Yeni koleksiyon indirimde, hemen keşfet." });
    expect(d.status).toBe("TASLAK");
    const sent = await transitionAdDraft(T.tenantId, d.id, "ONAY_BEKLIYOR");
    expect(sent.status).toBe("ONAY_BEKLIYOR");
    const approved = await transitionAdDraft(T.tenantId, d.id, "ONAYLANDI");
    expect(approved.status).toBe("ONAYLANDI");
  });

  it("geçersiz durum geçişini reddeder", async () => {
    const d = await createAdDraft({ tenantId: T.tenantId, platform: "META", name: "X", objective: "REACH", dailyBudgetKurus: 5000, primaryText: "metin yeterince uzun" });
    await expect(transitionAdDraft(T.tenantId, d.id, "ONAYLANDI")).rejects.toBeInstanceOf(DomainError);
  });

  it("düşük bütçeyi ve desteklenmeyen hedefi reddeder", async () => {
    await expect(createAdDraft({ tenantId: T.tenantId, platform: "META", name: "Y", objective: "TRAFFIC", dailyBudgetKurus: 500, primaryText: "metin" })).rejects.toBeInstanceOf(DomainError);
    // VIDEO_VIEWS yalnız TikTok'ta geçerli
    await expect(createAdDraft({ tenantId: T.tenantId, platform: "META", name: "Y", objective: "VIDEO_VIEWS", dailyBudgetKurus: 5000, primaryText: "metin" })).rejects.toBeInstanceOf(DomainError);
  });

  it("toplu oluşturma iki platformda aynı batchId ile taslak açar", async () => {
    const { batchId, drafts } = await createAdDraftsBulk(
      { tenantId: T.tenantId, name: "Lansman", objective: "VIDEO_VIEWS", dailyBudgetKurus: 8000, primaryText: "kısa video ile tanıtım" },
      ["META", "TIKTOK"],
    );
    expect(drafts).toHaveLength(2);
    expect(drafts.every((d) => d.batchId === batchId)).toBe(true);
    // Meta VIDEO_VIEWS desteklemez → uygun hedefe düşer; TikTok korur.
    const meta = drafts.find((d) => d.platform === "META")!;
    const tiktok = drafts.find((d) => d.platform === "TIKTOK")!;
    expect(objectivesFor("META").some((o) => o.key === meta.objective)).toBe(true);
    expect(tiktok.objective).toBe("VIDEO_VIEWS");
    const count = await prisma.adDraft.count({ where: { batchId } });
    expect(count).toBe(2);
  });

  it("tenant izolasyonu: başka tenant taslağı geçiremez", async () => {
    const other = await makeTenant("Başka");
    const d = await createAdDraft({ tenantId: T.tenantId, platform: "TIKTOK", name: "Z", objective: "REACH", dailyBudgetKurus: 5000, primaryText: "yeterince uzun metin" });
    await expect(transitionAdDraft(other.tenantId, d.id, "ONAY_BEKLIYOR")).rejects.toBeInstanceOf(DomainError);
  });
});

describe("adGuidance", () => {
  it("görsel yok ve kısa metinde uyarı üretir, duruma göre sonraki adımı verir", () => {
    const tips = adGuidance({ platform: "META", objective: "TRAFFIC", status: "TASLAK", dailyBudgetKurus: 2000, primaryText: "kısa", hasAsset: false });
    expect(tips.some((t) => t.tone === "uyari")).toBe(true);
    expect(tips.some((t) => t.tone === "sonraki_adim")).toBe(true);
  });
  it("TikTok'ta video önerisi ekler", () => {
    const tips = adGuidance({ platform: "TIKTOK", objective: "REACH", status: "ONAYLANDI", dailyBudgetKurus: 10000, primaryText: "ürün tanıtımı metni burada", hasAsset: true });
    expect(tips.some((t) => /video/i.test(t.text))).toBe(true);
  });
});
