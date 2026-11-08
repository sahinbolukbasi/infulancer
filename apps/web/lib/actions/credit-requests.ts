"use server";
import { audit } from "@infulancer/core/audit";
import { toAuditActor } from "@infulancer/core/access/actor";
import { approveCreditRequest, createCreditRequest, rejectCreditRequest } from "@infulancer/core/creative/credit-requests";
import type { ActionState } from "@/lib/action-state";
import { attempt, revalidateAll, str } from "@/lib/action-utils";
import { requireActor } from "@/lib/auth-guard";

/** Marka/influencer Creative bakiyesi (TL) talep eder. */
export async function requestCreditAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const actor = await requireActor("BRAND", "INFLUENCER");
  return attempt(async () => {
    const tenantId = actor.role === "BRAND" ? actor.brandId! : actor.influencerId!;
    const amountTry = Number(str(fd, "amount").replace(/\./g, "").replace(",", "."));
    await createCreditRequest({ tenantId, requestedByUserId: actor.userId, role: actor.role, amountTry, note: str(fd, "note") || null });
    revalidateAll();
    return { ok: true, message: "Bakiye talebiniz alındı; yönetici onayından sonra yüklenir." };
  });
}

/** Yönetici bakiye talebini onaylar (bakiye yüklenir). */
export async function approveCreditRequestAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const actor = await requireActor("ADMIN");
  return attempt(async () => {
    const req = await approveCreditRequest(str(fd, "id"), actor.userId);
    await audit.append({ actor: toAuditActor(actor), action: "CREDIT_REQUEST_APPROVED", entityType: "CreditRequest", entityId: req.id, data: { tenantId: req.tenantId, amountTry: req.amountTry } });
    revalidateAll();
    return { ok: true, message: "Talep onaylandı, bakiye yüklendi." };
  });
}

/** Yönetici bakiye talebini reddeder. */
export async function rejectCreditRequestAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const actor = await requireActor("ADMIN");
  return attempt(async () => {
    const req = await rejectCreditRequest(str(fd, "id"), actor.userId);
    await audit.append({ actor: toAuditActor(actor), action: "CREDIT_REQUEST_REJECTED", entityType: "CreditRequest", entityId: req.id, data: { tenantId: req.tenantId } });
    revalidateAll();
    return { ok: true, message: "Talep reddedildi." };
  });
}
