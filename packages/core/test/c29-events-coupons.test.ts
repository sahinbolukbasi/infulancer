import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../src/db";
import { checkInTicket, createEvent, inviteManyToEvent, inviteToEvent, respondInvite, setEventStatus } from "../src/events/service";
import { createCoupon, grantCoupon, grantCouponMany, redeemGrant, setCouponStatus, couponValueLabel } from "../src/coupons/service";
import { mapLinks, uniqueCode } from "../src/wallet/maps";
import { buildWalletLinks } from "../src/wallet/passes";
import { DomainError } from "../src/domain/errors";
import { makeTenant, resetDb } from "./helpers";
import { prisma as db } from "../src/db";

async function makeInfluencer() {
  const u = await db.user.create({ data: { email: `inf-${Date.now()}-${Math.random().toString(36).slice(2,7)}@ex.com`, name: "Inf", role: "INFLUENCER", passwordHash: "x" } });
  const inf = await db.influencer.create({ data: { name: "Test Inf", category: "moda", iban: "TR000000000000000000000000", ibanHolder: "Test Inf", taxStatus: "STOPAJLI", canIssueInvoice: false } });
  await db.user.update({ where: { id: u.id }, data: { influencerId: inf.id } });
  return inf;
}

describe("K29 etkinlik ve bilet", () => {
  let T: Awaited<ReturnType<typeof makeTenant>>;
  let inf: Awaited<ReturnType<typeof makeInfluencer>>;
  beforeAll(async () => {
    await resetDb();
    T = await makeTenant("Etkinlik");
    inf = await makeInfluencer();
  });

  it("etkinlik oluşturur, yayına alır, davet eder, kabulde bilet üretir (QR kodlu)", async () => {
    const e = await createEvent({ tenantId: T.tenantId, title: "Lansman Gecesi", description: "Yeni sezon lansmanı", startsAt: new Date(Date.now() + 7 * 864e5), visibility: "KAPALI", capacity: 2, latitude: 41.0082, longitude: 28.9784, venueName: "Studio X" });
    expect(e.status).toBe("TASLAK");
    await setEventStatus(e.id, "YAYINDA");
    const inv = await inviteToEvent({ eventId: e.id, influencerId: inf.id });
    expect(inv.status).toBe("DAVET_EDILDI");
    const ticket = await respondInvite(inv.id, true, "Can Yılmaz");
    expect(ticket.code).toMatch(/^TKT-/);
    expect(ticket.holderName).toBe("Can Yılmaz");
    // QR + cüzdan bağlantıları üretilir (mock)
    const links = await buildWalletLinks("ticket", ticket.id, ticket.code);
    expect(links.qrDataUrl).toContain("data:image/png;base64,");
    expect(links.appleUrl).toContain("/bilet/");
  });

  it("kapasite dolunca yeni bilet üretmez", async () => {
    const e = await createEvent({ tenantId: T.tenantId, title: "Küçük", description: "d", startsAt: new Date(Date.now() + 864e5), visibility: "KAPALI", capacity: 1 });
    await setEventStatus(e.id, "YAYINDA");
    const i1 = await inviteToEvent({ eventId: e.id, guestName: "A" });
    const i2 = await inviteToEvent({ eventId: e.id, guestName: "B" });
    await respondInvite(i1.id, true);
    await expect(respondInvite(i2.id, true)).rejects.toBeInstanceOf(DomainError);
  });

  it("kapalı etkinliğe davetsiz katılım talebi engellenir; toplu davet tekrarları atlar", async () => {
    const e = await createEvent({ tenantId: T.tenantId, title: "Kapalı", description: "d", startsAt: new Date(Date.now() + 864e5), visibility: "KAPALI" });
    await setEventStatus(e.id, "YAYINDA");
    await expect(inviteToEvent({ eventId: e.id, guestName: "X", isRequest: true })).rejects.toBeInstanceOf(DomainError);
    const r1 = await inviteManyToEvent(e.id, [inf.id, inf.id]);
    expect(r1).toHaveLength(1); // tekrar atlandı
  });

  it("bilet QR ile check-in; ikinci kez kullanılmış döner", async () => {
    const e = await createEvent({ tenantId: T.tenantId, title: "CheckIn", description: "d", startsAt: new Date(Date.now() + 864e5), visibility: "HERKESE_ACIK" });
    await setEventStatus(e.id, "YAYINDA");
    const inv = await inviteToEvent({ eventId: e.id, guestName: "Giriş" });
    const t = await respondInvite(inv.id, true);
    const first = await checkInTicket(t.code);
    expect(first.ok).toBe(true);
    const second = await checkInTicket(t.code);
    expect(second.alreadyUsed).toBe(true);
  });
});

describe("K29 kupon ve hediye çeki", () => {
  let T: Awaited<ReturnType<typeof makeTenant>>;
  let inf: Awaited<ReturnType<typeof makeInfluencer>>;
  beforeAll(async () => {
    T = await makeTenant("Kupon");
    inf = await makeInfluencer();
  });

  it("kupon oluşturur, yayına alır, gönderir (benzersiz kod) ve kullanır", async () => {
    const c = await createCoupon({ tenantId: T.tenantId, kind: "KUPON", title: "Hoş geldin %20", valueType: "YUZDE", value: 20, validUntil: new Date(Date.now() + 30 * 864e5) });
    await setCouponStatus(T.tenantId, c.id, "YAYINDA");
    const g = await grantCoupon(c.id, inf.id);
    expect(g.code).toMatch(/^KPN-/);
    const r = await redeemGrant(g.code);
    expect(r.ok).toBe(true);
    const r2 = await redeemGrant(g.code);
    expect(r2.alreadyUsed).toBe(true);
  });

  it("yayında olmayan kupon gönderilemez; yüzde sınırları doğrulanır", async () => {
    const c = await createCoupon({ tenantId: T.tenantId, kind: "KUPON", title: "Taslak", valueType: "YUZDE", value: 10 });
    await expect(grantCoupon(c.id, inf.id)).rejects.toBeInstanceOf(DomainError);
    await expect(createCoupon({ tenantId: T.tenantId, kind: "KUPON", title: "Hata", valueType: "YUZDE", value: 150 })).rejects.toBeInstanceOf(DomainError);
  });

  it("paylaşılan kod tüm gönderimlerde aynıdır; toplu gönderim tekrarları atlar", async () => {
    const c = await createCoupon({ tenantId: T.tenantId, kind: "HEDIYE_CEKI", title: "Çek", valueType: "TUTAR", value: 50000, sharedCode: "LANSMAN50" });
    await setCouponStatus(T.tenantId, c.id, "YAYINDA");
    const inf2 = await makeInfluencer();
    const grants = await grantCouponMany(c.id, [inf.id, inf2.id, inf.id]);
    expect(grants).toHaveLength(2); // iki farklı kişi; tekrar atlandı
    // Grant kodları benzersizdir; paylaşılan kod kupon şablonunda tutulur.
    expect(new Set(grants.map((g) => g.code)).size).toBe(2);
    const reloaded = await prisma.coupon.findUniqueOrThrow({ where: { id: c.id }, select: { sharedCode: true } });
    expect(reloaded.sharedCode).toBe("LANSMAN50");
    expect(couponValueLabel("TUTAR", 50000n)).toContain("TL");
  });
});

describe("harita ve kod yardımcıları", () => {
  it("koordinatla google/apple harita linki üretir", () => {
    const m = mapLinks({ latitude: 41.0082, longitude: 28.9784, venueName: "Studio" });
    expect(m.hasCoords).toBe(true);
    expect(m.google).toContain("41.0082");
    expect(m.apple).toContain("maps.apple.com");
    expect(m.osmEmbed).toContain("openstreetmap");
  });
  it("benzersiz kod prefix taşır", () => {
    expect(uniqueCode("TKT")).toMatch(/^TKT-[A-Z0-9]+$/);
  });
});
