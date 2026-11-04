"use server";
import { z } from "zod";
import { audit } from "@infulancer/core/audit";
import { toAuditActor } from "@infulancer/core/access/actor";
import { prisma } from "@infulancer/core/db";
import { syncInfluencer, syncSocialAccount } from "@infulancer/core/social/sync";
import type { ActionState } from "@/lib/action-state";
import { attempt, parseInput, revalidateAll, str } from "@/lib/action-utils";
import { requireActor } from "@/lib/auth-guard";

const schema = z.object({
  platform: z.enum(["INSTAGRAM", "YOUTUBE"]),
  handle: z
    .string()
    .trim()
    .transform((v) => v.replace(/^https?:\/\/(www\.)?(instagram\.com|youtube\.com)\/@?/i, "").replace(/^@/, "").replace(/\/.*$/, ""))
    .pipe(z.string().regex(/^[A-Za-z0-9._-]{2,40}$/, { error: "Geçerli bir kullanıcı adı girin (ör. @kullanici)." })),
});

/**
 * Influencer kendi Instagram/YouTube kullanıcı adını ekler ya da değiştirir; hesap hemen resmî API'den
 * senkronlanır (takipçi, etkileşim, profil fotoğrafı). Instagram için hesap Business/Creator olmalı.
 */
export async function saveOwnAccountAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const actor = await requireActor("INFLUENCER");
  return attempt(async () => {
    const input = parseInput(schema, { platform: str(fd, "platform"), handle: str(fd, "handle") }, { handle: "Kullanıcı adı" });
    const influencerId = actor.influencerId!;
    const prev = await prisma.socialAccount.findUnique({ where: { influencerId_platform: { influencerId, platform: input.platform } } });
    const acc = prev
      ? await prisma.socialAccount.update({ where: { id: prev.id }, data: { handle: input.handle, syncError: null } })
      : await prisma.socialAccount.create({ data: { influencerId, platform: input.platform, handle: input.handle, followers: 0, engagementRate: 0, demographics: {} } });
    await audit.append({ actor: toAuditActor(actor), action: prev ? "SOCIAL_ACCOUNT_UPDATED" : "SOCIAL_ACCOUNT_ADDED", entityType: "SocialAccount", entityId: acc.id, data: { platform: input.platform, handle: input.handle, from: prev?.handle ?? null } });
    const r = await syncSocialAccount(acc.id).catch(() => null);
    revalidateAll();
    return r?.ok ? { ok: true, message: "Hesap bağlandı; takipçi ve profil fotoğrafı güncellendi." } : { ok: true, message: `Hesap kaydedildi. ${r?.message ?? "Otomatik güncelleme şu an kapalı."}` };
  });
}

export async function syncOwnAccountsAction(): Promise<ActionState> {
  const actor = await requireActor("INFLUENCER");
  return attempt(async () => {
    const results = await syncInfluencer(actor.influencerId!);
    revalidateAll();
    const ok = results.filter((r) => r.ok).length;
    return { ok: true, message: results.length ? `${ok}/${results.length} hesap güncellendi.` : "Güncellenecek hesap yok." };
  });
}
