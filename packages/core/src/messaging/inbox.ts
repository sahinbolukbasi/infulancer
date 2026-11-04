import { prisma } from "../db";
import { getConfig } from "../config/store";
import { minutesLeft } from "./windows";

/**
 * Tenant başına shared inbox. Atama: tenant kullanıcıları arasında en az açık konuşması olana.
 * Instagram notları (UI tooltip): Requests klasöründe 30 gündür hareketsiz konuşmalar API'den dönmez;
 * klasör bilgisi mesajla gelmez; webhook/API mesajları yanıt verilene kadar IG'de okundu sayılmaz;
 * üçüncü taraf yanıtı konuşmayı General'e taşır; paylaşılan medya için yalnız URL gelir.
 */
export const instagramInboxNotes = [
  "Requests klasöründe 30 gündür hareketsiz konuşmalar API'den dönmez.",
  "Klasör (Primary/General/Requests) bilgisi mesajla birlikte gelmez.",
  "Webhook/API ile gelen mesajlar, biz yanıt verene kadar Instagram uygulamasında okundu sayılmaz.",
  "Buradan verilen yanıt konuşmayı Instagram'da General klasörüne taşır.",
  "Paylaşılan post/medya için webhook yalnızca URL verir, içeriği vermez.",
];

export async function assignConversation(tenantId: string, conversationId: string) {
  const users = await prisma.user.findMany({ where: { brandId: tenantId, role: "BRAND" }, select: { id: true } });
  const pool = users.length ? users : await prisma.user.findMany({ where: { role: { in: ["ADMIN", "AGENCY"] } }, select: { id: true } });
  if (!pool.length) return null;
  const loads = await Promise.all(
    pool.map(async (u) => ({ id: u.id, n: await prisma.conversation.count({ where: { assignedUserId: u.id, status: { in: ["assigned", "awaiting_human"] } } }) })),
  );
  loads.sort((a, b) => a.n - b.n);
  const assignee = loads[0]!.id;
  await prisma.conversation.update({ where: { id: conversationId }, data: { assignedUserId: assignee } });
  await prisma.notification.create({
    data: { userId: assignee, title: "Konuşma size atandı", body: "Bir müşteri temsilci bekliyor.", href: `/marka/gelen-kutusu/${conversationId}` },
  });
  return assignee;
}

/** Pencere kapanmaya 15 dk kala atanmış temsilciye bildirim (pencere kapanınca yanıt faturalı template gerektirir). */
export async function warnClosingWindows(now = new Date()) {
  const minutes = await getConfig("whatsapp.windowWarningMinutes");
  const soon = new Date(now.getTime() + minutes * 60_000);
  const list = await prisma.conversation.findMany({
    where: { assignedUserId: { not: null }, serviceWindowExpiresAt: { gt: now, lte: soon }, windowWarningSentAt: null, status: { not: "closed" } },
  });
  for (const c of list) {
    await prisma.notification.create({
      data: {
        userId: c.assignedUserId!,
        title: "Servis penceresi kapanıyor",
        body: `${minutesLeft(c.serviceWindowExpiresAt, now)} dk sonra pencere kapanacak; sonrasında yalnız ücretli template gönderilebilir.`,
        href: `/marka/gelen-kutusu/${c.id}`,
      },
    });
    await prisma.conversation.update({ where: { id: c.id }, data: { windowWarningSentAt: now } });
  }
  return list.length;
}

export async function listInbox(tenantId: string, filter: { status?: string; assignedUserId?: string } = {}) {
  return prisma.conversation.findMany({
    where: {
      tenantId,
      ...(filter.status ? { status: filter.status as never } : {}),
      ...(filter.assignedUserId ? { assignedUserId: filter.assignedUserId } : {}),
    },
    include: { contact: true, messages: { orderBy: { createdAt: "desc" }, take: 1 } },
    orderBy: { updatedAt: "desc" },
    take: 200,
  });
}
