"use server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { audit } from "@infulancer/core/audit";
import { toAuditActor } from "@infulancer/core/access/actor";
import { prisma } from "@infulancer/core/db";
import { DomainError } from "@infulancer/core/domain/errors";
import type { ActionState } from "@/lib/action-state";
import { attempt, optStr, parseInput, revalidateAll, str } from "@/lib/action-utils";
import { requireActor } from "@/lib/auth-guard";

/** Kendi ad ve telefonunu günceller (tüm roller). E-posta değişikliği ajans üzerinden yapılır. */
export async function updateProfileAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const actor = await requireActor();
  return attempt(async () => {
    const input = parseInput(
      z.object({ name: z.string().trim().min(2).max(120), phone: z.string().trim().regex(/^\+?[0-9 ()-]{7,20}$/, { error: "Geçerli bir telefon girin." }).nullable() }),
      { name: str(fd, "name"), phone: optStr(fd, "phone") },
      { name: "Ad soyad", phone: "Telefon" },
    );
    await prisma.user.update({ where: { id: actor.userId }, data: input });
    await audit.append({ actor: toAuditActor(actor), action: "PROFILE_UPDATED", entityType: "User", entityId: actor.userId, data: { phone: input.phone ? "değişti" : null } });
    revalidateAll();
    return { ok: true, message: "Profil güncellendi." };
  });
}

/** Şifre değiştirme: mevcut şifre doğrulanır; yeni şifre en az 10 karakter, harf ve rakam. */
export async function changePasswordAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const actor = await requireActor();
  return attempt(async () => {
    const input = parseInput(
      z
        .object({
          current: z.string().min(1).max(200),
          next: z.string().min(10, { error: "En az 10 karakter." }).max(200).regex(/[A-Za-zÇĞİÖŞÜçğıöşü]/, { error: "En az bir harf içermeli." }).regex(/\d/, { error: "En az bir rakam içermeli." }),
          confirm: z.string(),
        })
        .refine((v) => v.next === v.confirm, { error: "Yeni şifreler eşleşmiyor.", path: ["confirm"] }),
      { current: str(fd, "current"), next: str(fd, "next"), confirm: str(fd, "confirm") },
      { current: "Mevcut şifre", next: "Yeni şifre", confirm: "Yeni şifre (tekrar)" },
    );
    const u = await prisma.user.findUniqueOrThrow({ where: { id: actor.userId }, select: { passwordHash: true } });
    if (!(await bcrypt.compare(input.current, u.passwordHash))) throw new DomainError("DOGRULAMA", "Mevcut şifre hatalı.");
    await prisma.user.update({ where: { id: actor.userId }, data: { passwordHash: await bcrypt.hash(input.next, 10) } });
    await audit.append({ actor: toAuditActor(actor), action: "PASSWORD_CHANGED", entityType: "User", entityId: actor.userId, data: {} });
    return { ok: true, message: "Şifreniz değişti." };
  });
}
