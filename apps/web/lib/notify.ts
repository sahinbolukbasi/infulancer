import type { Tx } from "@infulancer/core/db";

type Message = { title: string; body: string; href?: string | null };

/** Tüm admin kullanıcılarına uygulama içi bildirim. */
export async function notifyAdmins(tx: Tx, msg: Message): Promise<void> {
  const admins = await tx.user.findMany({ where: { role: "ADMIN" }, select: { id: true } });
  if (admins.length === 0) return;
  await tx.notification.createMany({
    data: admins.map((a) => ({ userId: a.id, title: msg.title, body: msg.body, href: msg.href ?? null })),
  });
}

/** Influencer'ın (varsa) kullanıcı hesabına bildirim. */
export async function notifyInfluencer(tx: Tx, influencerId: string, msg: Message): Promise<void> {
  const user = await tx.user.findUnique({ where: { influencerId }, select: { id: true } });
  if (!user) return;
  await tx.notification.create({
    data: { userId: user.id, title: msg.title, body: msg.body, href: msg.href ?? null },
  });
}
