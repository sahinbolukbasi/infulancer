"use client";
import { useTT } from "@/lib/i18n/tt-client";
import { useState } from "react";
import { ActionForm } from "@/components/forms/action-form";
import { Button, Field, Input, Select, Textarea } from "@/components/ui/form";
import { runAuditAgentNow } from "@/lib/actions/agents";
import { generateCreative, requestAdBudget, topUpCredits } from "@/lib/actions/operations";

type Brand = { id: string; name: string };

function BrandSelect({ brands, label = "Marka" }: { brands: Brand[]; label?: string }) {
  return (
    <Field label={label}>
      {(p) => (
        <Select {...p} name="tenantId" required defaultValue={brands[0]?.id}>
          {brands.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </Select>
      )}
    </Field>
  );
}

export function RunJobButton({ job, label }: { job: string; label: string }) {
  return (
    <ActionForm action={runAuditAgentNow} aria-label={label}>
      <input type="hidden" name="job" value={job} />
      <Button type="submit" size="sm" variant="secondary">
        {label}
      </Button>
    </ActionForm>
  );
}

export function BudgetRequestForm({ brands }: { brands: Brand[] }) {
  const tt = useTT();
  return (
    <ActionForm action={requestAdBudget} resetOnSuccess submitLabel={tt("Bütçe değişikliği iste")} aria-label={tt("Bütçe değişikliği")}>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <BrandSelect brands={brands} />
        <Field label={tt("Meta ad set ID")}>{(p) => <Input {...p} name="adSetId" inputMode="numeric" required placeholder="2385…" />}</Field>
        <Field label={tt("Yeni günlük bütçe (TL)")}>{(p) => <Input {...p} name="budget" inputMode="decimal" required placeholder="1500" />}</Field>
      </div>
      <p className="text-[12px] text-fg-passive">{tt("Saatte 4 değişiklik veya aynı ad sete 30 sn içinde ikinci değişiklik limiti aşılırsa istek reddedilmez; sonraki uygun saate ötelenir.")}</p>
    </ActionForm>
  );
}

export type ModelOption = { key: string; label: string; unit: string; creditsPerUnit: number; maxUnits: number | null };

export function CreativeForm({ brands, models }: { brands: Brand[]; models: ModelOption[] }) {
  const tt = useTT();
  const [modelKey, setModelKey] = useState(models[0]?.key ?? "");
  const [units, setUnits] = useState("1");
  const m = models.find((x) => x.key === modelKey);
  const cost = m ? Math.ceil(m.creditsPerUnit * Number(units || "0") * 1000) / 1000 : 0;
  return (
    <ActionForm action={generateCreative} submitLabel={tt("Üret")} aria-label={tt("Creative üret")}>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <BrandSelect brands={brands} />
        <Field label={tt("Model (yalnız lisansı onaylı)")}>
          {(p) => (
            <Select {...p} name="modelKey" value={modelKey} onChange={(e) => setModelKey(e.target.value)}>
              {models.map((x) => (
                <option key={x.key} value={x.key}>
                  {x.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label={`Miktar (${m?.unit ?? "birim"})`} hint={m?.maxUnits ? `En fazla ${m.maxUnits}` : undefined}>
          {(p) => <Input {...p} name="units" type="number" min={1} max={m?.maxUnits ?? 100} value={units} onChange={(e) => setUnits(e.target.value)} />}
        </Field>
      </div>
      <Field label={tt("Brief / prompt")} hint={tt("Gerçek bir kişinin adı, yüzü veya sesiyle üretim (md. 27/12) otomatik reddedilir.")}>
        {(p) => <Textarea {...p} name="prompt" rows={3} required minLength={10} placeholder={tt("Pastel stüdyo arka planında bahar ruj serisi, üstte '%20 indirim' rozeti")} />}
      </Field>
      <label className="flex items-center gap-2 text-[13px] text-fg-muted">
        <input type="checkbox" name="portrait" className="h-4 w-4 accent-[var(--color-fg)]" />{tt("Referans görsel tanınabilir bir kişinin portresi")}</label>
      <p className="text-sm text-fg">{tt("Tahmini maliyet:")}{" "}{cost}{" "}{tt("TL (başarısız üretimde ücret alınmaz)")}</p>
    </ActionForm>
  );
}

export function TopUpForm({ brands, label }: { brands: Brand[]; label?: string }) {
  const tt = useTT();
  return (
    <ActionForm action={topUpCredits} resetOnSuccess submitLabel={tt("Bakiye yükle")} submitSize="sm" aria-label={tt("Bakiye yükle")}>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <BrandSelect brands={brands} label={label} />
        <Field label={tt("Tutar (TL)")}>{(p) => <Input {...p} name="credits" type="number" min={1} required defaultValue={1000} />}</Field>
      </div>
    </ActionForm>
  );
}
