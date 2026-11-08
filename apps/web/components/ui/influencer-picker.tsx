"use client";
import { useTT } from "@/lib/i18n/tt-client";
import { useMemo, useState } from "react";

export type PickItem = { id: string; name: string; category?: string | null };

/**
 * Kayıtlı içerik üreticilerinden çoklu seçim. Seçimler gizli "influencerId" inputlarına yazılır;
 * form gönderilince sunucu id listesini alır (elle ID yazmaya gerek yok).
 */
export function InfluencerPicker({ items, allLabel = "Tümünü seç" }: { items: PickItem[]; allLabel?: string }) {
  const tt = useTT();
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const n = q.trim().toLocaleLowerCase("tr");
    return n ? items.filter((i) => i.name.toLocaleLowerCase("tr").includes(n) || (i.category ?? "").toLocaleLowerCase("tr").includes(n)) : items;
  }, [items, q]);
  const toggle = (id: string) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const allFilteredSelected = filtered.length > 0 && filtered.every((i) => sel.has(i.id));

  return (
    <div className="flex flex-col gap-2">
      {[...sel].map((id) => (
        <input key={id} type="hidden" name="influencerId" value={id} />
      ))}
      <div className="flex items-center gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={tt("Ara (ad veya kategori)")} className="h-9 flex-1 rounded-[8px] border border-line bg-surface px-3 text-sm" />
        <button
          type="button"
          onClick={() => setSel((s) => { const n = new Set(s); const everyone = filtered.every((i) => n.has(i.id)); filtered.forEach((i) => (everyone ? n.delete(i.id) : n.add(i.id))); return n; })}
          className="rounded-full border border-line px-3 py-1.5 text-[12px] hover:border-neon-pink"
        >
          {allFilteredSelected ? tt("Seçimi kaldır") : allLabel}
        </button>
      </div>
      <div className="max-h-56 overflow-y-auto rounded-[8px] border border-line">
        {filtered.length === 0 ? (
          <p className="p-3 text-[13px] text-fg-passive">{tt("Eşleşen içerik üreticisi yok.")}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-line">
            {filtered.map((i) => (
              <li key={i.id}>
                <label className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm hover:bg-surface-hover">
                  <input type="checkbox" checked={sel.has(i.id)} onChange={() => toggle(i.id)} className="h-4 w-4 accent-[var(--color-fg)]" />
                  <span>{i.name}</span>
                  {i.category ? <span className="text-[12px] text-fg-passive">· {i.category}</span> : null}
                </label>
              </li>
            ))}
          </ul>
        )}
      </div>
      <span className="text-[12px] text-fg-muted">{sel.size}{" "}{tt("kişi seçildi")}</span>
    </div>
  );
}
