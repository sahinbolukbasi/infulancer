"use client";
import { useState, useTransition, type DragEvent, type ReactNode } from "react";
import { ArrowDownIcon, ArrowUpIcon, EyeIcon, EyeOffIcon, GridIcon, PlusIcon, ResetIcon } from "@/components/icons";
import { Button } from "@/components/ui/form";
import { saveDashboardLayout } from "@/lib/actions/dashboard";
import type { DashboardLayout, DashboardWidgetId } from "@/lib/dashboard";
import { cn } from "@/lib/cn";

export type BoardWidget = { id: DashboardWidgetId; title: string; description: string; size: "full" | "half"; content: ReactNode };

const iconBtn =
  "inline-flex h-8 w-8 items-center justify-center rounded-[8px] text-fg-muted transition-standard hover:bg-surface-hover hover:text-fg disabled:opacity-30 disabled:hover:bg-transparent";

/**
 * Düzenlenebilir pano: "Panoyu düzenle" ile alanlar sürükle-bırak veya ok tuşlarıyla sıralanır,
 * göz ikonuyla gizlenir/geri eklenir; düzen kullanıcıya özel kaydedilir.
 */
export function DashboardBoard({ widgets, initial, defaults }: { widgets: BoardWidget[]; initial: DashboardLayout; defaults: DashboardLayout }) {
  const [layout, setLayout] = useState(initial);
  const [editing, setEditing] = useState(false);
  const [dragId, setDragId] = useState<DashboardWidgetId | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [saving, startSave] = useTransition();
  const byId = new Map(widgets.map((w) => [w.id, w]));
  const visible = layout.order.filter((id) => !layout.hidden.includes(id) && byId.has(id));
  const hidden = layout.order.filter((id) => layout.hidden.includes(id) && byId.has(id));

  const move = (id: DashboardWidgetId, dir: -1 | 1) =>
    setLayout((l) => {
      const vis = l.order.filter((x) => !l.hidden.includes(x));
      const i = vis.indexOf(id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= vis.length) return l;
      [vis[i], vis[j]] = [vis[j]!, vis[i]!];
      return { ...l, order: [...vis, ...l.order.filter((x) => l.hidden.includes(x))] };
    });
  const dropOn = (target: DashboardWidgetId) =>
    setLayout((l) => {
      if (!dragId || dragId === target) return l;
      const order = l.order.filter((x) => x !== dragId);
      order.splice(order.indexOf(target), 0, dragId);
      return { ...l, order };
    });
  const hide = (id: DashboardWidgetId) => setLayout((l) => ({ ...l, hidden: [...l.hidden, id] }));
  const show = (id: DashboardWidgetId) =>
    setLayout((l) => ({ order: [...l.order.filter((x) => x !== id && !l.hidden.includes(x)), id, ...l.order.filter((x) => x !== id && l.hidden.includes(x))], hidden: l.hidden.filter((x) => x !== id) }));

  const finish = () =>
    startSave(async () => {
      const res = await saveDashboardLayout(layout);
      setStatus(res.ok ? "Pano düzeni kaydedildi." : (res.error ?? "Kaydedilemedi."));
      if (res.ok) setEditing(false);
    });
  const cancel = () => {
    setLayout(initial);
    setEditing(false);
    setStatus(null);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <span aria-live="polite" className="mr-auto text-[13px] text-fg-passive">
          {editing ? "Alanları sürükleyin veya oklarla taşıyın; göz ikonuyla gizleyin." : status}
        </span>
        {editing ? (
          <>
            <Button variant="ghost" size="sm" onClick={() => setLayout(defaults)}>
              <ResetIcon size={14} /> Varsayılan
            </Button>
            <Button variant="secondary" size="sm" onClick={cancel} disabled={saving}>
              Vazgeç
            </Button>
            <Button size="sm" onClick={finish} disabled={saving}>
              {saving ? "Kaydediliyor…" : "Kaydet"}
            </Button>
          </>
        ) : (
          <Button variant="secondary" size="sm" onClick={() => {
              setEditing(true);
              setStatus(null);
            }}>
            <GridIcon size={14} /> Panoyu düzenle
          </Button>
        )}
      </div>

      {editing && hidden.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-[8px] border border-dashed border-border p-3">
          <span className="text-[13px] text-fg-muted">Gizli alanlar:</span>
          {hidden.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => show(id)}
              className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1 text-[13px] text-fg-muted transition-standard hover:text-fg"
            >
              <PlusIcon size={12} /> {byId.get(id)?.title}
            </button>
          ))}
        </div>
      ) : null}

      {visible.length === 0 ? (
        <p className="rounded-[8px] border border-dashed border-border p-8 text-center text-sm text-fg-passive">
          Tüm alanlar gizli. &quot;Panoyu düzenle&quot; ile alan ekleyin.
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {visible.map((id, idx) => {
          const w = byId.get(id)!;
          return (
            <section
              key={id}
              aria-label={w.title}
              draggable={editing}
              onDragStart={(e: DragEvent) => {
                setDragId(id);
                e.dataTransfer.effectAllowed = "move";
              }}
              onDragOver={(e) => editing && dragId && e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                dropOn(id);
                setDragId(null);
              }}
              onDragEnd={() => setDragId(null)}
              className={cn(
                "flex min-w-0 flex-col gap-3",
                w.size === "full" && "xl:col-span-2",
                editing && "cursor-grab rounded-[10px] border border-dashed border-border p-3",
                dragId === id && "opacity-50",
              )}
            >
              {editing ? (
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 flex-col">
                    <span className="text-sm text-fg">{w.title}</span>
                    <span className="truncate text-[12px] text-fg-passive">{w.description}</span>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button type="button" className={iconBtn} onClick={() => move(id, -1)} disabled={idx === 0} aria-label={`${w.title}: yukarı taşı`} title="Yukarı">
                      <ArrowUpIcon size={16} />
                    </button>
                    <button
                      type="button"
                      className={iconBtn}
                      onClick={() => move(id, 1)}
                      disabled={idx === visible.length - 1}
                      aria-label={`${w.title}: aşağı taşı`}
                      title="Aşağı"
                    >
                      <ArrowDownIcon size={16} />
                    </button>
                    <button type="button" className={iconBtn} onClick={() => hide(id)} aria-label={`${w.title}: gizle`} title="Gizle">
                      <EyeOffIcon size={16} />
                    </button>
                  </div>
                </div>
              ) : null}
              <div className={cn(editing && "pointer-events-none select-none opacity-80")} inert={editing}>
                {w.content}
              </div>
            </section>
          );
        })}
      </div>
      {editing ? (
        <p className="flex items-center gap-1 text-[12px] text-fg-passive">
          <EyeIcon size={12} /> Düzen yalnız sizin hesabınız için kaydedilir.
        </p>
      ) : null}
    </div>
  );
}
