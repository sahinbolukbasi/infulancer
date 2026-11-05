import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../src/db";
import { makeTenant, resetDb } from "./helpers";

// Kriter 28: Kampanya bütçesi Int sınırını (2.147.483.647 kuruş ≈ 21,4M TL) aşabilmeli (BigInt).
describe("K28 büyük kampanya bütçesi", () => {
  let T: Awaited<ReturnType<typeof makeTenant>>;
  beforeAll(async () => {
    await resetDb();
    T = await makeTenant("BigBudget");
  });

  it("Int tavanını aşan bütçeyle kampanya oluşturur (eski hata: ValueOutOfRange)", async () => {
    const big = 300_000_000_00; // 300 milyon TL = 30.000.000.000 kuruş (Int sınırının ~14 katı)
    const c = await prisma.campaign.create({
      data: {
        brandId: T.tenantId,
        name: "Büyük bütçe",
        slug: `buyuk-${Date.now()}`,
        budgetKurus: big,
        brandTotalFeeKurus: big + 50_000_000_00,
        startsAt: new Date(),
        endsAt: new Date(Date.now() + 86_400_000),
        targets: [],
      },
    });
    const read = await prisma.campaign.findUniqueOrThrow({ where: { id: c.id }, select: { budgetKurus: true, brandTotalFeeKurus: true } });
    expect(Number(read.budgetKurus)).toBe(big);
    expect(Number(read.brandTotalFeeKurus)).toBe(big + 50_000_000_00);
  });
});
