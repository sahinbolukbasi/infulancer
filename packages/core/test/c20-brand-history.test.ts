import { describe, expect, it } from "vitest";
import { audit } from "../src/audit";

/** Marka geçmişi sekmesi: marka + kampanya + atama kayıtları tek sorguda, en yeni önce gelir. */
describe("audit.listMany (marka geçmişi)", () => {
  const actor = { id: null, role: "SYSTEM" } as const;
  const tag = `t${Date.now()}`;
  it("birden çok varlık tipini birleştirir, alakasızları dışarıda bırakır", async () => {
    await audit.append({ actor, action: "BRAND_CREATED", entityType: "Brand", entityId: `${tag}-b`, data: {} });
    await audit.append({ actor, action: "CAMPAIGN_CREATED", entityType: "Campaign", entityId: `${tag}-c1`, data: {} });
    await audit.append({ actor, action: "ASSIGNMENT_CREATED", entityType: "Assignment", entityId: `${tag}-a1`, data: {} });
    await audit.append({ actor, action: "CAMPAIGN_CREATED", entityType: "Campaign", entityId: `${tag}-other`, data: {} });
    const rows = await audit.listMany({
      entities: [
        { entityType: "Brand", entityIds: [`${tag}-b`] },
        { entityType: "Campaign", entityIds: [`${tag}-c1`] },
        { entityType: "Assignment", entityIds: [`${tag}-a1`] },
        { entityType: "User", entityIds: [] },
      ],
    });
    expect(rows.map((r) => r.action)).toEqual(["ASSIGNMENT_CREATED", "CAMPAIGN_CREATED", "BRAND_CREATED"]);
    expect(rows.some((r) => r.entityId === `${tag}-other`)).toBe(false);
  });
  it("boş filtre sorgu atmadan boş döner", async () => {
    expect(await audit.listMany({ entities: [{ entityType: "Brand", entityIds: [] }] })).toEqual([]);
  });
});
