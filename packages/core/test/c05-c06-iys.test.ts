import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../src/db";
import { addBusinessDays, isOlderThanBusinessDays, makeCalendar } from "../src/compliance/business-days";
import { checkIysSla, ConsentError, deleteConsent, importConsentsCsv, IysValidationError, mockIys, recordConsent, registerPendingConsents, setIysProvider } from "../src/compliance/iys";
import { makeTenant, resetDb } from "./helpers";

describe("İYS", () => {
  let T: Awaited<ReturnType<typeof makeTenant>>;
  beforeAll(async () => {
    await resetDb();
    T = await makeTenant("İYS");
  });

  // Kriter 5
  describe("K5 RET terminal: UI veya CSV ile silinemez/üzerine yazılamaz", () => {
    const phone = "+905330000111";
    beforeAll(async () => {
      await recordConsent({ tenantId: T.tenantId, recipient: phone, channel: "MESAJ", state: "RET", source: "sms_stop", consentedAt: new Date("2026-10-01T10:00:00Z"), aydinlatmaVersion: "opt-out" });
    });
    it("uygulama silme yolu yoktur", async () => {
      await expect(deleteConsent()).rejects.toBeInstanceOf(ConsentError);
    });
    it("veritabanı RET satırının silinmesini engeller (trigger)", async () => {
      await expect(prisma.consent.deleteMany({ where: { recipient: phone } })).rejects.toThrow();
    });
    it("CSV içe aktarma RET'i ONAY'a çeviremez", async () => {
      const r = await importConsentsCsv(T.tenantId, [{ recipient: phone, channel: "MESAJ", state: "ONAY", consentedAt: new Date("2026-11-01T10:00:00Z"), aydinlatmaVersion: "v1", evidence: "csv" }]);
      expect(r.skippedRet).toBe(1);
      expect((await prisma.consent.findFirstOrThrow({ where: { recipient: phone } })).state).toBe("RET");
    });
    it("delilsiz ONAY RET'i kaldıramaz; doğrudan DB güncellemesi de trigger ile engellenir", async () => {
      await expect(recordConsent({ tenantId: T.tenantId, recipient: phone, channel: "MESAJ", state: "ONAY", source: "web_form", consentedAt: new Date(), aydinlatmaVersion: "v1" })).rejects.toBeInstanceOf(ConsentError);
      await expect(prisma.consent.updateMany({ where: { recipient: phone }, data: { state: "ONAY" } })).rejects.toThrow();
      await expect(prisma.consent.updateMany({ where: { recipient: phone }, data: { state: "ONAY", source: "csv_import", evidence: "x", consentedAt: new Date() } })).rejects.toThrow();
    });
    it("yalnız yeni, tarihli ve delilli ONAY kaldırabilir", async () => {
      const c = await recordConsent({ tenantId: T.tenantId, recipient: phone, channel: "MESAJ", state: "ONAY", source: "web_form", consentedAt: new Date("2026-11-02T10:00:00Z"), aydinlatmaVersion: "v2", evidence: "imzalı form #77" });
      expect(c.state).toBe("ONAY");
      expect(await prisma.consentEvidenceLog.count({ where: { consentId: c.id } })).toBe(2);
    });
    it("delil deposu append-only", async () => {
      await expect(prisma.consentEvidenceLog.deleteMany({})).rejects.toThrow();
    });
  });

  // Kriter 6
  describe("K6 3 iş günü SLA alarmı (Türk iş günü takvimi)", () => {
    it("iş günü hesabı hafta sonu ve tatili atlar", () => {
      const cal = makeCalendar(["2026-10-29"]);
      // Cuma 6 Kasım 2026 + 3 iş günü → Çarşamba 11 Kasım sonu
      expect(addBusinessDays(new Date("2026-11-06T09:00:00+03:00"), 3, cal).toISOString()).toBe("2026-11-11T21:00:00.000Z");
      // Salı 27 Ekim + 3 → (29 Ekim tatil) 2 Kasım Pazartesi sonu
      expect(addBusinessDays(new Date("2026-10-27T09:00:00+03:00"), 3, cal).toISOString()).toBe("2026-11-02T21:00:00.000Z");
      expect(isOlderThanBusinessDays(new Date("2026-11-06T09:00:00+03:00"), 1, new Date("2026-11-08T12:00:00+03:00"), cal)).toBe(false);
      expect(isOlderThanBusinessDays(new Date("2026-11-06T09:00:00+03:00"), 1, new Date("2026-11-10T00:30:00+03:00"), cal)).toBe(true);
    });
    it("İYS'ye ulaşmayan kayıt için alarm üretilir", async () => {
      setIysProvider({ register: async () => { throw new Error("İYS erişilemiyor"); }, check: async () => null });
      const c = await recordConsent({ tenantId: T.tenantId, recipient: "+905330000222", channel: "MESAJ", state: "ONAY", source: "web_form", consentedAt: new Date("2026-11-02T10:00:00+03:00"), aydinlatmaVersion: "v1", evidence: "f" });
      await prisma.consentEvent.updateMany({ where: { consentId: c.id }, data: { createdAt: new Date("2026-11-02T10:00:00+03:00") } });
      await expect(registerPendingConsents()).rejects.toThrow();
      const admin = await prisma.user.create({ data: { email: "admin-iys@ex.com", name: "Admin", role: "ADMIN", passwordHash: "x" } });
      const r = await checkIysSla(new Date("2026-11-06T12:00:00+03:00"));
      expect(r.overdue.length).toBeGreaterThan(0);
      expect(await prisma.notification.count({ where: { userId: admin.id, title: { contains: "İYS" } } })).toBe(1);
      setIysProvider(mockIys);
    });
    it("iys-register 422'de batch'i bölerek hatalı kaydı izole eder", async () => {
      let calls = 0;
      setIysProvider({
        register: async (_b, recs) => {
          calls++;
          if (recs.some((r) => r.recipient === "+905330000999")) throw new IysValidationError();
          return { transactionId: "tx" };
        },
        check: async () => null,
      });
      for (const p of ["+905330000301", "+905330000302", "+905330000999", "+905330000304"]) {
        await recordConsent({ tenantId: T.tenantId, recipient: p, channel: "MESAJ", state: "ONAY", source: "web_form", consentedAt: new Date(), aydinlatmaVersion: "v1", evidence: "f" });
      }
      await prisma.consentEvent.updateMany({ where: { consent: { recipient: "+905330000222" } }, data: { processedAt: new Date() } });
      const r = await registerPendingConsents();
      expect(r.failed).toBe(1);
      expect(r.registered).toBeGreaterThanOrEqual(3);
      expect(calls).toBeGreaterThan(1);
      setIysProvider(mockIys);
    });
  });
});
