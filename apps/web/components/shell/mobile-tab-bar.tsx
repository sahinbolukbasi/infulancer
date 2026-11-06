"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Role } from "@infulancer/core/enums";
import { cn } from "@/lib/cn";
import { isActive, navByRole } from "./nav";
import { isPathHidden } from "@infulancer/core/access/page-visibility";
import type { PermCtx } from "./sidebar";

/** Mobilde (< md) kenar çubuğunun yerini alan alt sekme çubuğu. */
export function MobileTabBar({ role, perm }: { role: Role; perm?: PermCtx }) {
  const pathname = usePathname();
  // Admin'de öğe çok: alt çubukta ilk 5, gerisi kenar çubuğu/arama ile.
  const items = navByRole[role].filter((i) => !perm?.perms.length || !isPathHidden(perm.perms, perm.role, perm.userId, i.href)).slice(0, 5);
  return (
    <nav
      aria-label="Alt gezinme"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-bg pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="flex">
        {items.map((item) => {
          const active = isActive(pathname, item);
          const Icon = item.icon;
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-16 flex-col items-center justify-center gap-1 text-[11px] transition-standard",
                  active ? "text-fg" : "text-fg-passive hover:text-fg-muted",
                )}
              >
                <Icon size={20} />
                <span className="max-w-full truncate px-1">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
