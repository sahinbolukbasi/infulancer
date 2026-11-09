import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../src/db";
import type { Actor } from "../src/access/actor";
import { createDraft, assertCanEditDraft } from "../src/domain/campaign-draft";
import { setBrandDefaultMode, setExecutionMode } from "../src/domain/campaign-execution";
import { assertCanManageCampaign } from "../src/domain/campaign-manage-guard";
import { makeTenant, resetDb } from "./helpers";

describe("K38 yürütme modu: marka self-serve / ajansa devir", () => {
  let brand: Actor;
  let other: Actor;
  let admin: Actor;

  beforeAll(async () => {
    await resetDb();
    const a = await makeTenant("Mod Marka");
    const b = await makeTenant("Diğer Marka");
    brand = { userId: a.user.id, role: "BRAND", brandId: a.tenantId, influencerId: null };
    other = { userId: b.user.id, role: "BRAND", brandId: b.tenantId, influencerId: null };
    const adm = await prisma.user.create({ data: { email: "adm-mode@ex.com", name: "Ajans", role: "ADMIN", passwordHash: "x" } });
    admin = { userId: adm.id, role: "ADMIN", brandId: null, influencerId: null };
  });

  it("yeni kampanya markanın varsayılan modunu alır (varsayılan AJANS)", async () => {
    const c = await createDraft(brand, { name: "Varsayılan mod", objective: "satis" });
    expect(c.executionMode).toBe("AJANS");
  });

  it("marka varsayılan modu SELF yapınca yeni kampanya SELF açılır", async () => {
    await setBrandDefaultMode(brand, brand.brandId!, "SELF");
    const c = await createDraft(brand, { name: "Self kampanya", objective: "satis" });
    expect(c.executionMode).toBe("SELF");
  });

  it("ajans (ADMIN) açtığı kampanya her zaman AJANS modundadır", async () => {
    const c = await createDraft(admin, { brandId: brand.brandId, name: "Ajans açtı", objective: "satis" });
    expect(c.executionMode).toBe("AJANS");
  });

  it("SELF kampanyada marka yönetebilir; AJANS kampanyada yönetemez", async () => {
    const self = await createDraft(brand, { name: "Self yönet", objective: "satis" }); // varsayılan artık SELF
    expect(self.executionMode).toBe("SELF");
    await expect(assertCanManageCampaign(brand, self.id)).resolves.toMatchObject({ executionMode: "SELF" });

    const toAgency = await setExecutionMode(brand, self.id, "AJANS");
    expect(toAgency).toMatchObject({ changed: true, mode: "AJANS" });
    await expect(assertCanManageCampaign(brand, self.id)).rejects.toThrow(/ajansa devret/i);
    // Ajans her zaman yönetebilir.
    await expect(assertCanManageCampaign(admin, self.id)).resolves.toMatchObject({ executionMode: "AJANS" });
  });

  it("başka markanın kampanyasını yönetemez / modunu değiştiremez", async () => {
    const c = await createDraft(brand, { name: "Başkasının", objective: "satis" });
    await expect(assertCanManageCampaign(other, c.id)).rejects.toThrow();
    await expect(setExecutionMode(other, c.id, "AJANS")).rejects.toThrow(/bulunamadı/i);
  });

  it("SELF kampanyada marka AKTIF taslağı da düzenleyebilir, AJANS devrinde düzenleyemez", async () => {
    const c = await createDraft(brand, { name: "Aktif self", objective: "satis" });
    expect(c.executionMode).toBe("SELF");
    await prisma.campaign.update({ where: { id: c.id }, data: { status: "AKTIF" } });
    // SELF + AKTIF → marka düzenleyebilir
    await expect(assertCanEditDraft(brand, c.id)).resolves.toBeTruthy();
    // Ajansa devret → AKTIF SELF→AJANS marka tarafından serbest değil (yalnız TASLAK→AJANS veya AKTIF→AJANS devir)
    await setExecutionMode(brand, c.id, "AJANS");
    await expect(assertCanEditDraft(brand, c.id)).rejects.toThrow(/ajans/i);
  });

  it("AKTIF SELF kampanyayı marka tekrar SELF'e geri alamaz (ajans işi)", async () => {
    const c = await createDraft(brand, { name: "Geri alma", objective: "satis" });
    await prisma.campaign.update({ where: { id: c.id }, data: { status: "AKTIF", executionMode: "AJANS" } });
    await expect(setExecutionMode(brand, c.id, "SELF")).rejects.toThrow(/ajansa yazın/i);
  });
});
