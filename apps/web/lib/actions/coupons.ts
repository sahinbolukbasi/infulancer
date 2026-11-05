"use server";
import { z } from "zod";
import { prisma } from "@infulancer/core/db";
import { audit } from "@infulancer/core/audit";
import { toAuditActor } from "@infulancer/core/access/actor";
import { createCoupon, grantCouponMany, setCouponStatus } from "@infulancer/core/coupons/service";
import { DomainError } from "@infulancer/core/domain/errors";
import type { ActionState } from "@/lib/action-state";
import { attempt, optStr, parseInput, revalidateAll, str, tlToKurus } from "@/lib/action-utils";
import { requireActor } from "@/lib/auth-guard";
import { AGENCY_TZ, isDay, zonedToUtc } from "@/lib/time";

const createSchema = z.object({
  kind: z.enum(["KUPON", "HEDIYE_CEKI"]),
  title: z.string().min(3, { error: "Başlık en az 3 karakter." }).max(140),
  description: z.string().max(2000).optional(),
  valueType: z.enum(["YUZDE", "TUTAR"]),
  value: z.number().int().positive({ error: "Geçerli bir değer girin." }),
  terms: z.string().max(2000).optional(),
  sharedCode: z.string().max(40).optional(),
  logoKey: z.string().optional(),
  heroImageKey: z.string().optional(),
  brandColor: z.string().max(9).optional(),
  validUntilDay: z.string().optional(),
});

function resolveTenant(actor: { role: string; brandId?: string | null }, fd: FormData): string {
  return actor.role === "BRAND" ? actor.brandId! : (optStr(fd, "tenantId") ?? "");
}

/** Kupon / hediye çeki oluşturur (marka veya admin). Taslak olarak başlar. */
export async function createCouponAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const actor = await requireActor("ADMIN", "BRAND");
  return attempt(async () => {
    const valueType = str(fd, "valueType") as "YUZDE" | "TUTAR";
    const rawValue = str(fd, "value");
    const value = valueType === "TUTAR" ? tlToKurus(rawValue) : Number(rawValue);
    const validDay = str(fd, "validUntilDay");
    const input = parseInput(createSchema, {
      kind: str(fd, "kind"),
      title: str(fd, "title"),
      description: str(fd, "description") || undefined,
      valueType,
      value,
      terms: str(fd, "terms") || undefined,
      sharedCode: str(fd, "sharedCode") || undefined,
      logoKey: str(fd, "logoKey") || undefined,
      heroImageKey: str(fd, "heroImageKey") || undefined,
      brandColor: str(fd, "brandColor") || undefined,
      validUntilDay: validDay || undefined,
    });
    const tenantId = resolveTenant(actor, fd);
    const c = await createCoupon({
      tenantId,
      kind: input.kind,
      title: input.title,
      description: input.description,
      valueType: input.valueType,
      value: input.value,
      terms: input.terms,
      sharedCode: input.sharedCode,
      logoKey: input.logoKey,
      heroImageKey: input.heroImageKey,
      brandColor: input.brandColor,
      validUntil: input.validUntilDay && isDay(input.validUntilDay) ? zonedToUtc(input.validUntilDay, "23:59", AGENCY_TZ) : null,
      createdByUserId: actor.userId,
    });
    await audit.append({ actor: toAuditActor(actor), action: "COUPON_CREATED", entityType: "Coupon", entityId: c.id, data: { kind: input.kind, title: input.title } });
    revalidateAll();
    return { ok: true, message: `${input.kind === "HEDIYE_CEKI" ? "Hediye çeki" : "Kupon"} oluşturuldu.` };
  });
}

export async function setCouponStatusAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const actor = await requireActor("ADMIN", "BRAND");
  return attempt(async () => {
    const id = str(fd, "id");
    const to = str(fd, "to") as "TASLAK" | "YAYINDA" | "PASIF";
    const tenantId = actor.role === "BRAND" ? actor.brandId! : (await prisma.coupon.findUnique({ where: { id }, select: { tenantId: true } }))?.tenantId;
    if (!tenantId) throw new DomainError("BULUNAMADI", "Kupon bulunamadı.");
    await setCouponStatus(tenantId, id, to);
    await audit.append({ actor: toAuditActor(actor), action: "COUPON_STATUS", entityType: "Coupon", entityId: id, data: { to } });
    revalidateAll();
    return { ok: true, message: "Kupon durumu güncellendi." };
  });
}

/** Kuponu influencer'lara gönderir (seçili id'ler veya "tümü"). */
export async function grantCouponAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const actor = await requireActor("ADMIN", "BRAND");
  return attempt(async () => {
    const couponId = str(fd, "couponId");
    const tenantId = actor.role === "BRAND" ? actor.brandId! : (await prisma.coupon.findUnique({ where: { id: couponId }, select: { tenantId: true } }))?.tenantId;
    if (!tenantId) throw new DomainError("BULUNAMADI", "Kupon bulunamadı.");
    let ids = fd.getAll("influencerId").map(String).filter(Boolean);
    if (str(fd, "all") === "true") {
      ids = (await prisma.influencer.findMany({ where: { user: { status: "ACTIVE" } }, select: { id: true } })).map((x) => x.id);
    }
    if (!ids.length) throw new DomainError("DOGRULAMA", "En az bir influencer seçin veya 'tümü'nü işaretleyin.");
    const r = await grantCouponMany(couponId, ids);
    await audit.append({ actor: toAuditActor(actor), action: "COUPON_GRANTED", entityType: "Coupon", entityId: couponId, data: { count: r.length } });
    revalidateAll();
    return { ok: true, message: `${r.length} kişiye gönderildi.` };
  });
}
