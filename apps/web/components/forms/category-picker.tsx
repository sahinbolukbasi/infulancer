"use client";
import { useMemo, useState } from "react";
import type { CategoryNode } from "@infulancer/core/domain/categories";
import { cn } from "@/lib/cn";

const MAX = 8;
/**
 * Kategori seçici: önce ana kategori kutucuğu, sonra altındaki çipler. Seçilenler üstte;
 * yıldıza basınca ana kategori olur. Form alanları: categoryIds (çoklu), primaryCategoryId.
 */
export function CategoryPicker({ tree, selected = [], primaryId = null }: { tree: CategoryNode[]; selected?: string[]; primaryId?: string | null }) {
  const [ids, setIds] = useState<string[]>(selected);
  const [primary, setPrimary] = useState<string | null>(primaryId ?? selected[0] ?? null);
  const [openRoot, setOpenRoot] = useState<string | null>(() => tree.find((r) => r.id === selected[0] || r.children.some((c) => selected.includes(c.id)))?.id ?? tree[0]?.id ?? null);
  const [q, setQ] = useState("");
  const all = useMemo(() => tree.flatMap((r) => [{ id: r.id, name: r.name, root: r.id, parent: null as string | null }, ...r.children.map((c) => ({ id: c.id, name: c.name, root: r.id, parent: r.name }))]), [tree]);
  const byId = useMemo(() => new Map(all.map((c) => [c.id, c])), [all]);
  const toggle = (id: string) =>
    setIds((cur) => {
      const next = cur.includes(id) ? cur.filter((x) => x !== id) : cur.length >= MAX ? cur : [...cur, id];
      if (!next.includes(primary ?? "")) setPrimary(next[0] ?? null);
      else if (!primary && next[0]) setPrimary(next[0]);
      return next;
    });
  const needle = q.trim().toLocaleLowerCase("tr");
  const hits = needle ? all.filter((c) => c.name.toLocaleLowerCase("tr").includes(needle) || (c.parent ?? "").toLocaleLowerCase("tr").includes(needle)).slice(0, 24) : [];
  const root = tree.find((r) => r.id === openRoot);
  const countIn = (r: CategoryNode) => ids.filter((id) => byId.get(id)?.root === r.id).length;
  const chip = (on: boolean) =>
    cn(
      "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] transition-standard",
      on ? "border-transparent bg-fg text-bg" : "border-line text-fg-muted hover:border-line-strong hover:text-fg",
    );

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-1 flex w-full items-center justify-between text-sm text-fg">
        Kategoriler
        <span className="text-[12px] text-fg-passive tabular-nums">
          {ids.length}/{MAX}
        </span>
      </legend>
      {ids.map((id) => (
        <input key={id} type="hidden" name="categoryIds" value={id} />
      ))}
      <input type="hidden" name="primaryCategoryId" value={primary ?? ""} />

      {/* Seçilenler */}
      <div className="flex min-h-9 flex-wrap items-center gap-2" aria-label="Seçili kategoriler" aria-live="polite">
        {ids.length === 0 ? <span className="text-[13px] text-critical">En az bir kategori seçin.</span> : null}
        {ids.map((id) => {
          const c = byId.get(id);
          const isPrimary = primary === id;
          return (
            <span key={id} className={cn("inline-flex items-center gap-1 rounded-full border py-1 pr-1 pl-2 text-[13px]", isPrimary ? "border-neon-pink text-fg" : "border-line text-fg-muted")}>
              <button type="button" onClick={() => setPrimary(id)} aria-pressed={isPrimary} aria-label={`${c?.name}: ana kategori yap`} className={cn("text-[14px] leading-none", isPrimary ? "text-neon-pink" : "text-fg-passive hover:text-fg")}>
                {isPrimary ? "★" : "☆"}
              </button>
              {c?.parent ? <span className="text-fg-passive">{c.parent} ›</span> : null}
              {c?.name ?? id}
              <button type="button" onClick={() => toggle(id)} aria-label={`${c?.name} kaldır`} className="inline-flex h-5 w-5 items-center justify-center rounded-full text-fg-passive hover:bg-surface-hover hover:text-fg">
                ×
              </button>
            </span>
          );
        })}
      </div>

      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Kategori ara (ör. makyaj, oyun)"
        aria-label="Kategori ara"
        className="h-10 rounded-xl border border-line bg-bg px-3 text-sm text-fg placeholder:text-fg-passive focus:border-neon-pink focus:outline-none"
      />

      {needle ? (
        <div className="flex flex-wrap gap-2">
          {hits.length === 0 ? <span className="text-[13px] text-fg-passive">Eşleşen kategori yok.</span> : null}
          {hits.map((c) => (
            <button key={c.id} type="button" onClick={() => toggle(c.id)} aria-pressed={ids.includes(c.id)} className={chip(ids.includes(c.id))}>
              {c.parent ? <span className="opacity-60">{c.parent} ›</span> : null}
              {c.name}
            </button>
          ))}
        </div>
      ) : (
        <>
          {/* Ana kategoriler */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4" role="tablist" aria-label="Ana kategoriler">
            {tree.map((r) => {
              const n = countIn(r);
              const active = r.id === openRoot;
              return (
                <button
                  key={r.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setOpenRoot(r.id)}
                  className={cn(
                    "flex items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-left text-[13px] transition-standard",
                    active ? "border-neon-pink bg-surface text-fg" : "border-line text-fg-muted hover:border-line-strong hover:text-fg",
                  )}
                >
                  <span className="truncate">{r.name}</span>
                  {n ? <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-neon-pink px-1 text-[11px] font-semibold text-black">{n}</span> : null}
                </button>
              );
            })}
          </div>
          {/* Seçili ana kategorinin altları */}
          {root ? (
            <div className="flex flex-wrap gap-2 rounded-2xl border border-line bg-glass p-3" role="tabpanel" aria-label={`${root.name} alt kategorileri`}>
              <button type="button" onClick={() => toggle(root.id)} aria-pressed={ids.includes(root.id)} className={chip(ids.includes(root.id))}>
                Tümü: {root.name}
              </button>
              {root.children.map((c) => (
                <button key={c.id} type="button" onClick={() => toggle(c.id)} aria-pressed={ids.includes(c.id)} className={chip(ids.includes(c.id))}>
                  {ids.includes(c.id) ? "✓ " : ""}
                  {c.name}
                </button>
              ))}
            </div>
          ) : null}
        </>
      )}
      <p className="text-[12px] text-fg-passive">★ ana kategori: listelerde ve rakip marka kontrolünde kullanılır.</p>
    </fieldset>
  );
}
