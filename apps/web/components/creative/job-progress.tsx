"use client";
import { useTT } from "@/lib/i18n/tt-client";
import { useEffect, useRef, useState } from "react";
import { CheckIcon, XIcon } from "@/components/icons";
import { cn } from "@/lib/cn";
import { fmtTl } from "@/lib/creative-models";

type Step = { id: string; label: string; status: string; error: string | null; amount: number | null; charged: boolean; refunded: boolean; assetId: string | null };
type Progress = { currency?: string; done: boolean; failed: boolean; steps: Step[]; finalAssetId: string | null; chainError: string | null };
type Row = { key: string; label: string; state: "done" | "active" | "wait" | "fail"; note?: string };

/**
 * Üretim/düzenleme ilerlemesi: istek → bakiye ayrıldı → model çalışıyor (her adım) → etiketlendi.
 * Sunucudaki gerçek durumdan beslenir (/api/creative/job/[id]); satırlar okunabilsin diye en az
 * ~0,5 sn arayla açılır. Hata olursa ilgili adımın blokesi iade edilir ve bu açıkça yazılır.
 */
export function JobProgress({ jobId, onDone, className }: { jobId: string; onDone?: (assetId: string | null) => void; className?: string }) {
  const tt = useTT();
  const [p, setP] = useState<Progress | null>(null);
  const [shown, setShown] = useState(1);
  const doneRef = useRef(onDone);
  useEffect(() => {
    doneRef.current = onDone;
  }, [onDone]);
  useEffect(() => {
    let stop = false;
    let notified = false;
    const tick = async () => {
      try {
        const r = await fetch(`/api/creative/job/${jobId}`, { cache: "no-store" });
        if (r.ok) {
          const j = (await r.json()) as Progress;
          if (stop) return;
          setP(j);
          if ((j.done || j.failed) && !notified) {
            notified = true;
            setTimeout(() => doneRef.current?.(j.finalAssetId), 1200);
            return;
          }
        }
      } catch {
        /* ağ hatası: bir sonraki turda tekrar dene */
      }
      if (!stop) setTimeout(tick, 1500);
    };
    void tick();
    return () => {
      stop = true;
    };
  }, [jobId]);
  const rows: Row[] = [{ key: "istek", label: "İstek hazırlandı, içerik kuralları kontrol edildi", state: "done" }];
  if (p) {
    const first = p.steps[0];
    const total = p.steps.reduce((s, x) => s + (x.amount ?? 0), 0);
    rows.push({ key: "bakiye", label: first?.status === "REJECTED" ? "İstek kurallara takıldı" : `Bakiye ayrıldı${total ? ` · ${fmtTl(total, p.currency)}` : ""}`, state: first?.status === "REJECTED" ? "fail" : "done", note: first?.status === "REJECTED" ? (first.error ?? undefined) : undefined });
    for (const s of p.steps) {
      if (s.status === "REJECTED") continue;
      const state: Row["state"] = s.status === "COMPLETED" ? "done" : s.status === "FAILED" ? "fail" : s.status === "WAITING" ? "wait" : "active";
      rows.push({
        key: s.id,
        label: state === "active" ? `${s.label}: model çalışıyor…` : state === "wait" ? `${s.label}: sırada` : state === "fail" ? `${s.label}: başarısız` : `${s.label}: tamamlandı`,
        state,
        note: state === "fail" ? `${s.error ?? "Model hata verdi"}. Ücret alınmadı, ${s.amount ? fmtTl(s.amount, p.currency) + " " : ""}bakiyenize iade edildi.` : undefined,
      });
    }
    if (p.done) rows.push({ key: "etiket", label: "AI etiketi (C2PA) gömüldü, galeriye eklendi", state: "done" });
    if (p.chainError) rows.push({ key: "zincir", label: "Sonraki adım başlatılamadı", state: "fail", note: `${p.chainError} Başlamayan adımlar için ücret alınmadı.` });
  } else {
    rows.push({ key: "bakiye", label: "Bakiye ayrılıyor…", state: "active" });
  }
  useEffect(() => {
    if (shown >= rows.length) return;
    const t = setTimeout(() => setShown((n) => n + 1), 500);
    return () => clearTimeout(t);
  }, [shown, rows.length]);
  return (
    <ol className={cn("flex flex-col gap-2 rounded-2xl border border-line bg-bg/60 p-4", className)} aria-live="polite" aria-label={tt("İşlem adımları")}>
      {rows.slice(0, Math.max(1, shown)).map((r) => (
        <li key={r.key} className="flex items-start gap-3 text-[13px]">
          <span
            aria-hidden
            className={cn(
              "mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
              r.state === "done" && "border-emerald-500 bg-emerald-500 text-white",
              r.state === "fail" && "border-critical bg-critical text-white",
              r.state === "active" && "animate-pulse border-fg",
              r.state === "wait" && "border-line",
            )}
          >
            {r.state === "done" ? <CheckIcon size={11} /> : r.state === "fail" ? <XIcon size={11} /> : r.state === "active" ? <span className="h-1.5 w-1.5 rounded-full bg-fg" /> : null}
          </span>
          <span className="flex flex-col">
            <span className={cn(r.state === "wait" ? "text-fg-passive" : "text-fg")}>{r.label}</span>
            {r.note ? <span className="text-[12px] text-critical">{r.note}</span> : null}
          </span>
        </li>
      ))}
    </ol>
  );
}
