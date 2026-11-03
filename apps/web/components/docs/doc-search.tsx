"use client";
import Link from "next/link";
import { useMemo, useState } from "react";

export type SearchItem = { path: string; title: string; section: string; headings: { text: string; id: string }[]; plain: string };

function norm(s: string) {
  return s.toLocaleLowerCase("tr").normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
}

/** Doküman arama: başlık, alt başlık ve metin içinde (istemci tarafı, hafif). */
export function DocSearch({ items }: { items: SearchItem[] }) {
  const [q, setQ] = useState("");
  const results = useMemo(() => {
    const t = norm(q.trim());
    if (t.length < 2) return [];
    return items
      .map((d) => {
        const title = norm(d.title).includes(t) ? 3 : 0;
        const head = d.headings.find((h) => norm(h.text).includes(t));
        const idx = norm(d.plain).indexOf(t);
        const score = title + (head ? 2 : 0) + (idx >= 0 ? 1 : 0);
        const snippet = idx >= 0 ? d.plain.slice(Math.max(0, idx - 50), idx + 90) : "";
        return { d, score, head, snippet };
      })
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);
  }, [q, items]);

  return (
    <div className="relative">
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Dokümanlarda ara (ör. 4841018, story, İYS)…"
        aria-label="Dokümanlarda ara"
        className="h-10 w-full rounded-[8px] border border-border bg-transparent px-3 text-sm"
      />
      {q.trim().length >= 2 ? (
        <div className="absolute z-20 mt-2 w-full rounded-[8px] border border-border bg-bg p-2 shadow-lg" role="listbox" aria-label="Arama sonuçları">
          {results.length === 0 ? (
            <p className="px-2 py-2 text-[13px] text-fg-passive">Sonuç yok.</p>
          ) : (
            results.map((r) => (
              <Link
                key={r.d.path}
                href={`/docs/${r.d.path}${r.head ? `#${r.head.id}` : ""}`}
                onClick={() => setQ("")}
                className="block rounded-[6px] px-2 py-2 hover:bg-surface"
              >
                <span className="block text-sm text-fg">
                  {r.d.title}
                  {r.head ? <span className="text-fg-muted"> › {r.head.text}</span> : null}
                </span>
                {r.snippet ? <span className="block truncate text-[12px] text-fg-passive">…{r.snippet}…</span> : null}
              </Link>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
