"use client";
import { useT } from "@/lib/i18n/client";
import { useSyncExternalStore } from "react";
import { MoonIcon, SunIcon } from "@/components/icons";
import { cn } from "@/lib/cn";
import { Tooltip } from "@/components/ui/tooltip";
import { THEME_KEY as KEY } from "@/lib/theme";

type Theme = "dark" | "light";
const listeners = new Set<() => void>();
function read(): Theme {
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}
function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
function apply(t: Theme) {
  document.documentElement.dataset.theme = t;
  try {
    localStorage.setItem(KEY, t);
  } catch {
    /* gizli sekme: yalnız bu oturum */
  }
  document.cookie = `${KEY}=${t};path=/;max-age=31536000;samesite=lax`;
  listeners.forEach((l) => l());
}

/** Açık / koyu tema düğmesi. Seçim tarayıcıda saklanır; ilk boyamadan önce kök düzendeki betik uygular. */
export function ThemeToggle({ className }: { className?: string }) {
  const t = useT();
  const theme = useSyncExternalStore(subscribe, read, () => "dark" as Theme);
  const next: Theme = theme === "light" ? "dark" : "light";
  return (
    <Tooltip label={next === "light" ? t("theme.light", "Açık tema") : t("theme.dark", "Koyu tema")} side="bottom">
    <button
      type="button"
      onClick={() => apply(next)}
      aria-label={next === "light" ? t("theme.toLight", "Açık temaya geç") : t("theme.toDark", "Koyu temaya geç")}
      className={cn(
        "inline-flex h-9 w-9 items-center justify-center rounded-full border border-line text-fg-muted transition-standard hover:border-line-strong hover:text-fg focus-visible:outline focus-visible:outline-2 focus-visible:outline-neon-pink",
        className,
      )}
    >
      {theme === "light" ? <MoonIcon size={17} /> : <SunIcon size={17} />}
    </button>
    </Tooltip>
  );
}
