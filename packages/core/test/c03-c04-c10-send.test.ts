import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../src/db";
import { recordConsent, registerPendingConsents } from "../src/compliance/iys";
import { SendBlockedError, sendMessage } from "../src/messaging/send";
import { applyTemplateQuality } from "../src/messaging/templates";
import { composerMode } from "../src/messaging/windows";
import { makeConversation, makeTenant, resetDb } from "./helpers";

describe("gönderim hattı kapıları", () => {
  let T: Awaited<ReturnType<typeof makeTenant>>;
  let utility: { id: string };
  let marketing: { id: string };
  let utilityPromo: { id: string };

  beforeAll(async () => {
    await resetDb();
    T = await makeTenant("Gönderim");
    utility = await prisma.messageTemplate.create({ data: { tenantId: T.tenantId, name: "kargo", category: "utility", body: "Siparişiniz kargoda.", status: "ACTIVE", quality: "HIGH" } });
    marketing = await prisma.messageTemplate.create({ data: { tenantId: T.tenantId, name: "kampanya", category: "marketing", body: "Yeni koleksiyon!", status: "ACTIVE", quality: "HIGH" } });
    utilityPromo = await prisma.messageTemplate.create({ data: { tenantId: T.tenantId, name: "kargo_kupon", category: "utility", body: "Siparişiniz kargoda. Bir sonraki alışverişte %10 indirim kuponu: X10", status: "ACTIVE", quality: "HIGH" } });
  });

  // Kriter 3
  describe("K3 pencere kapalıyken serbest metin yok", () => {
    it("serbest metin WINDOW_CLOSED ile engellenir, composer yalnız template sunar", async () => {
      const c = await makeConversation(T.tenantId, { windowOpen: false });
      await expect(sendMessage({ tenantId: T.tenantId, conversationId: c.id, byUserId: T.user.id, text: "Merhaba" })).rejects.toMatchObject({ code: "WINDOW_CLOSED" });
      expect(composerMode("WHATSAPP", c, new Date(), true).mode).toBe("template_only");
    });
    it("onaylı utility template gönderilebilir", async () => {
      const c = await makeConversation(T.tenantId, { windowOpen: false });
      const m = await sendMessage({ tenantId: T.tenantId, conversationId: c.id, byUserId: T.user.id, templateId: utility.id });
      expect(m.category).toBe("utility");
    });
    it("onaysız (IN_REVIEW) template gönderilemez", async () => {
      const c = await makeConversation(T.tenantId, { windowOpen: false });
      const t = await prisma.messageTemplate.create({ data: { tenantId: T.tenantId, name: "inceleme", category: "utility", body: "x", status: "IN_REVIEW" } });
      await expect(sendMessage({ tenantId: T.tenantId, conversationId: c.id, byUserId: T.user.id, templateId: t.id })).rejects.toMatchObject({ code: "TEMPLATE" });
    });
    it("pencere açıkken serbest metin gider", async () => {
      const c = await makeConversation(T.tenantId, { windowOpen: true });
      const m = await sendMessage({ tenantId: T.tenantId, conversationId: c.id, byUserId: T.user.id, text: "Merhaba" });
      expect(m.category).toBe("service");
    });
  });

  // Kriter 4
  describe("K4 İYS onayı olmadan marketing yok", () => {
    it("ONAY kaydı olmayan alıcıya marketing template engellenir ve neden gösterilir", async () => {
      const c = await makeConversation(T.tenantId, { phone: "+905320000001" });
      const err = await sendMessage({ tenantId: T.tenantId, conversationId: c.id, byUserId: T.user.id, templateId: marketing.id }).catch((e) => e);
      expect(err).toBeInstanceOf(SendBlockedError);
      expect(err.code).toBe("IYS");
      expect(err.message).toMatch(/İYS/);
    });
    it("'utility + indirim kuponu' ticari sayılır ve ONAY olmadan engellenir", async () => {
      const c = await makeConversation(T.tenantId, { phone: "+905320000002" });
      await expect(sendMessage({ tenantId: T.tenantId, conversationId: c.id, byUserId: T.user.id, templateId: utilityPromo.id })).rejects.toMatchObject({ code: "IYS" });
    });
    it("ONAY kaydı İYS'ye ulaştıktan sonra gönderim serbest", async () => {
      const phone = "+905320000003";
      await recordConsent({ tenantId: T.tenantId, recipient: phone, channel: "MESAJ", state: "ONAY", source: "web_form", consentedAt: new Date(), aydinlatmaVersion: "v1", evidence: "form" });
      const c = await makeConversation(T.tenantId, { phone });
      // Yerel kayıt var ama canlı İYS'de henüz yok → yine engel (cache yetki kaynağı değil)
      await expect(sendMessage({ tenantId: T.tenantId, conversationId: c.id, byUserId: T.user.id, templateId: marketing.id })).rejects.toMatchObject({ code: "IYS" });
      await registerPendingConsents();
      const m = await sendMessage({ tenantId: T.tenantId, conversationId: c.id, byUserId: T.user.id, templateId: marketing.id });
      expect(m.category).toBe("marketing");
    });
    it("başka tenant'ın onayı kullanılamaz", async () => {
      const other = await makeTenant("Diğer");
      const phone = "+905320000004";
      await recordConsent({ tenantId: other.tenantId, recipient: phone, channel: "MESAJ", state: "ONAY", source: "web_form", consentedAt: new Date(), aydinlatmaVersion: "v1", evidence: "f" });
      await registerPendingConsents();
      const c = await makeConversation(T.tenantId, { phone });
      await expect(sendMessage({ tenantId: T.tenantId, conversationId: c.id, byUserId: T.user.id, templateId: marketing.id })).rejects.toMatchObject({ code: "IYS" });
    });
  });

  // Kriter 10
  describe("K10 kalite Low → gönderim otomatik durur", () => {
    it("Medium hızı %50'ye kısar, Low gönderimi durdurur", async () => {
      const t = await prisma.messageTemplate.create({ data: { tenantId: T.tenantId, name: "kalite", category: "utility", body: "Bilgi", status: "ACTIVE", quality: "HIGH" } });
      await applyTemplateQuality(t.id, "MEDIUM");
      expect(Number((await prisma.messageTemplate.findUniqueOrThrow({ where: { id: t.id } })).sendRateFactor)).toBe(0.5);
      await applyTemplateQuality(t.id, "LOW");
      const c = await makeConversation(T.tenantId);
      const err = await sendMessage({ tenantId: T.tenantId, conversationId: c.id, byUserId: T.user.id, templateId: t.id }).catch((e) => e);
      expect(err.code).toBe("TEMPLATE");
      expect(err.message).toMatch(/Düşük/);
    });
    it("3. duraklatmada template devre dışı kalır (3 sa → 6 sa → disable)", async () => {
      const { applyTemplateStatus } = await import("../src/messaging/templates");
      const t = await prisma.messageTemplate.create({ data: { tenantId: T.tenantId, name: "pause", category: "utility", body: "x", status: "ACTIVE" } });
      const base = Date.now();
      await applyTemplateStatus(t.id, "PAUSED", new Date(base));
      let row = await prisma.messageTemplate.findUniqueOrThrow({ where: { id: t.id } });
      expect(row.pausedUntil!.getTime() - base).toBe(3 * 3_600_000);
      await applyTemplateStatus(t.id, "ACTIVE", new Date(base + 1000));
      await applyTemplateStatus(t.id, "PAUSED", new Date(base + 2000));
      row = await prisma.messageTemplate.findUniqueOrThrow({ where: { id: t.id } });
      expect(row.pausedUntil!.getTime() - (base + 2000)).toBe(6 * 3_600_000);
      await applyTemplateStatus(t.id, "ACTIVE", new Date(base + 3000));
      await applyTemplateStatus(t.id, "PAUSED", new Date(base + 4000));
      row = await prisma.messageTemplate.findUniqueOrThrow({ where: { id: t.id } });
      expect(row.status).toBe("DISABLED");
    });
  });

  it("iptal edilmiş token gönderimi durdurur ve bağlantıyı revoked işaretler", async () => {
    const { vault } = await import("../src/channels/vault");
    const X = await makeTenant("İptal");
    const ref = await vault().put(X.tenantId, "whatsapp", "token-revoked");
    await prisma.channelConnection.update({ where: { id: X.connectionId }, data: { tokenRef: ref } });
    const c = await makeConversation(X.tenantId);
    await expect(sendMessage({ tenantId: X.tenantId, conversationId: c.id, byUserId: X.user.id, text: "selam" })).rejects.toMatchObject({ code: "CONNECTION" });
    expect((await prisma.channelConnection.findUniqueOrThrow({ where: { id: X.connectionId } })).status).toBe("REVOKED");
    await expect(sendMessage({ tenantId: X.tenantId, conversationId: c.id, byUserId: X.user.id, text: "selam" })).rejects.toMatchObject({ code: "CONNECTION" });
  });
});
