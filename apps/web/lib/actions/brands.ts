"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { z } from "zod";
import { audit } from "@infulancer/core/audit";
import { toAuditActor } from "@infulancer/core/access/actor";
import { prisma } from "@infulancer/core/db";
import { DomainError } from "@infulancer/core/domain/errors";
import type { ActionState } from "@/lib/action-state";
import { attempt, optStr, parseInput, revalidateAll, str } from "@/lib/action-utils";
import { readCategorySelection } from "@/lib/categories";
import { setBrandCategories } from "@infulancer/core/domain/categories";
import { requireActor } from "@/lib/auth-guard";
import { AGENCY_TZ, isDay, zonedToUtc } from "@/lib/time";

const brandSchema = z.object({
  name: z.string().min(2).max(120),
  taxOffice: z.string().min(2).max(80),
  taxNumber: z.string().regex(/^\d{10,11}$/, { error: "10 (VKN) veya 11 (TCKN) haneli olmalı." }),
  contactName: z.string().min(2).max(120),
  contactEmail: z.email().max(200),
  contactPhone: z.string().min(7).max(30),
  contractRef: z.string().max(80).nullable(),
  contractStartsAt: z.string().refine(isDay, { error: "Geçerli bir tarih girin." }).nullable(),
  category: z.string().min(2).max(60),
  competitorBrandIds: z.array(z.string().min(1).max(64)).max(50),
});

const brandLabels: Record<string, string> = {
  name: "Marka adı",
  taxOffice: "Vergi dairesi",
  taxNumber: "Vergi numarası",
  contactName: "Yetkili",
  contactEmail: "Yetkili e-postası",
  contactPhone: "Telefon",
  contractRef: "Sözleşme no",
  contractStartsAt: "Sözleşme başlangıcı",
  category: "Kategori",
  competitorBrandIds: "Rakip markalar",
};

/** Marka oluşturur ya da günceller (id varsa). */
export async function saveBrand(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const actor = await requireActor("ADMIN");
  const id = optStr(fd, "id");
  const created: { id?: string } = {};
  const res = await attempt(async () => {
    const cats = await readCategorySelection(fd);
    const input = parseInput(
      brandSchema,
      {
        name: str(fd, "name"),
        taxOffice: str(fd, "taxOffice"),
        taxNumber: str(fd, "taxNumber").replace(/\s/g, ""),
        contactName: str(fd, "contactName"),
        contactEmail: str(fd, "contactEmail"),
        contactPhone: str(fd, "contactPhone"),
        contractRef: optStr(fd, "contractRef"),
        contractStartsAt: optStr(fd, "contractStartsAt"),
        category: cats.legacyName,
        competitorBrandIds: fd.getAll("competitorBrandIds").map(String).filter((v) => v && v !== id),
      },
      brandLabels,
    );
    const data = {
      ...input,
      contractStartsAt: input.contractStartsAt ? zonedToUtc(input.contractStartsAt, "00:00", AGENCY_TZ) : null,
    };
    if (data.competitorBrandIds.length) {
      const found = await prisma.brand.count({ where: { id: { in: data.competitorBrandIds } } });
      if (found !== data.competitorBrandIds.length) throw new DomainError("DOGRULAMA", "Rakip marka listesi geçersiz.");
    }
    await prisma.$transaction(async (tx) => {
      if (id) {
        const exists = await tx.brand.findUnique({ where: { id }, select: { id: true } });
        if (!exists) throw new DomainError("BULUNAMADI", "Marka bulunamadı.");
        await tx.brand.update({ where: { id }, data });
        await setBrandCategories(tx, id, cats.ids, cats.primaryId);
        await audit.append({ actor: toAuditActor(actor), action: "BRAND_UPDATED", entityType: "Brand", entityId: id, data: input });
      } else {
        const brand = await tx.brand.create({ data });
        await setBrandCategories(tx, brand.id, cats.ids, cats.primaryId);
        created.id = brand.id;
        await audit.append({ actor: toAuditActor(actor), action: "BRAND_CREATED", entityType: "Brand", entityId: brand.id, data: input });
      }
    });
    revalidateAll();
    return { ok: true, message: "Marka kaydedildi." };
  });
  if (res.ok && created.id) redirect(`/admin/markalar/${created.id}`);
  return res;
}

const userSchema = z.object({
  brandId: z.string().min(1).max(64),
  name: z.string().min(2).max(120),
  email: z.email().max(200),
  password: z.string().min(8, { error: "En az 8 karakter olmalı." }).max(200),
});

/** Marka kullanıcısı (geçici şifreyle) oluşturur. */
export async function createBrandUser(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const actor = await requireActor("ADMIN");
  return attempt(async () => {
    const input = parseInput(
      userSchema,
      { brandId: str(fd, "brandId"), name: str(fd, "name"), email: str(fd, "email").toLowerCase(), password: str(fd, "password") },
      { name: "Ad soyad", email: "E-posta", password: "Geçici şifre" },
    );
    const brand = await prisma.brand.findUnique({ where: { id: input.brandId }, select: { id: true } });
    if (!brand) throw new DomainError("BULUNAMADI", "Marka bulunamadı.");
    const passwordHash = await bcrypt.hash(input.password, 10);
    await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { email: input.email, name: input.name, role: "BRAND", brandId: brand.id, passwordHash },
      });
      await audit.append({
        actor: toAuditActor(actor),
        action: "USER_CREATED",
        entityType: "User",
        entityId: user.id,
        data: { role: "BRAND", brandId: brand.id, email: input.email },
      });
    });
    revalidateAll();
    return { ok: true, message: `${input.email} oluşturuldu. Geçici şifreyi kullanıcıyla güvenli bir kanaldan paylaşın.` };
  });
}
