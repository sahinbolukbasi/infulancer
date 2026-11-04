"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Role } from "@infulancer/core/enums";
import { PanelIcon } from "@/components/icons";
import { cn } from "@/lib/cn";
import { Tooltip } from "@/components/ui/tooltip";
import { isActive, navByRole } from "./nav";

const STORAGE_KEY = "infulancer.sidebar.collapsed";
const EVENT = "infulancer:sidebar";

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

function readCollapsed(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function setCollapsed(value: boolean) {
  try {
    window.localStorage.setItem(STORAGE_KEY, value ? "1" : "0");
  } catch {
    // localStorage kapalı olabilir; durum yalnız bu oturumda kaybolur.
  }
  window.dispatchEvent(new Event(EVENT));
}

/** Sol sabit kenar çubuğu: 240px, 64px'e daraltılabilir (durum localStorage'da). md altında gizli. */
export function Sidebar({ role }: { role: Role }) {
  const pathname = usePathname();
  const collapsed = useSyncExternalStore(subscribe, readCollapsed, () => false);
  const items = navByRole[role];

  return (
    <aside
      className={cn(
        "sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-line bg-bg/70 backdrop-blur-xl transition-standard md:flex",
        collapsed ? "w-16" : "w-60",
      )}
    >
      <div className={cn("flex h-16 items-center border-b border-border", collapsed ? "justify-center" : "justify-between px-4")}>
        {collapsed ? null : (
          <Link href={items[0]?.href ?? "/"} className="text-[15px] font-semibold tracking-tight text-fg">
            Infulancer
          </Link>
        )}
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? "Kenar çubuğunu genişlet" : "Kenar çubuğunu daralt"}
          aria-expanded={!collapsed}
          className="inline-flex h-8 w-8 items-center justify-center rounded-[8px] text-fg-muted transition-standard hover:bg-surface-hover hover:text-fg"
        >
          <PanelIcon size={18} />
        </button>
      </div>
      <nav aria-label="Ana gezinme" className="flex flex-1 flex-col gap-1 p-3">
        {items.map((item) => {
          const active = isActive(pathname, item);
          const Icon = item.icon;
          const link = (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex h-10 items-center gap-3 rounded-[8px] text-sm transition-standard",
                collapsed ? "w-10 justify-center" : "px-3",
                active ? "bg-surface text-fg shadow-[inset_2px_0_0_var(--color-neon-pink)]" : "text-fg-muted hover:bg-surface-hover hover:text-fg",
              )}
            >
              <Icon size={18} />
              <span className={collapsed ? "sr-only" : undefined}>{item.label}</span>
            </Link>
          );
          return collapsed ? (
            <Tooltip key={item.href} label={item.label} side="right" className="flex">
              {link}
            </Tooltip>
          ) : (
            link
          );
        })}
      </nav>
    </aside>
  );
}
