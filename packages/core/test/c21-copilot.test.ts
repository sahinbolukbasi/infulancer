import { describe, expect, it } from "vitest";
import { allowedActions, COPILOT_ACTIONS, matchIntent } from "../src/copilot/intents";

describe("asistan niyet motoru", () => {
  it("kampanya başlatma: admin form, marka talep formu, influencer bilgi alır", () => {
    expect(matchIntent("ADMIN", "Yeni kampanya başlat").form).toBe("campaign-start");
    expect(matchIntent("BRAND", "yeni bir kampanya talep etmek istiyorum").form).toBe("campaign-request");
    const inf = matchIntent("INFLUENCER", "kampanya oluştur");
    expect(inf.form).toBeUndefined();
    expect(inf.actions).toContain("jobs");
  });
  it("Türkçe karakter ve büyük harf farkını yok sayar", () => {
    expect(matchIntent("INFLUENCER", "ÖDEMEMİ NASIL ALIRIM").intent).toBe("payments");
    expect(matchIntent("ADMIN", "Onay bekleyen taslaklar").intent).toBe("approvals");
  });
  it("özet istekleri summary döner, bilinmeyenler fallback", () => {
    expect(matchIntent("BRAND", "Bugün ne yapmalıyım?").intent).toBe("summary");
    expect(matchIntent("ADMIN", "qwerty").intent).toBe("fallback");
  });
  it("tüm kural eylemleri rol kataloğunda tanımlı", () => {
    for (const role of ["ADMIN", "BRAND", "INFLUENCER"] as const) {
      for (const q of ["kampanya başlat", "influencer ekle", "onay", "ödeme", "rapor", "davet", "takvim", "mesaj", "uyum", "takipçi", "yeni marka", "xyz"]) {
        const r = matchIntent(role, q);
        expect(allowedActions(role, r.actions).length, `${role}:${q}`).toBe(r.actions.length);
      }
    }
  });
  it("katalog dışı / başka rolün eylemi ve serbest URL süzülür", () => {
    expect(allowedActions("BRAND", ["finance", "campaigns", "https://kotu.example", 5, "campaigns"]).map((a) => a.id)).toEqual(["campaigns"]);
    expect(COPILOT_ACTIONS.BRAND.every((a) => a.href.startsWith("/marka") || a.href.startsWith("/docs"))).toBe(true);
  });
});
