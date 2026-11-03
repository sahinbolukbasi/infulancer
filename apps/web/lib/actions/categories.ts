"use server";
import { audit } from "@infulancer/core/audit";
import { toAuditActor } from "@infulancer/core/access/actor";
import { upsertCategory } from "@infulancer/core/domain/categories";
import type { ActionState } from "@/lib/action-state";
import { attempt, bool, optStr, revalidateAll, str } from "@/lib/action-utils";
import { requireActor } from "@/lib/auth-guard";

export async function saveCategory(_p: ActionState, fd: FormData): Promise<ActionState> {
  const actor = await requireActor("ADMIN");
  return attempt(async () => {
    const id = optStr(fd, "id") ?? undefined;
    const sort = Number(str(fd, "sort") || "500");
    const c = await upsertCategory({ id, name: str(fd, "name"), parentId: optStr(fd, "parentId"), sort: Number.isFinite(sort) ? sort : 500, active: bool(fd, "active") });
    await audit.append({ actor: toAuditActor(actor), action: id ? "CATEGORY_UPDATED" : "CATEGORY_CREATED", entityType: "Category", entityId: c.id, data: { name: c.name, parentId: c.parentId, active: c.active } });
    revalidateAll();
    return { ok: true, message: "Kategori kaydedildi." };
  });
}
