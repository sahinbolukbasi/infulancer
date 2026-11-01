"use client";

import { useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "@/lib/cn";

export type TabItem = { id: string; label: string; content: ReactNode };

/** Sekmeler: altçizgi aktif sekmeye kayarak geçer; ok tuşlarıyla gezinme. */
export function Tabs({ tabs, defaultTab, label }: { tabs: TabItem[]; defaultTab?: string; label: string }) {
  const baseId = useId();
  const [active, setActive] = useState(defaultTab ?? tabs[0]?.id ?? "");
  const listRef = useRef<HTMLDivElement>(null);
  const indicatorRef = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const list = listRef.current;
    const indicator = indicatorRef.current;
    if (!list || !indicator) return;
    const place = () => {
      const btn = list.querySelector<HTMLButtonElement>(`[data-tab="${CSS.escape(active)}"]`);
      if (!btn) return;
      indicator.style.width = `${btn.offsetWidth}px`;
      indicator.style.transform = `translateX(${btn.offsetLeft}px)`;
    };
    place();
    const ro = new ResizeObserver(place);
    ro.observe(list);
    return () => ro.disconnect();
  }, [active]);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const idx = tabs.findIndex((t) => t.id === active);
    let next = idx;
    if (e.key === "ArrowRight") next = (idx + 1) % tabs.length;
    else if (e.key === "ArrowLeft") next = (idx - 1 + tabs.length) % tabs.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = tabs.length - 1;
    else return;
    e.preventDefault();
    const id = tabs[next]?.id;
    if (!id) return;
    setActive(id);
    listRef.current?.querySelector<HTMLButtonElement>(`[data-tab="${CSS.escape(id)}"]`)?.focus();
  };

  return (
    <div className="flex flex-col gap-6">
      <div ref={listRef} role="tablist" aria-label={label} onKeyDown={onKeyDown} className="relative flex gap-6 overflow-x-auto border-b border-border">
        {tabs.map((t) => {
          const selected = t.id === active;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              data-tab={t.id}
              id={`${baseId}-tab-${t.id}`}
              aria-selected={selected}
              aria-controls={`${baseId}-panel-${t.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActive(t.id)}
              className={cn("pb-3 text-sm whitespace-nowrap transition-standard", selected ? "text-fg" : "text-fg-muted hover:text-fg")}
            >
              {t.label}
            </button>
          );
        })}
        <span ref={indicatorRef} aria-hidden className="transition-standard absolute bottom-0 left-0 h-px bg-fg" />
      </div>
      {tabs.map((t) => (
        <div
          key={t.id}
          role="tabpanel"
          id={`${baseId}-panel-${t.id}`}
          aria-labelledby={`${baseId}-tab-${t.id}`}
          hidden={t.id !== active}
          tabIndex={0}
          className="animate-enter"
        >
          {t.id === active ? t.content : null}
        </div>
      ))}
    </div>
  );
}
