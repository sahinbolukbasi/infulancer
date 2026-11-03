import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../src/db";
import { clearConfigCache, getConfig, setConfig } from "../src/config/store";
import { hourlyQuota } from "../src/ads/quota";
import { resolveModel } from "../src/creative/registry";
import { rateFor } from "../src/messaging/cost";
import { labelValue, UNVERIFIED_LABEL, withUnverified } from "../src/unverified";
import { resetDb } from "./helpers";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = path.join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith(".ts") || p.endsWith(".tsx") ? [p] : [];
  });
}

// Kriter 16: model ID'leri, ülke oranları ve kota limitleri config'den okunur; kodda sabit yok.
describe("K16 config'den okunan değerler", () => {
  beforeAll(resetDb);

  it("model ID registry tablosundan gelir; tablo değişince sonuç değişir", async () => {
    await prisma.modelRegistry.update({ where: { key: "nano-banana-pro" }, data: { modelId: "fal-ai/nano-banana-pro/v2" } });
    expect((await resolveModel("nano-banana-pro")).modelId).toBe("fal-ai/nano-banana-pro/v2");
  });

  it("ülke oranı country_rates tablosundan gelir", async () => {
    await prisma.countryRate.create({ data: { countryCode: "TR", category: "marketing", rateUsd: 0.0125, effectiveFrom: new Date("2026-10-01"), source: "test" } });
    expect((await rateFor("TR", "marketing", new Date())).rate).toBe(0.0125);
    expect((await rateFor("TR", "marketing", new Date())).verified).toBe(false);
  });

  it("kota limiti config_values'tan gelir", async () => {
    const q = await getConfig("meta.ads.quota");
    await setConfig("meta.ads.quota", { ...q, development: { ...q.development, adsManagementBase: 999 } });
    clearConfigCache();
    expect((await hourlyQuota("development", 0)).adsManagement).toBe(999);
  });

  it("uygulama kodunda (registry/defaults/seed dışında) sabit model ID'si yok", () => {
    const allowed = ["config/defaults.ts", "creative/registry.ts"];
    const files = walk(path.join(root, "src")).filter((f) => !f.includes("generated") && !allowed.some((a) => f.endsWith(a)));
    const offenders = files.filter((f) => /["'`](fal-ai\/|anthropic\.claude|amazon\.titan|stability\.)[^"'`]*["'`]/.test(readFileSync(f, "utf8")));
    expect(offenders.map((f) => path.relative(root, f))).toEqual([]);
  });
});

// Kriter 17: doğrulanmamış rakamlar UI'da "doğrulanmadı" etiketiyle.
describe("K17 doğrulanmamış rakamlar etiketli", () => {
  it("etiket yardımcısı doğrulanmamış değeri işaretler", () => {
    expect(withUnverified("$0,0125", false)).toContain(UNVERIFIED_LABEL);
    expect(labelValue("$0,0125", true).badge).toBeNull();
  });

  it("Türkiye oranları ve TikTok limitleri config'de verified=false", async () => {
    const rows = await prisma.configValue.findMany({ where: { key: { in: ["pricing.competitors", "whatsapp.throughputByLevel", "calendar.tr.holidays"] } } });
    expect(rows.every((r) => r.verified === false)).toBe(true);
  });

  it("fiyat sayfası ve kanal sayfaları doğrulanmamış değerleri etiketle gösterir", () => {
    const web = path.resolve(root, "../../apps/web/app");
    for (const page of ["fiyatlandirma/page.tsx", "admin/kanallar/page.tsx", "admin/creative/page.tsx"]) {
      const src = readFileSync(path.join(web, page), "utf8");
      expect(src, page).toMatch(/UnverifiedBadge|withUnverified|UNVERIFIED_FACTS/);
    }
  });
});
