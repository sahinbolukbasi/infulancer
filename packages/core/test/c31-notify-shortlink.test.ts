import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../src/db";
import { dispatchNotification, recipientsFromUserIds } from "../src/notify/dispatch";
import { renderTemplate } from "../src/notify/catalog";
import { createShortLink, resolveAndCount } from "../src/notify/shortlink";
import { resetDb } from "./helpers";

describe("K31 bildirim dağıtımı", () => {
  let userId: string;
  beforeAll(async () => {
    await resetDb();
    const u = await prisma.user.create({ data: { email: "notify@ex.com", name: "Ali", role: "INFLUENCER", phone: "+905550000000", passwordHash: "x" } });
    userId = u.id;
  });

  it("varsayılan kanallara göre dağıtır ve INAPP bildirimi oluşturur; e-posta mock loglanır", async () => {
    const recipients = await recipientsFromUserIds([userId], () => ({ baslik: "Yaz Partisi", tarih: "20 Ara", link: "https://x/bilet" }));
    const r = await dispatchNotification("EVENT_INVITED", recipients);
    // EVENT_INVITED varsayılan: INAPP + EMAIL + WHATSAPP → inapp SENT, email+wa MOCKED (anahtar yok)
    expect(r.sent).toBeGreaterThanOrEqual(1);
    expect(r.mocked).toBeGreaterThanOrEqual(1);
    const inapp = await prisma.notification.findFirst({ where: { userId } });
    expect(inapp?.body).toContain("Yaz Partisi");
    const logs = await prisma.notificationLog.findMany({ where: { eventKey: "EVENT_INVITED" } });
    expect(logs.length).toBeGreaterThanOrEqual(3);
    expect(logs.some((l) => l.channel === "EMAIL" && l.status === "MOCKED")).toBe(true);
  });

  it("kural ile kanal kapatılınca o kanaldan gönderilmez", async () => {
    await prisma.notificationRule.create({ data: { eventKey: "PAYOUT_APPROVED", channels: ["INAPP"], enabled: true } });
    const recipients = await recipientsFromUserIds([userId], () => ({ tutar: "5.000 TL" }));
    await dispatchNotification("PAYOUT_APPROVED", recipients);
    const logs = await prisma.notificationLog.findMany({ where: { eventKey: "PAYOUT_APPROVED" } });
    expect(logs.every((l) => l.channel === "INAPP")).toBe(true);
  });

  it("renderTemplate yer tutucuları doldurur", () => {
    expect(renderTemplate("Merhaba {{ad}}, {{baslik}}", { ad: "Ali", baslik: "X" })).toBe("Merhaba Ali, X");
  });
});

describe("K31 link kısaltma", () => {
  beforeAll(async () => {
    await resetDb();
  });
  it("kısa link oluşturur ve tıklamayı sayar", async () => {
    const link = await createShortLink("https://infulancer.example/kampanya/yaz", { label: "Yaz" });
    expect(link.slug).toMatch(/^[A-Za-z0-9]+$/);
    const t1 = await resolveAndCount(link.slug);
    expect(t1).toBe("https://infulancer.example/kampanya/yaz");
    await resolveAndCount(link.slug);
    const row = await prisma.shortLink.findUnique({ where: { slug: link.slug } });
    expect(row?.clicks).toBe(2);
  });
  it("geçersiz URL reddedilir; olmayan slug null döner", async () => {
    await expect(createShortLink("geçersiz")).rejects.toThrow();
    expect(await resolveAndCount("yokboyle")).toBeNull();
  });
});
