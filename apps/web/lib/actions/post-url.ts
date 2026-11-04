"use server";
import { z } from "zod";
import { audit } from "@infulancer/core/audit";
import { requireRole, toAuditActor } from "@infulancer/core/access/actor";
import { assertDeliverableAccess } from "@infulancer/core/access/ownership";
import { prisma } from "@infulancer/core/db";
import { DomainError } from "@infulancer/core/domain/errors";
import type { ActionState } from "@/lib/action-state";
import { attempt, optStr, parseInput, revalidateAll, str } from "@/lib/action-utils";
import { requireActor } from "@/lib/auth-guard";
import { notifyAdmins } from "@/lib/notify";

/** Platforma uygun paylaşım bağlantısı (Instagram / TikTok / YouTube). */
const ALLOWED = /^https:\/\/(www\.|m\.|vm\.|vt\.)?(instagram\.com|tiktok\.com|youtube\.com|youtu\.be)\/[^\s"'<>]+$/i;
function isPostUrl(v: string): boolean {
  return ALLOWED.test(v.trim());
}
const schema = z.object({
  id: z.string().min(1).max(64),
  postUrl: z
    .string()
    .trim()
    .max(1000)
    .refine(isPostUrl, { error: "Instagram, TikTok veya YouTube paylaşım bağlantısı girin (https://…)." }),
  note: z.string().max(500).nullable(),
});
const EDITABLE = new Set(["YAYINLANDI", "METRIK_BEKLIYOR", "TAMAMLANDI"]);

/**
 * Yayınlanmış işin paylaşım bağlantısını düzeltir (influencer kendi işi, admin her iş).
 * Eski ve yeni bağlantı denetim kaydına yazılır; influencer düzenlerse ajansa bildirim gider.
 */
export async function updatePostUrl(_p: ActionState, fd: FormData): Promise<ActionState> {
  const actor = requireRole(await requireActor("ADMIN", "INFLUENCER"), "ADMIN", "INFLUENCER");
  return attempt(async () => {
    const input = parseInput(schema, { id: str(fd, "id"), postUrl: str(fd, "postUrl"), note: optStr(fd, "note") }, { postUrl: "Paylaşım bağlantısı" });
    await prisma.$transaction(async (tx) => {
      await assertDeliverableAccess(tx, actor, input.id);
      const d = await tx.deliverable.findUniqueOrThrow({ where: { id: input.id }, select: { status: true, postUrl: true } });
      if (!EDITABLE.has(d.status)) throw new DomainError("KURAL_IHLALI", "Bağlantı, iş yayınlandı olarak işaretlendikten sonra düzenlenebilir.");
      if (d.postUrl === input.postUrl) throw new DomainError("DOGRULAMA", "Bağlantı değişmedi.");
      await tx.deliverable.update({ where: { id: input.id }, data: { postUrl: input.postUrl } });
      await audit.append({
        actor: toAuditActor(actor),
        action: "POST_URL_UPDATED",
        entityType: "Deliverable",
        entityId: input.id,
        data: { from: d.postUrl, to: input.postUrl, note: input.note },
      });
      if (actor.role === "INFLUENCER") {
        await notifyAdmins(tx, { title: "Paylaşım bağlantısı güncellendi", body: input.note ?? "Influencer yayın bağlantısını düzenledi.", href: `/admin/teslimler/${input.id}` });
      }
    });
    revalidateAll();
    return { ok: true, message: "Bağlantı kaydedildi." };
  });
}
