import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { integrationStatuses, modeLabel } from "../src/integrations/status";
import { resetDb } from "./helpers";

// Kriter 27: Entegrasyon durumu — anahtar var/yok ve bayrağa göre canlı/mock raporu.
describe("K27 entegrasyon durumu", () => {
  beforeAll(async () => { await resetDb(); });
  const saved: Record<string, string | undefined> = {};
  const keys = ["FAL_KEY", "FAL_API_KEY", "LLM_PROVIDER", "META_ADS_ACCESS_TOKEN", "META_SYSTEM_USER_TOKEN", "TIKTOK_ACCESS_TOKEN", "WHATSAPP_ACCESS_TOKEN", "META_WABA_TOKEN"];
  beforeEach(() => {
    for (const k of keys) {
      saved[k] = process.env[k];
      delete process.env[k];
    }
  });
  afterEach(() => {
    for (const k of keys) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  it("anahtar yokken ilgili servisler mock raporlar", async () => {
    const list = await integrationStatuses();
    const fal = list.find((x) => x.key === "fal")!;
    const meta = list.find((x) => x.key === "meta-ads")!;
    const tiktok = list.find((x) => x.key === "tiktok-ads")!;
    expect(fal.mode).toBe("mock");
    expect(meta.mode).toBe("mock");
    expect(tiktok.mode).toBe("mock");
    // Mock olanlar sonraki adım içermeli.
    expect(fal.nextStep).toBeTruthy();
    expect(meta.nextStep).toBeTruthy();
  });

  it("anahtar varken canlı raporlar", async () => {
    process.env.FAL_KEY = "x";
    process.env.META_ADS_ACCESS_TOKEN = "y";
    process.env.TIKTOK_ACCESS_TOKEN = "z";
    const list = await integrationStatuses();
    expect(list.find((x) => x.key === "fal")!.mode).toBe("canli");
    expect(list.find((x) => x.key === "meta-ads")!.mode).toBe("canli");
    expect(list.find((x) => x.key === "tiktok-ads")!.mode).toBe("canli");
  });

  it("LLM_PROVIDER=bedrock asistanı canlı yapar", async () => {
    process.env.LLM_PROVIDER = "bedrock";
    const list = await integrationStatuses();
    expect(list.find((x) => x.key === "bedrock-llm")!.mode).toBe("canli");
  });

  it("Bedrock görsel/video varsayılan erişim bekliyor", async () => {
    const list = await integrationStatuses();
    expect(list.find((x) => x.key === "bedrock-image")!.mode).toBe("erisim_bekliyor");
    expect(list.find((x) => x.key === "bedrock-video")!.mode).toBe("erisim_bekliyor");
  });

  it("modeLabel üç modu da Türkçe etiketler", () => {
    expect(modeLabel("canli")).toBe("Canlı");
    expect(modeLabel("mock")).toContain("Mock");
    expect(modeLabel("erisim_bekliyor")).toBe("Erişim bekliyor");
  });
});
