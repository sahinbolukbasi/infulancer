import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../src/db";
import { approveApplication, checkInvite, createInvite, registerWithInvite, rejectApplication, revokeInvite } from "../src/access/invites";
import { backfillLegacyCategories } from "../src/domain/categories";
import { resetDb } from "./helpers";

describe("davetle kayıt ve onay", () => {
  let admin: { userId: string; role: "ADMIN" };
  let catId: string;
  beforeAll(async () => {
    await resetDb();
    await backfillLegacyCategories();
    const a = await prisma.user.create({ data: { email: "adm-inv@ex.com", name: "Admin", role: "ADMIN", passwordHash: "x" } });
    admin = { userId: a.id, role: "ADMIN" };
    catId = (await prisma.category.findUniqueOrThrow({ where: { slug: "moda" } })).id;
  });

  const reg = (code: string, email: string, kind: "INFLUENCER" | "BRAND" = "INFLUENCER") =>
    registerWithInvite({
      code,
      email,
      password: "GucluSifre123",
      name: "Yeni Kişi",
      phone: "+905321112233",
      acceptTerms: true,
      application: kind === "BRAND" ? { kind, companyName: "Yeni Marka A.Ş.", taxOffice: "Kadıköy", taxNumber: "1234567890", categoryIds: [catId] } : { kind, categoryIds: [catId], instagram: "@yeni.kisi", city: "İzmir" },
    });

  it("geçersiz/eksik kodla kayıt olunamaz; kod kullanım hakkı aşılamaz", async () => {
    await expect(reg("YOKBOYLEKOD", "a@ex.com")).rejects.toThrow(/geçersiz/);
    const inv = await createInvite(admin, { targetRole: "INFLUENCER", maxUses: 1 });
    expect((await checkInvite(inv.code.toLowerCase())).ok).toBe(true);
    await reg(inv.code, "b@ex.com");
    expect((await checkInvite(inv.code)).ok).toBe(false);
    await expect(reg(inv.code, "c@ex.com")).rejects.toThrow(/kullanım hakkı|geçersiz/);
  });

  it("kayıt olan kullanıcı PENDING; profil onaydan önce oluşmaz; onayla influencer profili ve hesaplar oluşur", async () => {
    const u = await prisma.user.findUniqueOrThrow({ where: { email: "b@ex.com" }, include: { application: true } });
    expect(u.status).toBe("PENDING");
    expect(u.influencerId).toBeNull();
    expect(await prisma.notification.count({ where: { userId: admin.userId, title: { contains: "başvuru" } } })).toBe(1);
    await approveApplication(admin, u.application!.id);
    const after = await prisma.user.findUniqueOrThrow({ where: { id: u.id }, include: { influencer: { include: { socialAccounts: true, categories: true, taxProfile: true } } } });
    expect(after.status).toBe("ACTIVE");
    expect(after.influencer?.city).toBe("İzmir");
    expect(after.influencer?.socialAccounts[0]?.handle).toBe("@yeni.kisi");
    expect(after.influencer?.categories).toHaveLength(1);
    expect(after.influencer?.taxProfile?.status).toBe("diger");
    await expect(approveApplication(admin, u.application!.id)).rejects.toThrow(/sonuçlandırılmış/);
  });

  it("influencer yalnız influencer davet edebilir, limitler uygulanır; marka daveti marka başvurusu üretir", async () => {
    const infUser = await prisma.user.findUniqueOrThrow({ where: { email: "b@ex.com" } });
    const actor = { userId: infUser.id, role: "INFLUENCER" as const, influencerId: infUser.influencerId };
    await expect(createInvite(actor, { targetRole: "BRAND" })).rejects.toThrow(/yalnız influencer/);
    const inv = await createInvite(actor, { targetRole: "INFLUENCER", maxUses: 50, expiresInDays: 300 });
    expect(inv.maxUses).toBe(3);
    expect(inv.expiresAt.getTime() - Date.now()).toBeLessThanOrEqual(30 * 86_400_000 + 5000);
    await revokeInvite(actor, inv.id);
    expect((await checkInvite(inv.code)).ok).toBe(false);

    const binv = await createInvite(admin, { targetRole: "BRAND" });
    await expect(reg(binv.code, "d@ex.com", "INFLUENCER")).rejects.toThrow(/üyelik türü/);
    await reg(binv.code, "e@ex.com", "BRAND");
    const app = await prisma.signupApplication.findFirstOrThrow({ where: { user: { email: "e@ex.com" } } });
    await approveApplication(admin, app.id);
    const bu = await prisma.user.findUniqueOrThrow({ where: { email: "e@ex.com" }, include: { brand: { include: { categories: true } } } });
    expect(bu.brand?.name).toBe("Yeni Marka A.Ş.");
    expect(bu.brand?.categories).toHaveLength(1);
  });

  it("red: kullanıcı REJECTED olur ve gerekçe saklanır", async () => {
    const inv = await createInvite(admin, { targetRole: "INFLUENCER" });
    await reg(inv.code, "f@ex.com");
    const app = await prisma.signupApplication.findFirstOrThrow({ where: { user: { email: "f@ex.com" } } });
    await expect(rejectApplication(admin, app.id, "yo")).rejects.toThrow(/gerekçe/);
    await rejectApplication(admin, app.id, "Hesap bilgileri doğrulanamadı");
    const u = await prisma.user.findUniqueOrThrow({ where: { email: "f@ex.com" }, include: { application: true } });
    expect(u.status).toBe("REJECTED");
    expect(u.application?.reviewNote).toMatch(/doğrulanamadı/);
  });
});
