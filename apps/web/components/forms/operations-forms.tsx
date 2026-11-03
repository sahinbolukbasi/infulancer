"use client";
import { useState } from "react";
import { ActionForm } from "@/components/forms/action-form";
import { Button, Field, Input, Select, Textarea } from "@/components/ui/form";
import { runAuditAgentNow } from "@/lib/actions/agents";
import { generateCreative, requestAdBudget, topUpCredits } from "@/lib/actions/operations";

type Brand = { id: string; name: string };

function BrandSelect({ brands }: { brands: Brand[] }) {
  return (
    <Field label="Marka">
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
  return (
    <ActionForm action={requestAdBudget} resetOnSuccess submitLabel="Bütçe değişikliği iste" aria-label="Bütçe değişikliği">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <BrandSelect brands={brands} />
        <Field label="Meta ad set ID">{(p) => <Input {...p} name="adSetId" inputMode="numeric" required placeholder="2385…" />}</Field>
        <Field label="Yeni günlük bütçe (TL)">{(p) => <Input {...p} name="budget" inputMode="decimal" required placeholder="1500" />}</Field>
      </div>
      <p className="text-[12px] text-fg-passive">Saatte 4 değişiklik veya aynı ad sete 30 sn içinde ikinci değişiklik limiti aşılırsa istek reddedilmez; sonraki uygun saate ötelenir.</p>
    </ActionForm>
  );
}

export type ModelOption = { key: string; label: string; unit: string; creditsPerUnit: number; maxUnits: number | null };

export function CreativeForm({ brands, models }: { brands: Brand[]; models: ModelOption[] }) {
  const [modelKey, setModelKey] = useState(models[0]?.key ?? "");
  const [units, setUnits] = useState("1");
  const m = models.find((x) => x.key === modelKey);
  const cost = m ? Math.ceil(m.creditsPerUnit * Number(units || "0") * 1000) / 1000 : 0;
  return (
    <ActionForm action={generateCreative} submitLabel="Üret" aria-label="Creative üret">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <BrandSelect brands={brands} />
        <Field label="Model (yalnız lisansı onaylı)">
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
      <Field label="Brief / prompt" hint="Gerçek bir kişinin adı, yüzü veya sesiyle üretim (md. 27/12) otomatik reddedilir.">
        {(p) => <Textarea {...p} name="prompt" rows={3} required minLength={10} placeholder="Pastel stüdyo arka planında bahar ruj serisi, üstte '%20 indirim' rozeti" />}
      </Field>
      <label className="flex items-center gap-2 text-[13px] text-fg-muted">
        <input type="checkbox" name="portrait" className="h-4 w-4 accent-[#fafafa]" />
        Referans görsel tanınabilir bir kişinin portresi
      </label>
      <p className="text-sm text-fg">Tahmini maliyet: {cost} kredi (başarısız üretimde ücret alınmaz)</p>
    </ActionForm>
  );
}

export function TopUpForm({ brands }: { brands: Brand[] }) {
  return (
    <ActionForm action={topUpCredits} resetOnSuccess submitLabel="Kredi yükle" submitSize="sm" aria-label="Kredi yükle">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <BrandSelect brands={brands} />
        <Field label="Kredi">{(p) => <Input {...p} name="credits" type="number" min={1} required defaultValue={100} />}</Field>
      </div>
    </ActionForm>
  );
}
