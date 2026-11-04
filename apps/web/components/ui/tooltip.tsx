import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Hızlı erişim ikonları için görünür ipucu: fareyle üzerine gelince veya klavyeyle odaklanınca
 * adı gösterir. Yalnız CSS (sunucu bileşenlerinde de çalışır); ekran okuyucu için ikonun aria-label'ı esastır.
 */
export function Tooltip({ label, children, side = "top", className }: { label: string; children: ReactNode; side?: "top" | "bottom" | "right" | "left"; className?: string }) {
  const pos = {
    top: "bottom-full left-1/2 mb-2 -translate-x-1/2",
    bottom: "top-full left-1/2 mt-2 -translate-x-1/2",
    right: "left-full top-1/2 ml-2 -translate-y-1/2",
    left: "right-full top-1/2 mr-2 -translate-y-1/2",
  }[side];
  return (
    <span className={cn("group/tt relative inline-flex", className)}>
      {children}
      <span
        role="presentation"
        aria-hidden
        className={cn(
          "pointer-events-none absolute z-50 rounded-lg border border-line bg-fg px-2 py-1 text-[12px] font-medium whitespace-nowrap text-bg opacity-0 transition-opacity duration-150 group-hover/tt:opacity-100 group-focus-within/tt:opacity-100",
          pos,
        )}
      >
        {label}
      </span>
    </span>
  );
}
