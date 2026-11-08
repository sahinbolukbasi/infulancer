"use client";
import Link from "next/link";

import { useCallback, useRef, useState } from "react";
import { ChevronDownIcon, LogoutIcon, UserIcon } from "@/components/icons";
import { signOutAction } from "@/lib/actions/auth";
import { useDismiss } from "@/lib/use-dismiss";
import { useT } from "@/lib/i18n/client";

export function AccountMenu({ name, email, roleLabel }: { name: string; email: string; roleLabel: string }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(ref, open, close);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex h-9 items-center gap-2 rounded-[8px] px-2 text-sm text-fg-muted transition-standard hover:bg-surface-hover hover:text-fg"
      >
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-border">
          <UserIcon size={16} />
        </span>
        <span className="hidden max-w-40 truncate sm:inline">{name}</span>
        <ChevronDownIcon size={14} />
      </button>
      {open ? (
        <div role="menu" className="animate-modal-in absolute right-0 z-40 mt-2 w-64 rounded-[8px] border border-border bg-surface p-1">
          <div className="flex flex-col gap-0.5 px-3 py-3">
            <span className="truncate text-sm text-fg">{name}</span>
            <span className="truncate text-[13px] text-fg-muted">{email}</span>
            <span className="mt-1 text-label text-fg-passive">{roleLabel}</span>
          </div>
          <div className="my-1 h-px bg-border" />
          <Link
            href="/profil"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex w-full items-center gap-2 rounded-[6px] px-3 py-2 text-left text-sm text-fg-muted transition-standard hover:bg-surface-hover hover:text-fg"
          >
            <UserIcon size={16} />
            {t("shell.profile", "Profilim")}
          </Link>
          <form action={signOutAction}>
            <button
              type="submit"
              role="menuitem"
              className="flex w-full items-center gap-2 rounded-[6px] px-3 py-2 text-left text-sm text-fg-muted transition-standard hover:bg-surface-hover hover:text-fg"
            >
              <LogoutIcon size={16} />
              {t("shell.logout", "Çıkış yap")}
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
