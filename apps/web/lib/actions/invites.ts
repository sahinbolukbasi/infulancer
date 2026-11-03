"use server";
import { redirect } from "next/navigation";
import { approveApplication, createInvite, registerWithInvite, rejectApplication, revokeInvite } from "@infulancer/core/access/invites";
import type { ActionState } from "@/lib/action-state";
import { attempt, bool, optStr, revalidateAll, str } from "@/lib/action-utils";
import { requireActor } from "@/lib/auth-guard";
import { signIn, signOut } from "@/auth";

/** Davetli kayıt (oturum gerektirmez). Başarıda kullanıcı oturum açar ve onay bekleme ekranına gider. */
export async function registerAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const email = str(fd, "email");
  const password = str(fd, "password");
  const res = await attempt(async () => {
    if (password !== str(fd, "password2")) return { error: "Şifreler eşleşmiyor." };
    const kind = str(fd, "kind") === "BRAND" ? "BRAND" : "INFLUENCER";
    const categoryIds = fd.getAll("categoryIds").map(String);
    await registerWithInvite({
      code: str(fd, "code"),
      email,
      password,
      name: str(fd, "name"),
      phone: str(fd, "phone"),
      acceptTerms: bool(fd, "acceptTerms"),
      application:
        kind === "BRAND"
          ? { kind, companyName: str(fd, "companyName"), taxOffice: str(fd, "taxOffice"), taxNumber: str(fd, "taxNumber"), categoryIds, website: optStr(fd, "website") ?? undefined, about: optStr(fd, "about") ?? undefined }
          : {
              kind,
              categoryIds,
              city: optStr(fd, "city") ?? undefined,
              instagram: optStr(fd, "instagram") ?? undefined,
              tiktok: optStr(fd, "tiktok") ?? undefined,
              youtube: optStr(fd, "youtube") ?? undefined,
              about: optStr(fd, "about") ?? undefined,
            },
    });
    return { ok: true };
  });
  if (!res.ok) return res;
  await signIn("credentials", { email, password, redirectTo: "/onay-bekliyor" });
  return res;
}

export async function signOutAction() {
  await signOut({ redirectTo: "/giris" });
}

export async function createInviteAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const actor = await requireActor("ADMIN", "INFLUENCER");
  return attempt(async () => {
    const inv = await createInvite(actor, {
      targetRole: str(fd, "targetRole") === "BRAND" ? "BRAND" : "INFLUENCER",
      maxUses: Number(str(fd, "maxUses") || "1"),
      expiresInDays: Number(str(fd, "days") || "14"),
      note: optStr(fd, "note"),
    });
    revalidateAll();
    return { ok: true, message: `Davet oluşturuldu: ${inv.code}`, data: { code: inv.code } };
  });
}

export async function revokeInviteAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const actor = await requireActor("ADMIN", "INFLUENCER");
  return attempt(async () => {
    await revokeInvite(actor, str(fd, "id"));
    revalidateAll();
    return { ok: true, message: "Davet iptal edildi." };
  });
}

export async function reviewApplicationAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const actor = await requireActor("ADMIN");
  return attempt(async () => {
    const id = str(fd, "id");
    if (str(fd, "decision") === "approve") {
      await approveApplication(actor, id, { existingBrandId: optStr(fd, "existingBrandId"), note: optStr(fd, "note") });
      revalidateAll();
      return { ok: true, message: "Başvuru onaylandı; kullanıcı panele erişebilir." };
    }
    await rejectApplication(actor, id, str(fd, "note"));
    revalidateAll();
    return { ok: true, message: "Başvuru reddedildi." };
  });
}

/** Onaylanan kullanıcı oturumu yenilemek için çıkış yapıp tekrar girer. */
export async function reloginAction() {
  await signOut({ redirectTo: "/giris?onaylandi=1" });
  redirect("/giris");
}
