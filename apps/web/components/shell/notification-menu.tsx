"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import { BellIcon } from "@/components/icons";
import { markNotificationsRead } from "@/lib/actions/notifications";
import { useDismiss } from "@/lib/use-dismiss";
import { cn } from "@/lib/cn";

export type NotificationItem = {
  id: string;
  title: string;
  body: string;
  href: string | null;
  read: boolean;
  createdAtLabel: string;
};

export function NotificationMenu({ unread, items }: { unread: number; items: NotificationItem[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(ref, open, close);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={unread > 0 ? `Bildirimler, ${unread} okunmamış` : "Bildirimler"}
        onClick={() => setOpen((o) => !o)}
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-[8px] text-fg-muted transition-standard hover:bg-surface-hover hover:text-fg"
      >
        <BellIcon size={20} />
        {unread > 0 ? (
          <span
            aria-hidden
            className="absolute top-1 right-1 min-w-4 rounded-full bg-fg px-1 text-[10px] leading-4 font-semibold text-bg tabular-nums"
          >
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </button>
      {open ? (
        <div
          role="dialog"
          aria-label="Bildirimler"
          className="animate-modal-in absolute right-0 z-40 mt-2 w-[min(360px,calc(100vw-32px))] rounded-[8px] border border-border bg-surface"
        >
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <span className="text-label text-fg-muted">Bildirimler</span>
            {unread > 0 ? (
              <form action={markNotificationsRead}>
                <button type="submit" className="text-[13px] text-fg-muted transition-standard hover:text-fg">
                  Tümünü okundu say
                </button>
              </form>
            ) : null}
          </div>
          {items.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-fg-passive">Yeni bildirim yok.</p>
          ) : (
            <ul className="max-h-96 overflow-y-auto">
              {items.map((n) => (
                <li key={n.id} className="border-b border-border last:border-b-0">
                  <div className="flex gap-3 px-4 py-3 transition-standard hover:bg-surface-hover">
                    <span
                      aria-hidden
                      className={cn("mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full", n.read ? "bg-transparent" : "bg-fg")}
                    />
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      {n.href ? (
                        <Link href={n.href} onClick={close} className="text-sm text-fg hover:underline">
                          {n.title}
                        </Link>
                      ) : (
                        <span className="text-sm text-fg">{n.title}</span>
                      )}
                      <span className="text-[13px] text-fg-muted">{n.body}</span>
                      <span className="text-[12px] text-fg-passive">
                        {n.createdAtLabel}
                        {n.read ? null : <span className="sr-only"> · okunmamış</span>}
                      </span>
                    </div>
                    {n.read ? null : (
                      <form action={markNotificationsRead}>
                        <input type="hidden" name="id" value={n.id} />
                        <button type="submit" className="text-[12px] text-fg-passive transition-standard hover:text-fg" aria-label={`${n.title} bildirimini okundu say`}>
                          Okundu
                        </button>
                      </form>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
