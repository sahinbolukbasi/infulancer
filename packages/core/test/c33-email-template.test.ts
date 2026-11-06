import { describe, expect, it } from "vitest";
import { renderBrandedEmail, firstUrl } from "../src/notify/email-template";
import { NOTIF_EVENTS } from "../src/notify/catalog";

describe("K33 markalı e-posta şablonu", () => {
  it("markalı HTML üretir: başlık, marka adı, içerik ve iletişim", () => {
    const html = renderBrandedEmail({ subject: "Davetlisiniz: Yaz Partisi", body: "Merhaba Ayşe,\n\n20 Ara etkinliğine davetlisiniz." });
    expect(html).toContain("<!doctype html>");
    expect(html).toContain("Nordvow");
    expect(html).toContain("Davetlisiniz: Yaz Partisi");
    expect(html).toContain("Merhaba Ayşe");
    expect(html).toContain("info@nordvow.com");
  });
  it("gövdedeki URL'yi CTA butonuna çevirir", () => {
    const html = renderBrandedEmail({ subject: "Yeni teklif", body: "Yanıtlayın: https://nordvow.com/marka/teklifler" });
    expect(html).toContain('href="https://nordvow.com/marka/teklifler"');
    expect(html).toMatch(/border-radius:999px/); // CTA buton stili
  });
  it("HTML enjeksiyonunu kaçışlar", () => {
    const html = renderBrandedEmail({ subject: "Test", body: "<script>alert(1)</script>" });
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
  });
  it("firstUrl gövdedeki ilk bağlantıyı bulur", () => {
    expect(firstUrl("bak https://a.com/x sonra")).toBe("https://a.com/x");
    expect(firstUrl("link yok")).toBeNull();
  });
  it("tüm EMAIL şablonlu olaylar markalı HTML'e sarılabilir", () => {
    for (const e of NOTIF_EVENTS) {
      const t = e.templates.EMAIL;
      if (!t) continue;
      const html = renderBrandedEmail({ subject: t.subject ?? "Bildirim", body: t.body });
      expect(html, e.key).toContain("Nordvow");
      expect(html, e.key).toContain("</html>");
    }
  });
});
