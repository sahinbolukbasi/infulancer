"use client";
import { useState } from "react";
import type { CategoryNode } from "@infulancer/core/domain/categories";
import { cn } from "@/lib/cn";

/**
 * Çoklu kategori seçici (ana › alt) + ana kategori seçimi. Form alanları:
 * categoryIds (çoklu), primaryCategoryId.
 */
export function CategoryPicker({ tree, selected = [], primaryId = null }: { tree: CategoryNode[]; selected?: string[]; primaryId?: string | null }) {
  const [ids, setIds] = useState<string[]>(selected);
  const [primary, setPrimary] = useState<string | null>(primaryId ?? selected[0] ?? null);
  const [filter, setFilter] = useState("");
  const all = tree.flatMap((r) => [{ id: r.id, name: r.name, parent: null as string | null }, ...r.children.map((c) => ({ id: c.id, name: c.name, parent: r.name }))]);
  const label = (id: string) => {
    const c = all.find((x) => x.id === id);
    return c ? (c.parent ? `${c.parent} › ${c.name}` : c.name) : id;
  };
  const toggle = (id: string) => {
    setIds((cur) => {
      const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id].slice(0, 8);
      if (!next.includes(primary ?? "")) setPrimary(next[0] ?? null);
      return next;
    });
  };
  const f = filter.toLocaleLowerCase("tr");
  const visible = tree
    .map((r) => ({ ...r, children: r.children.filter((c) => !f || c.name.toLocaleLowerCase("tr").includes(f) || r.name.toLocaleLowerCase("tr").includes(f)) }))
    .filter((r) => !f || r.name.toLocaleLowerCase("tr").includes(f) || r.children.length > 0);

  return (
    <fieldset className="flex flex-col gap-3 rounded-[8px] border border-border p-4">
      <legend className="px-1 text-sm text-fg">Kategoriler</legend>
      {ids.map((id) => (
        <input key={id} type="hidden" name="categoryIds" value={id} />
      ))}
      <input type="hidden" name="primaryCategoryId" value={primary ?? ""} />
      {ids.length ? (
        <div className="flex flex-wrap gap-2" aria-label="Seçili kategoriler">
          {ids.map((id) => (
            <span key={id} className={cn("inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[13px]", primary === id ? "border-fg text-fg" : "border-border text-fg-muted")}>
              <button type="button" onClick={() => setPrimary(id)} aria-pressed={primary === id} title="Ana kategori yap" className="hover:text-fg">
                {primary === id ? "★ " : ""}
                {label(id)}
              </button>
              <button type="button" onClick={() => toggle(id)} aria-label={`${label(id)} kategorisini kaldır`} className="text-fg-passive hover:text-fg">
                ×
              </button>
            </span>
          ))}
        </div>
      ) : (
        <p className="text-[13px] text-critical">En az bir kategori seçin.</p>
      )}
      <p className="text-[12px] text-fg-passive">★ ana kategori: listelerde ve marka çakışması kontrolünde kullanılır. Bir etikete tıklayarak ana yapın. En fazla 8 kategori.</p>
      <input
        type="search"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Kategori ara…"
        aria-label="Kategori ara"
        className="h-9 rounded-[8px] border border-border bg-transparent px-3 text-sm"
      />
      <div className="grid max-h-72 grid-cols-1 gap-3 overflow-y-auto pr-1 sm:grid-cols-2">
        {visible.map((r) => (
          <div key={r.id} className="flex flex-col gap-1">
            <label className="flex items-center gap-2 text-sm text-fg">
              <input type="checkbox" checked={ids.includes(r.id)} onChange={() => toggle(r.id)} className="h-4 w-4 accent-[var(--color-fg)]" />
              {r.name}
            </label>
            {r.children.map((c) => (
              <label key={c.id} className="ml-6 flex items-center gap-2 text-[13px] text-fg-muted">
                <input type="checkbox" checked={ids.includes(c.id)} onChange={() => toggle(c.id)} className="h-4 w-4 accent-[var(--color-fg)]" />
                {c.name}
              </label>
            ))}
          </div>
        ))}
      </div>
    </fieldset>
  );
}
