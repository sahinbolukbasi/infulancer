"use server";
import { prisma } from "@infulancer/core/db";
import { audit } from "@infulancer/core/audit";
import { toAuditActor } from "@infulancer/core/access/actor";
import { createSupportTicket, updateSupportTicket, type SupportCategory, type SupportStatus } from "@infulancer/core/support/service";
import type { ActionState } from "@/lib/action-state";
import { attempt, revalidateAll, str } from "@/lib/action-utils";
import { getActor, requireActor } from "@/lib/auth-guard";

const CATEGORIES: SupportCategory[] = ["HATA", "SORU", "ISTEK", "DIGER"];
const STATUSES: SupportStatus[] = ["ACIK", "INCELEMEDE", "COZULDU", "KAPANDI"];

/** Destek talebi gönderir. Girişli kullanıcıda ad/e-posta otomatik dolar, değiştirilebilir. */
export async function submitSupportTicket(_p: ActionState, fd: FormData): Promise<ActionState> {
  return attempt(async () => {
    const actor = await getActor();
    const user = actor ? await prisma.user.findUnique({ where: { id: actor.userId }, select: { name: true, email: true } }) : null;
    const categoryRaw = str(fd, "category");
    const category = (CATEGORIES.includes(categoryRaw as SupportCategory) ? categoryRaw : "SORU") as SupportCategory;
    await createSupportTicket({
      userId: actor?.userId ?? null,
      role: actor?.role ?? null,
      name: str(fd, "name") || user?.name || "",
      email: str(fd, "email") || user?.email || "",
      category,
      subject: str(fd, "subject"),
      message: str(fd, "message"),
      pageUrl: str(fd, "pageUrl") || null,
    });
    return { ok: true, message: "Talebiniz alındı. En kısa sürede dönüş yapacağız." };
  });
}

/** Yönetici: talep durumu/notu güncelleme. */
export async function updateSupportTicketAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const actor = await requireActor("ADMIN");
  return attempt(async () => {
    const id = str(fd, "id");
    const statusRaw = str(fd, "status");
    const status = STATUSES.includes(statusRaw as SupportStatus) ? (statusRaw as SupportStatus) : undefined;
    const t = await updateSupportTicket(id, { status, adminNote: str(fd, "adminNote") });
    await audit.append({ actor: toAuditActor(actor), action: "SUPPORT_TICKET_UPDATED", entityType: "SupportTicket", entityId: t.id, data: { status } });
    revalidateAll();
    return { ok: true, message: "Talep güncellendi." };
  });
}
