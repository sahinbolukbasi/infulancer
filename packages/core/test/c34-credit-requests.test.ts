import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../src/db";
import { createCreditRequest, approveCreditRequest, rejectCreditRequest } from "../src/creative/credit-requests";
import { makeTenant, resetDb } from "./helpers";

describe("K34 Creative bakiye talepleri", () => {
  let tenantId: string;
  let adminId: string;
  beforeAll(async () => {
    await resetDb();
    const t = await makeTenant("BakiyeTest");
    tenantId = t.tenantId;
    const a = await prisma.user.create({ data: { email: "admin34@ex.com", name: "Yönetici", role: "ADMIN", passwordHash: "x" } });
    adminId = a.id;
  });

  it("geçerli talep oluşturur ve yöneticilere bildirim düşer", async () => {
    const r = await createCreditRequest({ tenantId, amountTry: 2000, note: "Video üretimi için" });
    expect(r.status).toBe("BEKLIYOR");
    expect(r.amountTry).toBe(2000);
    const notif = await prisma.notification.findFirst({ where: { userId: adminId } });
    expect(notif?.href).toBe("/admin/bakiye-talepleri");
  });

  it("çok düşük tutarı reddeder ve ikinci bekleyen talebi engeller", async () => {
    await expect(createCreditRequest({ tenantId, amountTry: 50 })).rejects.toThrow();
    // zaten bekleyen talep var (ilk testteki)
    await expect(createCreditRequest({ tenantId, amountTry: 500 })).rejects.toThrow(/bekleyen/);
  });

  it("onay bakiyeyi yükler ve ikinci onay işlemez (idempotent)", async () => {
    const req = await prisma.creditRequest.findFirstOrThrow({ where: { tenantId, status: "BEKLIYOR" } });
    await approveCreditRequest(req.id, adminId);
    const acc = await prisma.creditAccount.findUniqueOrThrow({ where: { tenantId } });
    expect(Number(acc.balanceCredits)).toBe(2000);
    await expect(approveCreditRequest(req.id, adminId)).rejects.toThrow();
  });

  it("red talebi bakiye yüklemez", async () => {
    const r = await createCreditRequest({ tenantId, amountTry: 1000 });
    await rejectCreditRequest(r.id, adminId);
    const acc = await prisma.creditAccount.findUniqueOrThrow({ where: { tenantId } });
    expect(Number(acc.balanceCredits)).toBe(2000); // değişmedi
  });
});
