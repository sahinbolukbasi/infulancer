"use client";

import { useTT } from "@/lib/i18n/tt-client";
import { useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import type { DeliverableStatus, Platform } from "@infulancer/core/enums";
import { PlatformIcon } from "@/components/platform-icon";
import { Button, Input } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { StatusDot } from "@/components/ui/status";
import { rescheduleDeliverable } from "@/lib/actions/deliverables";
import { cn } from "@/lib/cn";
import { deliverableTone } from "@/lib/status-tone";
import { fmtDayLabel } from "@/lib/time";

export type CalendarCard = {
  id: string;
  /** Influencer kitlesinin saat dilimindeki gün (YYYY-MM-DD) ve saat (HH:mm). */
  day: string;
  time: string;
  platform: Platform;
  platformLabel: string;
  contentLabel: string;
  status: DeliverableStatus;
  statusLabel: string;
  campaignName: string;
  href: string;
  /** Yayınlanmış/iptal işler taşınamaz. */
  locked: boolean;
  overdue?: boolean;
  violation?: boolean;
};

export type CalendarRow = { id: string; name: string; tz: string; tzLabel?: string; cards: CalendarCard[] };

type Override = Record<string, { day: string; time: string }>;

/**
 * Haftalık takvim: satırlar influencer, kolonlar gün. editable=true iken kartlar
 * aynı satırda başka güne sürüklenir (saat korunur), saate tıklayınca saat değişir.
 * Klavye: kart tutamacına odaklanıp Boşluk ile al, ok tuşlarıyla taşı, Boşluk ile bırak.
 */
export function WeekCalendar({
  days,
  rows,
  today,
  editable = false,
  emptyText = "Bu hafta planlanmış paylaşım yok.",
}: {
  days: string[];
  rows: CalendarRow[];
  today?: string;
  editable?: boolean;
  emptyText?: string;
}) {
  const tt = useTT();
  const [override, setOverride] = useState<Override>({});
  const [activeId, setActiveId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [timeCard, setTimeCard] = useState<CalendarCard | null>(null);
  const [isPending, startTransition] = useTransition();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );

  const view = (card: CalendarCard): CalendarCard => ({ ...card, ...(override[card.id] ?? {}) });
  const allCards = rows.flatMap((r) => r.cards.map((c) => ({ card: view(c), rowId: r.id })));
  const active = allCards.find((c) => c.card.id === activeId);

  const move = (card: CalendarCard, day: string, time: string) => {
    if (card.day === day && card.time === time) return;
    setOverride((o) => ({ ...o, [card.id]: { day, time } }));
    setMessage(null);
    startTransition(async () => {
      const res = await rescheduleDeliverable({ deliverableId: card.id, day, time });
      setOverride((o) => {
        const next = { ...o };
        delete next[card.id];
        return next;
      });
      setMessage(res.error ? { text: res.error, error: true } : { text: res.message ?? "Kaydedildi.", error: false });
    });
  };

  const onDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id));
  const onDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const from = allCards.find((c) => c.card.id === e.active.id);
    const over = e.over?.data.current as { rowId: string; day: string } | undefined;
    if (!from || !over) return;
    if (over.rowId !== from.rowId) {
      setMessage({ text: "Kart yalnız aynı influencer satırında taşınabilir.", error: true });
      return;
    }
    move(from.card, over.day, from.card.time);
  };

  if (rows.length === 0) {
    return <p className="rounded-[8px] border border-border px-6 py-10 text-center text-sm text-fg-passive">{emptyText}</p>;
  }

  const grid = (
    <div className="overflow-x-auto rounded-[8px] border border-border">
      <div role="grid" aria-label={tt("Haftalık paylaşım takvimi")} className="grid min-w-[1020px] grid-cols-[180px_repeat(7,minmax(118px,1fr))]">
        <div role="row" className="contents">
          <div role="columnheader" className="sticky left-0 z-10 border-b border-border bg-surface px-4 py-3 text-label text-fg-muted">{tt("Influencer")}</div>
          {days.map((d) => (
            <div
              key={d}
              role="columnheader"
              className={cn("border-b border-l border-border bg-surface px-3 py-3 text-label", d === today ? "text-fg" : "text-fg-muted")}
            >
              {fmtDayLabel(d)}
              {d === today ? <span className="sr-only">{" "}{tt("(bugün)")}</span> : null}
            </div>
          ))}
        </div>
        {rows.map((row) => (
          <div role="row" key={row.id} className="contents">
            <div role="rowheader" className="sticky left-0 z-10 flex flex-col justify-center border-b border-border bg-bg px-4 py-3">
              <span className="truncate text-sm text-fg">{row.name}</span>
              {row.tzLabel ? <span className="text-[12px] text-fg-passive">{row.tzLabel}</span> : null}
            </div>
            {days.map((day) => (
              <DayCell key={day} rowId={row.id} day={day} editable={editable} dragging={!!active} sameRow={active?.rowId === row.id}>
                {row.cards
                  .map(view)
                  .filter((c) => c.day === day)
                  .sort((a, b) => a.time.localeCompare(b.time))
                  .map((c) =>
                    editable ? (
                      <DraggableCard key={c.id} card={c} rowId={row.id} hidden={c.id === activeId} onTime={() => setTimeCard(c)} />
                    ) : (
                      <CardBody key={c.id} card={c} />
                    ),
                  )}
              </DayCell>
            ))}
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-3">
      {editable ? (
        <DndContext
          id="week-calendar"
          sensors={sensors}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onDragCancel={() => setActiveId(null)}
          accessibility={{
            screenReaderInstructions: {
              draggable: "Taşımak için Boşluk'a basın, ok tuşlarıyla güne götürün, bırakmak için tekrar Boşluk'a basın. İptal için Esc.",
            },
            announcements: {
              onDragStart: () => "Kart alındı.",
              onDragOver: ({ over }) => (over ? `${fmtDayLabel(String((over.data.current as { day?: string })?.day ?? ""))} üzerinde.` : "Bırakılabilir alan dışında."),
              onDragEnd: ({ over }) => (over ? "Kart bırakıldı." : "Kart yerine döndü."),
              onDragCancel: () => "Taşıma iptal edildi.",
            },
          }}
        >
          {grid}
          <DragOverlay dropAnimation={{ duration: 200, easing: "cubic-bezier(0.4, 0, 0.2, 1)" }}>
            {active ? (
              <div className="motion-safe:rotate-2 motion-safe:scale-[1.03]">
                <CardBody card={active.card} lifted />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      ) : (
        grid
      )}
      <p aria-live="polite" className={cn("min-h-5 text-[13px]", message?.error ? "text-critical" : "text-fg-muted")}>
        {isPending ? tt("Kaydediliyor…") : (message?.text ?? "")}
      </p>
      {editable ? <TimeModal card={timeCard} onClose={() => setTimeCard(null)} onSave={(c, t) => move(c, c.day, t)} /> : null}
    </div>
  );
}

function DayCell({
  rowId,
  day,
  editable,
  dragging,
  sameRow,
  children,
}: {
  rowId: string;
  day: string;
  editable: boolean;
  dragging: boolean;
  sameRow: boolean;
  children: ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `${rowId}|${day}`, data: { rowId, day }, disabled: !editable });
  return (
    <div
      ref={setNodeRef}
      role="gridcell"
      className={cn(
        "flex min-h-24 flex-col gap-2 border-b border-l border-border p-2 transition-standard",
        dragging && sameRow && "border-dashed bg-surface/40",
        isOver && sameRow && "rounded-[8px] border border-dashed border-fg-muted bg-surface-hover",
      )}
    >
      {children}
    </div>
  );
}

function DraggableCard({ card, rowId, hidden, onTime }: { card: CalendarCard; rowId: string; hidden: boolean; onTime: () => void }) {
  const { setNodeRef, listeners, attributes } = useDraggable({ id: card.id, data: { rowId }, disabled: card.locked });
  return (
    <div ref={setNodeRef} className={cn(hidden && "opacity-30")}>
      <CardBody
        card={card}
        handleProps={card.locked ? undefined : { ...listeners, ...attributes, "aria-roledescription": "sürüklenebilir kart" }}
        onTime={card.locked ? undefined : onTime}
      />
    </div>
  );
}

function CardBody({
  card,
  lifted,
  handleProps,
  onTime,
}: {
  card: CalendarCard;
  lifted?: boolean;
  handleProps?: Record<string, unknown>;
  onTime?: () => void;
}) {
  const label = `${card.platformLabel} ${card.contentLabel}, ${card.time}, ${card.statusLabel}`;
  return (
    <div
      className={cn(
        "flex flex-col gap-1.5 rounded-[8px] border bg-surface p-2 text-[12px] transition-standard",
        lifted ? "border-fg-muted" : "border-border hover:border-border-strong",
      )}
    >
      <div className="flex items-center justify-between gap-1">
        {handleProps ? (
          <button
            type="button"
            {...handleProps}
            aria-label={`${label} — taşı`}
            className="flex min-w-0 cursor-grab items-center gap-1.5 text-fg active:cursor-grabbing"
          >
            <PlatformIcon platform={card.platform} size={14} />
            <span className="truncate">{card.contentLabel}</span>
          </button>
        ) : (
          <span className="flex min-w-0 items-center gap-1.5 text-fg">
            <PlatformIcon platform={card.platform} size={14} title={card.platformLabel} />
            <span className="truncate">{card.contentLabel}</span>
          </span>
        )}
        {onTime ? (
          <button
            type="button"
            onClick={onTime}
            aria-label={`Saati değiştir (${card.time})`}
            className="rounded-[4px] px-1 tabular-nums text-fg-muted transition-standard hover:bg-surface-hover hover:text-fg"
          >
            {card.time}
          </button>
        ) : (
          <span className="tabular-nums text-fg-muted">{card.time}</span>
        )}
      </div>
      <StatusDot tone={deliverableTone(card.status, { overdue: card.overdue, violation: card.violation })} className="text-[12px]">
        {card.statusLabel}
      </StatusDot>
      <Link href={card.href} className="truncate text-fg-passive transition-standard hover:text-fg" title={card.campaignName}>
        {card.campaignName}
      </Link>
    </div>
  );
}

function TimeModal({
  card,
  onClose,
  onSave,
}: {
  card: CalendarCard | null;
  onClose: () => void;
  onSave: (card: CalendarCard, time: string) => void;
}) {
  const tt = useTT();
  return (
    <Modal open={!!card} onClose={onClose} title={tt("Paylaşım saatini değiştir")} description={tt("Saat influencer kitlesinin saat diliminde girilir. Influencer'a bildirim gider.")}>
      {card ? (
        <form
          key={card.id}
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            const time = String(new FormData(e.currentTarget).get("time") ?? "");
            if (/^\d{2}:\d{2}$/.test(time)) onSave(card, time);
            onClose();
          }}
        >
          <label className="flex flex-col gap-2">
            <span className="text-label text-fg-muted">
              {fmtDayLabel(card.day)} · {card.platformLabel} {card.contentLabel}
            </span>
            <Input type="time" name="time" defaultValue={card.time} required />
          </label>
          <div className="flex gap-2">
            <Button type="submit">{tt("Kaydet")}</Button>
            <Button type="button" variant="ghost" onClick={onClose}>{tt("Vazgeç")}</Button>
          </div>
        </form>
      ) : null}
    </Modal>
  );
}

/** Mobil için liste görünümü (günlere göre gruplu). */
export function WeekAgenda({ days, cards, today }: { days: string[]; cards: CalendarCard[]; today?: string }) {
  const tt = useTT();
  const byDay = days.map((d) => ({ day: d, items: cards.filter((c) => c.day === d).sort((a, b) => a.time.localeCompare(b.time)) }));
  if (cards.length === 0) {
    return <p className="rounded-[8px] border border-border px-6 py-8 text-center text-sm text-fg-passive">{tt("Bu hafta paylaşımınız yok.")}</p>;
  }
  return (
    <ol className="flex flex-col gap-4">
      {byDay
        .filter((g) => g.items.length > 0)
        .map((g) => (
          <li key={g.day} className="flex flex-col gap-2">
            <h3 className={cn("text-label", g.day === today ? "text-fg" : "text-fg-muted")}>
              {fmtDayLabel(g.day)}
              {g.day === today ? tt(" · bugün") : ""}
            </h3>
            <ul className="flex flex-col gap-2">
              {g.items.map((c) => (
                <li key={c.id}>
                  <Link
                    href={c.href}
                    className="flex items-center justify-between gap-3 rounded-[8px] border border-border bg-surface px-4 py-3 transition-standard hover:border-border-strong"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <PlatformIcon platform={c.platform} size={16} title={c.platformLabel} />
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate text-sm text-fg">
                          {c.contentLabel} · {c.campaignName}
                        </span>
                        <StatusDot tone={deliverableTone(c.status, { overdue: c.overdue, violation: c.violation })} className="text-[12px]">
                          {c.statusLabel}
                        </StatusDot>
                      </span>
                    </span>
                    <span className="text-sm tabular-nums text-fg-muted">{c.time}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </li>
        ))}
    </ol>
  );
}
