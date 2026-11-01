"use client";

import { useCallback, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowDownIcon, ArrowUpIcon, MoreHorizontalIcon } from "@/components/icons";
import { useDismiss } from "@/lib/use-dismiss";
import { cn } from "@/lib/cn";

export type DataTableColumn = {
  key: string;
  header: string;
  sortable?: boolean;
  align?: "left" | "right";
  className?: string;
};

export type DataTableCell = { display: ReactNode; sort?: string | number | null };

export type DataTableRowAction = { label: string; href: string };

export type DataTableRow = {
  id: string;
  cells: Record<string, DataTableCell | ReactNode>;
  actions?: DataTableRowAction[];
};

function isCell(v: unknown): v is DataTableCell {
  return typeof v === "object" && v !== null && "display" in v;
}

function RowMenu({ actions, label }: { actions: DataTableRowAction[]; label: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(ref, open, close);
  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${label} için işlemler`}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex h-8 w-8 items-center justify-center rounded-[8px] text-fg-muted transition-standard hover:bg-surface-hover hover:text-fg"
      >
        <MoreHorizontalIcon size={18} />
      </button>
      {open ? (
        <div
          role="menu"
          className="animate-modal-in absolute right-0 z-20 mt-1 min-w-44 rounded-[8px] border border-border bg-surface p-1"
        >
          {actions.map((a) => (
            <Link
              key={a.href + a.label}
              role="menuitem"
              href={a.href}
              onClick={close}
              className="block rounded-[6px] px-3 py-2 text-left text-sm text-fg-muted transition-standard hover:bg-surface-hover hover:text-fg"
            >
              {a.label}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Veri tablosu: sticky başlık, ince ayraçlar, zebra yok, sıralanabilir kolonlar,
 * satır sonunda açılır menü. Hücreler sunucuda render edilmiş ReactNode olabilir.
 */
export function DataTable({
  columns,
  rows,
  caption,
  emptyText = "Kayıt yok.",
  initialSort,
}: {
  columns: DataTableColumn[];
  rows: DataTableRow[];
  caption?: string;
  emptyText?: string;
  initialSort?: { key: string; dir: "asc" | "desc" };
}) {
  const [sort, setSort] = useState(initialSort ?? null);
  const hasActions = rows.some((r) => r.actions && r.actions.length > 0);

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const val = (r: DataTableRow) => {
      const c = r.cells[sort.key];
      return isCell(c) ? (c.sort ?? null) : null;
    };
    return [...rows].sort((a, b) => {
      const av = val(a);
      const bv = val(b);
      if (av === bv) return 0;
      if (av === null) return 1;
      if (bv === null) return -1;
      const cmp = typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv), "tr");
      return sort.dir === "asc" ? cmp : -cmp;
    });
  }, [rows, sort]);

  const toggle = (key: string) =>
    setSort((s) => (s?.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));

  return (
    <div className="max-h-[70vh] overflow-auto rounded-[8px] border border-border">
      <table className="w-full border-collapse text-sm">
        {caption ? <caption className="sr-only">{caption}</caption> : null}
        <thead className="sticky top-0 z-10 bg-surface">
          <tr className="border-b border-border">
            {columns.map((col) => {
              const active = sort?.key === col.key;
              const ariaSort = active ? (sort.dir === "asc" ? "ascending" : "descending") : col.sortable ? "none" : undefined;
              return (
                <th
                  key={col.key}
                  scope="col"
                  aria-sort={ariaSort}
                  className={cn("px-4 py-3 text-label font-medium text-fg-muted", col.align === "right" ? "text-right" : "text-left", col.className)}
                >
                  {col.sortable ? (
                    <button
                      type="button"
                      onClick={() => toggle(col.key)}
                      className={cn("inline-flex items-center gap-1 uppercase transition-standard hover:text-fg", active && "text-fg")}
                    >
                      {col.header}
                      {active && sort.dir === "desc" ? <ArrowDownIcon size={12} /> : <ArrowUpIcon size={12} className={active ? "" : "opacity-30"} />}
                    </button>
                  ) : (
                    col.header
                  )}
                </th>
              );
            })}
            {hasActions ? (
              <th scope="col" className="w-12 px-2">
                <span className="sr-only">İşlemler</span>
              </th>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {sorted.length === 0 ? (
            <tr>
              <td colSpan={columns.length + (hasActions ? 1 : 0)} className="px-4 py-10 text-center text-fg-passive">
                {emptyText}
              </td>
            </tr>
          ) : (
            sorted.map((row) => (
              <tr key={row.id} className="border-b border-border transition-standard last:border-b-0 hover:bg-surface-hover">
                {columns.map((col) => {
                  const c = row.cells[col.key];
                  return (
                    <td
                      key={col.key}
                      className={cn("px-4 py-3 align-middle tabular-nums", col.align === "right" ? "text-right" : "text-left", col.className)}
                    >
                      {isCell(c) ? c.display : (c as ReactNode)}
                    </td>
                  );
                })}
                {hasActions ? (
                  <td className="px-2 py-2 text-right">
                    {row.actions && row.actions.length > 0 ? <RowMenu actions={row.actions} label={row.id} /> : null}
                  </td>
                ) : null}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
