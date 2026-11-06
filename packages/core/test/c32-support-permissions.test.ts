import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../src/db";
import { createSupportTicket, updateSupportTicket } from "../src/support/service";
import { clearPagePermission, isPathHidden, isPathHiddenFor, loadPagePermissions, setPagePermission } from "../src/access/page-permissions";
import { resetDb } from "./helpers";

describe("K32 destek talepleri", () => {
  let adminId: string;
  beforeAll(async () => {
    await resetDb();
    const a = await prisma.user.create({ data: { email: "admin@ex.com", name: "Yönetici", role: "ADMIN", passwordHash: "x" } });
    adminId = a.id;
  });
  it("geçerli talep oluşturur ve yöneticilere bildirim düşer", async () => {
    const t = await createSupportTicket({ name: "Ayşe", email: "ayse@ex.com", category: "HATA", subject: "Giriş hatası", message: "Panelde kampanya açılmıyor, hata alıyorum." });
    expect(t.status).toBe("ACIK");
    expect(t.category).toBe("HATA");
    const notif = await prisma.notification.findFirst({ where: { userId: adminId } });
    expect(notif?.href).toBe("/admin/destek");
  });
  it("eksik/geçersiz girdileri reddeder", async () => {
    await expect(createSupportTicket({ name: "A", email: "x", category: "SORU", subject: "ab", message: "kısa" })).rejects.toThrow();
    await expect(createSupportTicket({ name: "Ayşe", email: "gecersiz", category: "SORU", subject: "Konu", message: "Yeterince uzun bir mesaj." })).rejects.toThrow();
  });
  it("yönetici durumu ve notu günceller", async () => {
    const t = await createSupportTicket({ name: "Mehmet", email: "m@ex.com", category: "ISTEK", subject: "Öneri", message: "Karanlık mod rengini açabilir misiniz?" });
    const u = await updateSupportTicket(t.id, { status: "COZULDU", adminNote: "Eklendi." });
    expect(u.status).toBe("COZULDU");
    expect(u.adminNote).toBe("Eklendi.");
  });
});

describe("K32 sayfa görünürlüğü (daraltıcı izin katmanı)", () => {
  beforeAll(async () => {
    await resetDb();
  });
  it("kayıt yoksa her yol görünür", () => {
    expect(isPathHidden([], "BRAND", "u1", "/marka/etkinlikler")) .toBe(false);
  });
  it("ROLE kuralı bir yolu ve alt yollarını gizler", () => {
    const rows = [{ id: "1", scopeType: "ROLE", scopeId: "BRAND", pathPrefix: "/marka/etkinlikler", allowed: false }];
    expect(isPathHidden(rows, "BRAND", "u1", "/marka/etkinlikler")).toBe(true);
    expect(isPathHidden(rows, "BRAND", "u1", "/marka/etkinlikler/yeni")).toBe(true);
    expect(isPathHidden(rows, "BRAND", "u1", "/marka/kuponlar")).toBe(false);
    // Başka rol etkilenmez.
    expect(isPathHidden(rows, "INFLUENCER", "u1", "/marka/etkinlikler")).toBe(false);
  });
  it("kişiye özel allowed=true, rol gizlemesini geri açar", () => {
    const rows = [
      { id: "1", scopeType: "ROLE", scopeId: "BRAND", pathPrefix: "/marka/etkinlikler", allowed: false },
      { id: "2", scopeType: "USER", scopeId: "vip", pathPrefix: "/marka/etkinlikler", allowed: true },
    ];
    expect(isPathHidden(rows, "BRAND", "vip", "/marka/etkinlikler")).toBe(false);
    expect(isPathHidden(rows, "BRAND", "baska", "/marka/etkinlikler")).toBe(true);
  });
  it("en belirgin (en uzun) önek kazanır", () => {
    const rows = [
      { id: "1", scopeType: "ROLE", scopeId: "BRAND", pathPrefix: "/marka", allowed: false },
      { id: "2", scopeType: "ROLE", scopeId: "BRAND", pathPrefix: "/marka/kuponlar", allowed: true },
    ];
    expect(isPathHidden(rows, "BRAND", "u1", "/marka/kuponlar")).toBe(false);
    expect(isPathHidden(rows, "BRAND", "u1", "/marka/etkinlikler")).toBe(true);
  });
  it("veritabanı üzerinden set/clear çalışır", async () => {
    await setPagePermission({ scopeType: "ROLE", scopeId: "BRAND", pathPrefix: "/marka/kuponlar", allowed: false });
    expect(await isPathHiddenFor("BRAND", "u1", "/marka/kuponlar")).toBe(true);
    const rows = await loadPagePermissions("BRAND", "u1");
    expect(rows.length).toBe(1);
    // Aynı kapsam+yol tekrar set edilince güncellenir (çakışma yok).
    await setPagePermission({ scopeType: "ROLE", scopeId: "BRAND", pathPrefix: "/marka/kuponlar", allowed: true });
    expect(await isPathHiddenFor("BRAND", "u1", "/marka/kuponlar")).toBe(false);
    await clearPagePermission("ROLE", "BRAND", "/marka/kuponlar");
    expect(await isPathHiddenFor("BRAND", "u1", "/marka/kuponlar")).toBe(false);
  });
});
