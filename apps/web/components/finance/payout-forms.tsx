"use client";

import { useState } from "react";
import { ActionForm } from "@/components/forms/action-form";
import { AlertIcon } from "@/components/icons";
import { Button, Field, Input } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { addPayoutsToList, createPayoutRequest, decidePayout, markPayoutsSent } from "@/lib/actions/payouts";

const money = new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", minimumFractionDigits: 2 });
const fmt = (kurus: number) => money.format(kurus / 100);

export const TAX_WARNING = "Fatura kesemiyor — serbest meslek makbuzu / stopaj gerekir, mali müşavire danışın";

/** Vergi uyarı rozeti (kırmızı yalnız KRITIK için ayrıldığından nötr tonda). */
export function TaxWarning() {
  return (
    <span className="inline-flex items-start gap-1 rounded-[6px] border border-border-strong px-2 py-1 text-[12px] leading-snug text-fg">
      <AlertIcon size={14} className="mt-px shrink-0" aria-hidden />
      {TAX_WARNING}
    </span>
  );
}

/** Influencer: "Çekim talebi oluştur" → modal (tutar, maskeli IBAN, alt sınır). */
export function PayoutRequestButton({
  cekilebilirKurus,
  minKurus,
  maskedIban,
  holder,
}: {
  cekilebilirKurus: number;
  minKurus: number;
  maskedIban: string;
  holder: string;
}) {
  const [open, setOpen] = useState(false);
  const enough = cekilebilirKurus >= minKurus;
  return (
    <>
      <Button onClick={() => setOpen(true)} className="w-full sm:w-auto">
        Çekim talebi oluştur
      </Button>
      {!enough ? (
        <p className="text-[13px] text-fg-passive">
          Çekilebilir bakiyeniz en az {fmt(minKurus)} olduğunda talep oluşturabilirsiniz.
        </p>
      ) : null}
      <Modal open={open} onClose={() => setOpen(false)} title="Çekim talebi" description={`Çekilebilir bakiye: ${fmt(Math.max(cekilebilirKurus, 0))}`}>
        <ActionForm action={createPayoutRequest} submitLabel="Talebi gönder" resetOnSuccess onSuccess={() => setOpen(false)} aria-label="Çekim talebi">
          <Field label="Tutar (TL)" hint={`En az ${fmt(minKurus)}, en çok ${fmt(Math.max(cekilebilirKurus, 0))}.`}>
            {(p) => <Input {...p} name="amount" inputMode="decimal" autoComplete="off" placeholder="1.250,00" required />}
          </Field>
          <div className="flex flex-col gap-1 rounded-[8px] border border-border px-3 py-2 text-[13px]">
            <span className="text-fg-passive">Ödeme yapılacak hesap</span>
            <span className="font-mono text-fg">{maskedIban}</span>
            <span className="text-fg-muted">{holder}</span>
          </div>
          <p className="text-[12px] text-fg-passive">IBAN değişikliği için ajansınızla iletişime geçin. Platform ödeme talimatı üretir, transferi banka yapar.</p>
        </ActionForm>
      </Modal>
    </>
  );
}

/** Admin: talep onay / ret (+ not; ret için zorunlu). */
export function PayoutDecision({ id }: { id: string }) {
  return (
    <ActionForm action={decidePayout} aria-label="Çekim talebi kararı" className="gap-2">
      <input type="hidden" name="id" value={id} />
      <Input name="note" aria-label="Not" placeholder="Not (ret için zorunlu)" maxLength={1000} className="h-8 min-w-48" />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" name="decision" value="ONAYLA" size="sm">
          Onayla
        </Button>
        <Button type="submit" name="decision" value="REDDET" variant="secondary" size="sm">
          Reddet
        </Button>
      </div>
    </ActionForm>
  );
}

export type PayoutRow = {
  id: string;
  influencer: string;
  amountKurus: number;
  iban: string;
  holder: string;
  taxLabel: string;
  taxWarning: boolean;
  note: string | null;
  dateLabel: string;
};

function SelectionTable({
  rows,
  selected,
  toggle,
  toggleAll,
  caption,
}: {
  rows: PayoutRow[];
  selected: Set<string>;
  toggle: (id: string) => void;
  toggleAll: () => void;
  caption: string;
}) {
  const all = rows.length > 0 && rows.every((r) => selected.has(r.id));
  return (
    <div className="overflow-auto rounded-[8px] border border-border">
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="bg-surface">
          <tr className="border-b border-border text-left text-label text-fg-muted">
            <th scope="col" className="w-10 px-4 py-3">
              <input type="checkbox" checked={all} onChange={toggleAll} aria-label="Tümünü seç" className="accent-[#FAFAFA]" />
            </th>
            <th scope="col" className="px-4 py-3 font-medium">Influencer</th>
            <th scope="col" className="px-4 py-3 text-right font-medium">Tutar</th>
            <th scope="col" className="px-4 py-3 font-medium">IBAN / Hesap sahibi</th>
            <th scope="col" className="px-4 py-3 font-medium">Vergi durumu</th>
            <th scope="col" className="px-4 py-3 font-medium">Tarih</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-border align-top transition-standard last:border-b-0 hover:bg-surface-hover">
              <td className="px-4 py-3">
                <input
                  type="checkbox"
                  name="ids"
                  value={r.id}
                  checked={selected.has(r.id)}
                  onChange={() => toggle(r.id)}
                  aria-label={`${r.influencer} ${fmt(r.amountKurus)} seç`}
                  className="accent-[#FAFAFA]"
                />
              </td>
              <td className="px-4 py-3">
                <span className="flex flex-col">
                  {r.influencer}
                  {r.note ? <span className="text-[12px] text-fg-passive">{r.note}</span> : null}
                </span>
              </td>
              <td className="px-4 py-3 text-right tabular-nums">{fmt(r.amountKurus)}</td>
              <td className="px-4 py-3">
                <span className="flex flex-col">
                  <span className="font-mono text-[13px]">{r.iban}</span>
                  <span className="text-[12px] text-fg-muted">{r.holder}</span>
                </span>
              </td>
              <td className="px-4 py-3">
                <span className="flex flex-col gap-1">
                  {r.taxLabel}
                  {r.taxWarning ? <TaxWarning /> : null}
                </span>
              </td>
              <td className="px-4 py-3 text-[13px] text-fg-muted tabular-nums">{r.dateLabel}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function useSelection(rows: PayoutRow[]) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const live = new Set([...selected].filter((id) => rows.some((r) => r.id === id)));
  const total = rows.filter((r) => live.has(r.id)).reduce((s, r) => s + r.amountKurus, 0);
  return {
    selected: live,
    total,
    clear: () => setSelected(new Set()),
    toggle: (id: string) =>
      setSelected((s) => {
        const next = new Set(s);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      }),
    toggleAll: () => setSelected((s) => (rows.every((r) => s.has(r.id)) ? new Set() : new Set(rows.map((r) => r.id)))),
  };
}

/** Onaylanan talepler → "Seçilenleri listeye ekle". */
export function ApprovedPayouts({ rows }: { rows: PayoutRow[] }) {
  const sel = useSelection(rows);
  if (rows.length === 0) return <p className="text-sm text-fg-passive">Listeye alınmayı bekleyen onaylı talep yok.</p>;
  return (
    <ActionForm action={addPayoutsToList} onSuccess={sel.clear} aria-label="Ödeme listesine ekle">
      <SelectionTable rows={rows} caption="Onaylanan çekim talepleri" {...sel} />
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={sel.selected.size === 0}>
          Seçilenleri listeye ekle
        </Button>
        <span className="text-[13px] text-fg-muted tabular-nums">
          {sel.selected.size} seçili · {fmt(sel.total)}
        </span>
      </div>
    </ActionForm>
  );
}

/** Bir ödeme listesi: banka dosyası indir + onay modalıyla "Gönderildi olarak işaretle". */
export function BatchPayouts({ batchId, rows }: { batchId: string; rows: PayoutRow[] }) {
  const sel = useSelection(rows);
  const [confirming, setConfirming] = useState(false);
  const file = (format: "csv" | "xml") => `/api/finans/odeme-dosyasi?batch=${encodeURIComponent(batchId)}&format=${format}`;
  return (
    <ActionForm
      action={markPayoutsSent}
      onSuccess={() => {
        setConfirming(false);
        sel.clear();
      }}
      aria-label="Gönderildi olarak işaretle"
    >
      <SelectionTable rows={rows} caption="Ödeme listesindeki talepler" {...sel} />
      <div className="flex flex-wrap items-center gap-2">
        <a href={file("csv")} download className="inline-flex h-10 items-center rounded-[8px] border border-border px-4 text-sm transition-standard hover:border-border-strong hover:bg-surface-hover">
          Banka dosyası indir (CSV)
        </a>
        <a href={file("xml")} download className="inline-flex h-10 items-center rounded-[8px] border border-border px-4 text-sm transition-standard hover:border-border-strong hover:bg-surface-hover">
          Banka dosyası indir (XML)
        </a>
        <Button onClick={() => setConfirming(true)} disabled={sel.selected.size === 0}>
          Gönderildi olarak işaretle
        </Button>
        <span className="text-[13px] text-fg-muted tabular-nums">
          {sel.selected.size} seçili · {fmt(sel.total)}
        </span>
      </div>
      <Modal
        open={confirming}
        onClose={() => setConfirming(false)}
        title="Ödemeler gönderildi mi?"
        description={`${sel.selected.size} ödeme (${fmt(sel.total)}) gönderildi olarak işaretlenecek ve deftere ödeme kaydı yazılacak. Bu işlem geri alınamaz.`}
      >
        <p className="text-[13px] text-fg-muted">Yalnızca banka transferi gerçekleştikten sonra onaylayın. Platform para göndermez.</p>
        <div className="flex flex-wrap gap-2">
          <Button type="submit">Evet, gönderildi</Button>
          <Button variant="ghost" onClick={() => setConfirming(false)}>
            Vazgeç
          </Button>
        </div>
      </Modal>
    </ActionForm>
  );
}
