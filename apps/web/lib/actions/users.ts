"use server";
import { z } from "zod";
import { audit } from "@infulancer/core/audit";
import { toAuditActor } from "@infulancer/core/access/actor";
import { prisma } from "@infulancer/core/db";
import { DomainError } from "@infulancer/core/domain/errors";
import type { ActionState } from "@/lib/action-state";
import { attempt, optStr, parseInput, revalidateAll, str } from "@/lib/action-utils";
import { requireActor } from "@/lib/auth-guard";

const schema = z.object({
  userId: z.string().min(1).max(64),
  status: z.enum(["ACTIVE", "SUSPENDED"]),
  note: z.string().max(500).nullable(),
});

/**
 * Kullanıcıyı askıya alır / yeniden etkinleştirir. Askıdaki kullanıcı bir sonraki istekte
 * onay ekranına yönlenir (requireActor durumu her istekte veritabanından okur).
 * Kendi hesabınızı ve son aktif admini askıya alamazsınız; onay bekleyenler Davetler sayfasından yönetilir.
 */
export async function setUserStatusAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const actor = await requireActor("ADMIN");
  return attempt(async () => {
    const input = parseInput(schema, { userId: str(fd, "userId"), status: str(fd, "status"), note: optStr(fd, "note") });
    if (input.userId === actor.userId) throw new DomainError("KURAL_IHLALI", "Kendi hesabınızın durumunu değiştiremezsiniz.");
    await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { id: input.userId }, select: { id: true, role: true, status: true, email: true } });
      if (!user) throw new DomainError("BULUNAMADI", "Kullanıcı bulunamadı.");
      if (user.status === "PENDING" || user.status === "REJECTED") {
        throw new DomainError("KURAL_IHLALI", "Başvurusu süren kullanıcıyı Davetler sayfasından onaylayın veya reddedin.");
      }
      if (user.status === input.status) throw new DomainError("GECERSIZ_GECIS", "Kullanıcı zaten bu durumda.");
      if (user.role === "ADMIN" && input.status === "SUSPENDED") {
        const admins = await tx.user.count({ where: { role: "ADMIN", status: "ACTIVE" } });
        if (admins <= 1) throw new DomainError("KURAL_IHLALI", "Son aktif admin askıya alınamaz.");
      }
      await tx.user.update({ where: { id: user.id }, data: { status: input.status } });
      await audit.append({
        actor: toAuditActor(actor),
        action: input.status === "SUSPENDED" ? "USER_SUSPENDED" : "USER_REACTIVATED",
        entityType: "User",
        entityId: user.id,
        data: { from: user.status, to: input.status, note: input.note },
      });
    });
    revalidateAll();
    return { ok: true, message: input.status === "SUSPENDED" ? "Kullanıcı askıya alındı." : "Kullanıcı yeniden etkinleştirildi." };
  });
}
