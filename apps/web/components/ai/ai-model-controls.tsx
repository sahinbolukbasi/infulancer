"use client";
import { useState, useTransition } from "react";
import { Select } from "@/components/ui/form";
import { toggleFeatureAction, updateModelAction } from "@/lib/actions/ai-models";
import { cn } from "@/lib/cn";

/** Model satırında lisans ve durum seçimi; değişince kaydeder. */
export function ModelControls({ modelKey, license, status }: { modelKey: string; license: string; status: string }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState("");
  const save = (next: { license?: string; status?: string }) =>
    start(async () => {
      const fd = new FormData();
      fd.set("key", modelKey);
      fd.set("license", next.license ?? license);
      fd.set("status", next.status ?? status);
      const r = await updateModelAction({}, fd);
      setMsg(r.ok ? "✓" : (r.error ?? "hata"));
    });
  return (
    <div className="flex items-center gap-1.5">
      <Select aria-label={`${modelKey} lisans`} defaultValue={license} disabled={pending} onChange={(e) => save({ license: e.target.value })} className="h-8 w-28 text-[12px]">
        <option value="cleared">Onaylı</option>
        <option value="pending">Beklemede</option>
        <option value="restricted">Kısıtlı</option>
      </Select>
      <Select aria-label={`${modelKey} durum`} defaultValue={status} disabled={pending} onChange={(e) => save({ status: e.target.value })} className="h-8 w-28 text-[12px]">
        <option value="active">Aktif</option>
        <option value="deprecated">Kaldırıldı</option>
      </Select>
      {msg ? <span className={cn("text-[12px]", msg === "✓" ? "text-neon-lime" : "text-critical")}>{msg}</span> : null}
    </div>
  );
}

/** Özellik bayrağı aç/kapat düğmesi. */
export function FeatureToggle({ flag, on }: { flag: string; on: boolean }) {
  const [pending, start] = useTransition();
  const [val, setVal] = useState(on);
  const toggle = () =>
    start(async () => {
      const fd = new FormData();
      fd.set("flag", flag);
      fd.set("on", (!val).toString());
      const r = await toggleFeatureAction({}, fd);
      if (r.ok) setVal(!val);
    });
  return (
    <button
      type="button"
      role="switch"
      aria-checked={val}
      onClick={toggle}
      disabled={pending}
      className={cn("relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50", val ? "bg-neon-lime" : "bg-line-strong")}
    >
      <span className={cn("inline-block h-5 w-5 transform rounded-full bg-white transition-transform", val ? "translate-x-5" : "translate-x-0.5")} />
      <span className="sr-only">{flag}</span>
    </button>
  );
}
