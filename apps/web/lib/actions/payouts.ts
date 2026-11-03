"use server";

import { z } from "zod";
import { DomainError } from "@infulancer/core/domain/errors";
import { formatKurus } from "@infulancer/core/domain/labels";
import { addToPaymentList, approvePayout, markSent, rejectPayout, requestPayout } from "@infulancer/core/domain/payouts";
import type { ActionState } from "@/lib/action-state";
import { attempt, optStr, parseInput, revalidateAll, str, tlToKurus } from "@/lib/action-utils";
import { requireActor } from "@/lib/auth-guard";

const idSchema = z.string().min(1).max(64);
const idsSchema = z.array(idSchema).min(1, "En az bir talep seçin.").max(500);

function ids(fd: FormData): string[] {
  return fd.getAll("ids").filter((v): v is string => typeof v === "string" && v !== "");
}

/** Influencer çekim talebi (tutar TL). Sınırlar core'da doğrulanır. */
export async function createPayoutRequest(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const actor = await requireActor("INFLUENCER");
  return attempt(async () => {
    const amount = tlToKurus(str(fd, "amount"));
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new DomainError("DOGRULAMA", "Geçerli bir tutar girin (ör. 1.250,00).");
    }
    const payout = await requestPayout(actor, amount);
    revalidateAll();
    return { ok: true, message: `${formatKurus(payout.amountKurus)} için çekim talebiniz oluşturuldu.` };
  });
}

/** Admin: talebi onayla ya da reddet (ret gerekçesi zorunlu). */
export async function decidePayout(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const actor = await requireActor("ADMIN");
  return attempt(async () => {
    const input = parseInput(
      z.object({ id: idSchema, decision: z.enum(["ONAYLA", "REDDET"]), note: z.string().max(1000).nullable() }),
      { id: str(fd, "id"), decision: str(fd, "decision"), note: optStr(fd, "note") },
      { note: "Not" },
    );
    if (input.decision === "ONAYLA") await approvePayout(actor, input.id, input.note);
    else await rejectPayout(actor, input.id, input.note ?? "");
    revalidateAll();
    return { ok: true, message: input.decision === "ONAYLA" ? "Talep onaylandı." : "Talep reddedildi." };
  });
}

/** Admin: onaylanan talepleri yeni bir ödeme listesine (PayoutBatch) al. */
export async function addPayoutsToList(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const actor = await requireActor("ADMIN");
  return attempt(async () => {
    const list = parseInput(idsSchema, ids(fd));
    const res = await addToPaymentList(actor, list);
    revalidateAll();
    return {
      ok: true,
      message: `${res.count} talep ödeme listesine eklendi (${formatKurus(res.totalKurus)}). Banka dosyasını indirebilirsiniz.`,
      data: { batchId: res.batchId },
    };
  });
}

/** Admin: banka transferi yapıldıktan sonra gönderildi olarak işaretle (ODEME ledger çifti yazılır). */
export async function markPayoutsSent(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const actor = await requireActor("ADMIN");
  return attempt(async () => {
    const list = parseInput(idsSchema, ids(fd));
    const res = await markSent(actor, list);
    revalidateAll();
    return { ok: true, message: `${res.count} ödeme gönderildi olarak işaretlendi (${formatKurus(res.totalKurus)}).` };
  });
}
