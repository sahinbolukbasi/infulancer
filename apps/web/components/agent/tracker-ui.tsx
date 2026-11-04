"use client";
import { useState } from "react";
import { ActionForm } from "@/components/forms/action-form";
import { Field, Input, Select } from "@/components/ui/form";
import { Tooltip } from "@/components/ui/tooltip";
import { createTrackerAction, trackerOpAction } from "@/lib/actions/trackers";
import { cn } from "@/lib/cn";

export type TemplateView = { key: string; title: string; scope: "CAMPAIGN" | "INFLUENCER" | "BRAND"; summary: string; checks: string[]; defaults: Record<string, number> };
export type TargetOption = { id: string; name: string };
const SETTING_LABELS: Record<string, string> = {
  metricAfterHours: "Metrik için bekleme (saat)",
  offerDays: "Teklif yanıt süresi (gün)",
  remindHours: "Story hatırlatma (saat önce)",
  screenshotHours: "Ekran görüntüsü süresi (saat)",
  followerDropPct: "Takipçi düşüş eşiği (%)",
  minErPct: "En düşük etkileşim (%)",
  reviewDays: "Marka onay süresi (gün)",
  endingDays: "Bitiş uyarısı (gün önce)",
};
const SCOPE_LABEL = { CAMPAIGN: "Kampanya", INFLUENCER: "Influencer", BRAND: "Marka" } as const;
const TONE: Record<string, string> = { campaign: "from-neon-pink/25", story: "from-neon-violet/25", influencer: "from-neon-cyan/25", brand: "from-neon-lime/25" };

/** Şablon galerisi: karta tıkla → hedef seç → kur. `fixedTarget` verilirse (kampanya sayfası) hedef seçimi atlanır. */
export function TrackerGallery({ templates, targets, fixedTarget }: { templates: TemplateView[]; targets: Record<"CAMPAIGN" | "INFLUENCER" | "BRAND", TargetOption[]>; fixedTarget?: { scope: "CAMPAIGN" | "INFLUENCER" | "BRAND"; id: string } }) {
  const usable = fixedTarget ? templates.filter((t) => t.scope === fixedTarget.scope) : templates;
  const [open, setOpen] = useState<string | null>(null);
  const tpl = usable.find((t) => t.key === open);
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {usable.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setOpen(open === t.key ? null : t.key)}
            aria-expanded={open === t.key}
            className={cn(
              "flex flex-col gap-2 rounded-2xl border bg-gradient-to-br to-transparent p-4 text-left transition-standard",
              TONE[t.key],
              open === t.key ? "border-neon-pink ring-1 ring-neon-pink/40" : "border-line hover:border-line-strong",
            )}
          >
            <span className="flex items-center justify-between gap-2">
              <span className="font-medium">{t.title}</span>
              <span className="rounded-full bg-surface-hover px-2 py-0.5 text-[10px] uppercase tracking-wide text-fg-muted">{SCOPE_LABEL[t.scope]}</span>
            </span>
            <span className="text-[12px] text-fg-muted">{t.summary}</span>
            <span className="mt-1 text-[12px] font-medium text-fg">+ Kur</span>
          </button>
        ))}
      </div>
      {tpl ? (
        <div className="rounded-2xl border border-line bg-glass p-4">
          <ActionForm action={createTrackerAction} submitLabel={`${tpl.title} kur`} resetOnSuccess onSuccess={() => setOpen(null)} aria-label={`${tpl.title} kur`} className="gap-4">
            <input type="hidden" name="template" value={tpl.key} />
            {fixedTarget ? <input type="hidden" name="targetId" value={fixedTarget.id} /> : null}
            <ul className="flex flex-wrap gap-2 text-[12px] text-fg-muted">
              {tpl.checks.map((c) => (
                <li key={c} className="rounded-full border border-line px-2 py-0.5">
                  ✓ {c}
                </li>
              ))}
            </ul>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              {!fixedTarget ? (
                <Field label={`Takip edilecek ${SCOPE_LABEL[tpl.scope].toLocaleLowerCase("tr")}`}>
                  {(p) => (
                    <Select {...p} name="targetId" required defaultValue="">
                      <option value="" disabled>
                        Seçin
                      </option>
                      {targets[tpl.scope].map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.name}
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
              ) : null}
              {Object.entries(tpl.defaults).map(([k, v]) => (
                <Field key={k} label={SETTING_LABELS[k] ?? k}>
                  {(p) => <Input {...p} name={`s_${k}`} type="number" step="any" defaultValue={v} />}
                </Field>
              ))}
            </div>
            <fieldset className="flex flex-wrap gap-4 text-[13px] text-fg-muted">
              <legend className="mb-1 text-label">Bildirim</legend>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked readOnly disabled className="h-4 w-4" /> Ajans
              </label>
              {tpl.scope !== "INFLUENCER" ? (
                <label className="flex items-center gap-2">
                  <input type="checkbox" name="notifyBrand" className="h-4 w-4 accent-[var(--color-fg)]" /> Marka
                </label>
              ) : (
                <label className="flex items-center gap-2">
                  <input type="checkbox" name="notifyInfluencer" className="h-4 w-4 accent-[var(--color-fg)]" /> Influencer
                </label>
              )}
            </fieldset>
          </ActionForm>
        </div>
      ) : null}
    </div>
  );
}

function OpButton({ id, op, label, children, danger }: { id: string; op: "toggle" | "run" | "delete"; label: string; children: React.ReactNode; danger?: boolean }) {
  return (
    <Tooltip label={label}>
      <ActionForm action={trackerOpAction} submitLabel={String(children)} submitVariant={danger ? "ghost" : "secondary"} submitSize="sm" aria-label={label} className="gap-0">
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="op" value={op} />
      </ActionForm>
    </Tooltip>
  );
}

export type TrackerView = {
  id: string;
  name: string;
  templateTitle: string;
  targetName: string;
  enabled: boolean;
  lastRunAt: string | null;
  findings: { key: string; severity: string; title: string; detail: string; href: string }[];
};
const sevDot: Record<string, string> = { KRITIK: "bg-critical", UYARI: "bg-neon-amber", BILGI: "bg-neon-cyan" };

/** Kurulu takipçiler: durum, son bulgular, aç/kapat/çalıştır/sil. */
export function TrackerList({ trackers, emptyText }: { trackers: TrackerView[]; emptyText: string }) {
  if (trackers.length === 0) return <p className="rounded-2xl border border-dashed border-line p-6 text-center text-sm text-fg-passive">{emptyText}</p>;
  return (
    <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      {trackers.map((t) => (
        <li key={t.id} className={cn("flex flex-col gap-3 rounded-2xl border border-line bg-glass p-4", !t.enabled && "opacity-60")}>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="flex min-w-0 flex-col">
              <span className="truncate font-medium">{t.name}</span>
              <span className="text-[12px] text-fg-muted">
                {t.templateTitle} · {t.targetName} · {t.enabled ? "açık" : "durdu"}
                {t.lastRunAt ? ` · son kontrol ${t.lastRunAt}` : ""}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <OpButton id={t.id} op="run" label="Şimdi kontrol et">
                Çalıştır
              </OpButton>
              <OpButton id={t.id} op="toggle" label={t.enabled ? "Durdur" : "Aç"}>
                {t.enabled ? "Durdur" : "Aç"}
              </OpButton>
              <OpButton id={t.id} op="delete" label="Takipçiyi sil" danger>
                Sil
              </OpButton>
            </div>
          </div>
          {t.findings.length === 0 ? (
            <p className="text-[13px] text-neon-lime">✓ Sorun yok</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {t.findings.slice(0, 5).map((f) => (
                <li key={f.key}>
                  <a href={f.href} className="flex items-start gap-2 rounded-lg px-2 py-1 text-[13px] hover:bg-surface-hover">
                    <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", sevDot[f.severity] ?? "bg-fg-passive")} aria-hidden />
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate text-fg">{f.title}</span>
                      <span className="truncate text-[12px] text-fg-muted">{f.detail}</span>
                    </span>
                  </a>
                </li>
              ))}
              {t.findings.length > 5 ? <li className="px-2 text-[12px] text-fg-passive">+{t.findings.length - 5} bulgu daha</li> : null}
            </ul>
          )}
        </li>
      ))}
    </ul>
  );
}
