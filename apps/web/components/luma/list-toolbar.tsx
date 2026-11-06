"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SearchIcon, XIcon } from "@/components/icons";
import { cn } from "@/lib/cn";

export type ToolbarSelect = {
  /** URL parametre adı (ör. "marka", "tur"). */
  param: string;
  label: string;
  options: { value: string; label: string }[];
};

/**
 * Liste arama + filtre çubuğu (etkinlik ve kupon listeleri ortak kullanır).
 * Arama "ara" parametresini yazarken geciktirerek (debounce) günceller; seçmeli
 * filtreler kendi URL parametrelerini anında yazar. "filtre" (sekme) parametresi korunur.
 * Sunucu filtrelemeyi URL'den okur; bu bileşen yalnız gezinmeyi yönetir.
 */
export function ListToolbar({
  searchPlaceholder,
  selects = [],
  initialQuery = "",
  resultLabel,
}: {
  searchPlaceholder: string;
  selects?: ToolbarSelect[];
  initialQuery?: string;
  resultLabel?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [q, setQ] = useState(initialQuery);
  const first = useRef(true);

  // "ara" dışındaki mevcut parametreleri koruyarak yeni bir URL'e gider.
  const push = (mutate: (sp: URLSearchParams) => void) => {
    const sp = new URLSearchParams(params.toString());
    mutate(sp);
    const qs = sp.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  // Arama kutusu: 300 ms debounce. İlk render'da (başlangıç değeri) tetiklenmez.
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const t = setTimeout(() => {
      push((sp) => {
        const v = q.trim();
        if (v) sp.set("ara", v);
        else sp.delete("ara");
      });
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const activeSelects = selects.filter((s) => params.get(s.param));
  const hasFilters = !!q.trim() || activeSelects.length > 0;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative min-w-0 flex-1 sm:min-w-[240px]">
          <SearchIcon size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-fg-passive" aria-hidden />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            className="h-10 w-full rounded-full border border-border bg-bg pr-9 pl-9 text-sm text-fg placeholder:text-fg-passive transition-standard hover:border-border-strong focus:border-fg focus:outline-none"
          />
          {q ? (
            <button
              type="button"
              onClick={() => setQ("")}
              aria-label="Aramayı temizle"
              className="absolute top-1/2 right-2 -translate-y-1/2 inline-flex h-6 w-6 items-center justify-center rounded-full text-fg-passive hover:bg-surface-hover hover:text-fg"
            >
              <XIcon size={14} />
            </button>
          ) : null}
        </div>
        {selects.map((s) => (
          <label key={s.param} className="flex items-center gap-1.5">
            <span className="sr-only">{s.label}</span>
            <select
              value={params.get(s.param) ?? ""}
              onChange={(e) =>
                push((sp) => {
                  if (e.target.value) sp.set(s.param, e.target.value);
                  else sp.delete(s.param);
                })
              }
              className={cn(
                "h-10 appearance-none rounded-full border bg-bg pr-8 pl-3 text-sm transition-standard focus:border-fg focus:outline-none",
                params.get(s.param) ? "border-fg text-fg" : "border-border text-fg-muted hover:border-border-strong",
              )}
            >
              <option value="">{s.label}</option>
              {s.options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        ))}
        {hasFilters ? (
          <button
            type="button"
            onClick={() => {
              setQ("");
              push((sp) => {
                sp.delete("ara");
                for (const s of selects) sp.delete(s.param);
              });
            }}
            className="inline-flex h-10 items-center gap-1 rounded-full px-3 text-[13px] text-fg-muted transition-standard hover:text-fg"
          >
            <XIcon size={14} /> Temizle
          </button>
        ) : null}
      </div>
      {resultLabel ? (
        <p className="text-[13px] text-fg-passive" aria-live="polite">
          {resultLabel}
        </p>
      ) : null}
    </div>
  );
}
