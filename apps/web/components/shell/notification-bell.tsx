import { prisma } from "@infulancer/core/db";
import { NotificationMenu } from "./notification-menu";

const dtf = new Intl.DateTimeFormat("tr-TR", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Istanbul",
});

/** Sunucuda okunmamış sayısını ve son bildirimleri çeker. */
export async function NotificationBell({ userId }: { userId: string }) {
  const [unread, latest] = await Promise.all([
    prisma.notification.count({ where: { userId, readAt: null } }),
    prisma.notification.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 12 }),
  ]);
  return (
    <NotificationMenu
      unread={unread}
      items={latest.map((n) => ({
        id: n.id,
        title: n.title,
        body: n.body,
        href: n.href,
        read: n.readAt !== null,
        createdAtLabel: dtf.format(n.createdAt),
      }))}
    />
  );
}
