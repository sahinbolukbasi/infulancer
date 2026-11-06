"use server";
import { audit } from "@infulancer/core/audit";
import { toAuditActor } from "@infulancer/core/access/actor";
import { clearPagePermission, setPagePermission } from "@infulancer/core/access/page-permissions";
import type { Role } from "@infulancer/core/enums";
import type { ActionState } from "@/lib/action-state";
import { attempt, revalidateAll, str } from "@/lib/action-utils";
import { requireAdmin } from "@/lib/auth-guard";

const ROLES: Role[] = ["ADMIN", "AGENCY", "BRAND", "INFLUENCER"];

/**
 * Rol için bir sayfanın görünürlüğünü değiştirir (aç/kapat). allowed=false gizler.
 * Yalnız platform yöneticisi; koddaki rol kuralları değişmez (bu yalnız daraltır).
 */
export async function toggleRolePageAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const actor = await requireAdmin();
  return attempt(async () => {
    const role = str(fd, "role") as Role;
    const pathPrefix = str(fd, "pathPrefix");
    const visible = str(fd, "visible") === "1"; // formdan gelen: hedef görünürlük
    if (!ROLES.includes(role) || !pathPrefix.startsWith("/")) return { ok: false, error: "Geçersiz istek." };
    if (visible) {
      // Görünür = kısıtlamayı kaldır.
      await clearPagePermission("ROLE", role, pathPrefix);
    } else {
      await setPagePermission({ scopeType: "ROLE", scopeId: role, pathPrefix, allowed: false, updatedByUserId: actor.userId });
    }
    await audit.append({ actor: toAuditActor(actor), action: "PAGE_PERMISSION_SET", entityType: "PagePermission", entityId: `ROLE:${role}:${pathPrefix}`, data: { visible } });
    revalidateAll();
    return { ok: true, message: visible ? "Sayfa açıldı." : "Sayfa gizlendi." };
  });
}

/** Kişiye özel istisna: bir kullanıcıya bir sayfayı aç (allowed=true) veya kısıtı kaldır. */
export async function setUserPageAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const actor = await requireAdmin();
  return attempt(async () => {
    const userId = str(fd, "userId");
    const pathPrefix = str(fd, "pathPrefix");
    const mode = str(fd, "mode"); // "open" | "hide" | "clear"
    if (!userId || !pathPrefix.startsWith("/")) return { ok: false, error: "Geçersiz istek." };
    if (mode === "clear") await clearPagePermission("USER", userId, pathPrefix);
    else await setPagePermission({ scopeType: "USER", scopeId: userId, pathPrefix, allowed: mode === "open", updatedByUserId: actor.userId });
    await audit.append({ actor: toAuditActor(actor), action: "PAGE_PERMISSION_SET", entityType: "PagePermission", entityId: `USER:${userId}:${pathPrefix}`, data: { mode } });
    revalidateAll();
    return { ok: true, message: "Kişiye özel izin güncellendi." };
  });
}

