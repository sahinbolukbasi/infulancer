
import { z } from "zod";
import { BRAND_NAME, LEGAL_NAME } from "@infulancer/core/brand";
import { prisma } from "@infulancer/core/db";

/** Yasal metinlerde kullanılan veri sorumlusu bilgileri. Admin → Tanıtım sayfası → "Şirket bilgileri"nden düzenlenir. */
export const legalEntitySchema = z.object({
  title: z.string().trim().min(2).max(200),
  shortName: z.string().trim().min(2).max(60),
  mersis: z.string().trim().max(40),
  taxOffice: z.string().trim().max(80),
  taxNumber: z.string().trim().max(20),
  address: z.string().trim().min(5).max(300),
  email: z.email().max(120),
  kvkkEmail: z.email().max(120),
  kep: z.string().trim().max(120),
  phone: z.string().trim().max(40),
  updatedAt: z.string().trim().max(40),
});
export type LegalEntity = z.infer<typeof legalEntitySchema>;
const KEY = "legal.entity";
export const LEGAL_DEFAULTS: LegalEntity = {
  title: LEGAL_NAME,
  shortName: BRAND_NAME,
  mersis: "",
  taxOffice: "",
  taxNumber: "",
  address: "İstanbul, Türkiye",
  email: "destek@infulancer.com",
  kvkkEmail: "kvkk@infulancer.com",
  kep: "",
  phone: "",
  updatedAt: "5 Kasım 2026",
};
export async function getLegalEntity(): Promise<LegalEntity> {
  const row = await prisma.configValue.findUnique({ where: { key: KEY } }).catch(() => null);
  const parsed = legalEntitySchema.safeParse({ ...LEGAL_DEFAULTS, ...((row?.value as object) ?? {}) });
  return parsed.success ? parsed.data : LEGAL_DEFAULTS;
}
export async function saveLegalEntity(v: LegalEntity): Promise<void> {
  await prisma.configValue.upsert({ where: { key: KEY }, create: { key: KEY, value: v, note: "Yasal metinler: veri sorumlusu", verified: true }, update: { value: v, verified: true } });
}
