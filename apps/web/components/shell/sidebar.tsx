"use client";

import { useTT } from "@/lib/i18n/tt-client";
import { useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Role } from "@infulancer/core/enums";
import { PanelIcon } from "@/components/icons";
import { cn } from "@/lib/cn";
import { Tooltip } from "@/components/ui/tooltip";
import { isActive, navByRole, navLabel } from "./nav";
import { useT } from "@/lib/i18n/client";
import { isPathHidden, type PagePermissionRow } from "@infulancer/core/access/page-visibility";
import type { Role as CoreRole } from "@infulancer/core/enums";
export type PermCtx = { perms: PagePermissionRow[]; role: CoreRole; userId: string };
import { BRAND_NAME } from "@/lib/brand";
import { NordvowMark } from "@/components/brand/logo";

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
export function Sidebar({ role, perm }: { role: Role; perm?: PermCtx }) {
  const tt = useTT();
  const pathname = usePathname();
  const t = useT();
  const collapsed = useSyncExternalStore(subscribe, readCollapsed, () => false);
  const items = navByRole[role].filter((i) => !perm?.perms.length || !isPathHidden(perm.perms, perm.role, perm.userId, i.href));

  return (
    <aside
      className={cn(
        "sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-line bg-bg/70 backdrop-blur-xl transition-standard md:flex",
        collapsed ? "w-16" : "w-60",
      )}
    >
      <div className={cn("flex h-16 items-center border-b border-border", collapsed ? "justify-center" : "justify-between px-4")}>
        {collapsed ? (
          <Link href={items[0]?.href ?? "/"} aria-label={BRAND_NAME} className="inline-flex">
            <NordvowMark size={26} />
          </Link>
        ) : (
          <Link href={items[0]?.href ?? "/"} className="inline-flex items-center gap-2 text-[15px] font-semibold tracking-tight text-fg">
            <NordvowMark size={24} />
            {BRAND_NAME}
          </Link>
        )}
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? tt("Kenar çubuğunu genişlet") : tt("Kenar çubuğunu daralt")}
          aria-expanded={!collapsed}
          className="inline-flex h-8 w-8 items-center justify-center rounded-[8px] text-fg-muted transition-standard hover:bg-surface-hover hover:text-fg"
        >
          <PanelIcon size={18} />
        </button>
      </div>
      <nav aria-label={tt("Ana gezinme")} className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
        {items.map((item, idx) => {
          const active = isActive(pathname, item);
          const showSection = !collapsed && item.section && item.section !== items[idx - 1]?.section;
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
              <span className={collapsed ? "sr-only" : undefined}>{navLabel(t, role, item)}</span>
            </Link>
          );
          const node = collapsed ? (
            <Tooltip key={item.href} label={navLabel(t, role, item)} side="right" className="flex">
              {link}
            </Tooltip>
          ) : (
            link
          );
          return showSection ? (
            <div key={`sec-${item.href}`} className="flex flex-col gap-1">
              <span className="px-3 pb-0.5 pt-3 text-[11px] font-medium uppercase tracking-wide text-fg-passive">{t(`section.${item.section}`, item.section!)}</span>
              {node}
            </div>
          ) : (
            node
          );
        })}
      </nav>
    </aside>
  );
}
