"use client";
import { useTT } from "@/lib/i18n/tt-client";
import { useState } from "react";
import { ActionForm } from "@/components/forms/action-form";
import { ArrowDownIcon, ArrowUpIcon, XIcon } from "@/components/icons";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { Tooltip } from "@/components/ui/tooltip";
import { addPortfolioAction, portfolioOpAction, saveShowcaseAction } from "@/lib/actions/showcase";

export function ShowcaseSettingsForm({ v }: { v: { headline: string | null; bio: string | null; showcaseVisible: boolean; showPrices: boolean; showCollaborations: boolean } }) {
  const tt = useTT();
  return (
    <ActionForm action={saveShowcaseAction} submitLabel={tt("Vitrini kaydet")} aria-label={tt("Vitrin ayarları")}>
      <Field label={tt("Başlık")} hint={tt("Markaların ilk gördüğü cümle (ör. 'Güzellik ve cilt bakımı içerikleri, 400B Instagram').")}>
        {(p) => <Input {...p} name="headline" defaultValue={v.headline ?? ""} maxLength={120} />}
      </Field>
      <Field label={tt("Hakkımda")}>{(p) => <Textarea {...p} name="bio" defaultValue={v.bio ?? ""} rows={4} maxLength={1500} />}</Field>
      <fieldset className="flex flex-col gap-2 rounded-2xl border border-line p-4 text-[14px]">
        <legend className="px-1 text-label text-fg-muted">{tt("Markalar neyi görsün?")}</legend>
        {[
          ["showcaseVisible", "Profilim 'Influencer bul' sayfasında listelensin", v.showcaseVisible],
          ["showPrices", "İçerik ücretlerim görünsün", v.showPrices],
          ["showCollaborations", "Geçmiş iş birliklerim ve ücretleri görünsün", v.showCollaborations],
        ].map(([name, label, on]) => (
          <label key={String(name)} className="flex items-center gap-3">
            <input type="checkbox" name={String(name)} defaultChecked={Boolean(on)} className="h-4 w-4 accent-[var(--color-fg)]" />
            {label}
          </label>
        ))}
      </fieldset>
    </ActionForm>
  );
}

export function AddPortfolioForm({ published }: { published: { id: string; label: string }[] }) {
  const tt = useTT();
  const [mode, setMode] = useState<"link" | "job">(published.length ? "job" : "link");
  return (
    <div className="flex flex-col gap-3">
      <div role="tablist" aria-label={tt("Ekleme yöntemi")} className="inline-flex w-fit rounded-full border border-line p-1 text-[13px]">
        {(
          [
            ["job", `Platformdaki işlerimden (${published.length})`],
            ["link", "Bağlantı ile"],
          ] as const
        ).map(([k, l]) => (
          <button key={k} type="button" role="tab" aria-selected={mode === k} onClick={() => setMode(k)} className={`rounded-full px-3 py-1 ${mode === k ? "bg-fg text-bg" : "text-fg-muted"}`}>
            {l}
          </button>
        ))}
      </div>
      {mode === "job" ? (
        published.length ? (
          <ActionForm action={addPortfolioAction} submitLabel={tt("Vitrine ekle")} submitSize="sm" aria-label={tt("İşten ekle")} className="gap-2">
            <Select name="deliverableId" aria-label={tt("İş seçin")} required>
              {published.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </Select>
          </ActionForm>
        ) : (
          <p className="text-[13px] text-fg-passive">{tt("Yayın bağlantısı girilmiş işiniz yok.")}</p>
        )
      ) : (
        <ActionForm action={addPortfolioAction} submitLabel={tt("Vitrine ekle")} submitSize="sm" resetOnSuccess aria-label={tt("Bağlantı ile ekle")} className="gap-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Field label={tt("Başlık")}>{(p) => <Input {...p} name="title" required maxLength={120} placeholder={tt("Yaz koleksiyonu Reels")} />}</Field>
            <Field label={tt("Bağlantı")}>{(p) => <Input {...p} name="url" type="url" required placeholder="https://www.instagram.com/reel/…" />}</Field>
            <Field label={tt("Marka (isteğe bağlı)")}>{(p) => <Input {...p} name="brandName" maxLength={80} />}</Field>
            <Field label={tt("Kısa not (isteğe bağlı)")}>{(p) => <Input {...p} name="note" maxLength={300} placeholder={tt("1,2M izlenme")} />}</Field>
          </div>
        </ActionForm>
      )}
    </div>
  );
}

function Op({ id, op, label, children }: { id: string; op: "up" | "down" | "delete"; label: string; children: React.ReactNode }) {
  return (
    <Tooltip label={label}>
      <form
        action={async (fd) => {
          await portfolioOpAction({}, fd);
        }}
      >
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="op" value={op} />
        <button type="submit" aria-label={label} className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-fg-muted hover:bg-surface-hover hover:text-fg">
          {children}
        </button>
      </form>
    </Tooltip>
  );
}

export function PortfolioList({ items }: { items: { id: string; title: string; url: string; platformLabel: string; brandName: string | null }[] }) {
  const tt = useTT();
  if (!items.length) return <p className="text-sm text-fg-passive">{tt("Henüz öne çıkarılan iş yok.")}</p>;
  return (
    <ol className="flex flex-col divide-y divide-line rounded-2xl border border-line">
      {items.map((it) => (
        <li key={it.id} className="flex items-center gap-3 px-4 py-2.5">
          <span className="flex min-w-0 flex-1 flex-col">
            <a href={it.url} target="_blank" rel="noopener noreferrer" className="truncate text-sm hover:underline">
              {it.title}
            </a>
            <span className="text-[12px] text-fg-muted">
              {it.platformLabel}
              {it.brandName ? ` · ${it.brandName}` : ""}
            </span>
          </span>
          <Op id={it.id} op="up" label={tt("Yukarı taşı")}>
            <ArrowUpIcon size={15} />
          </Op>
          <Op id={it.id} op="down" label={tt("Aşağı taşı")}>
            <ArrowDownIcon size={15} />
          </Op>
          <Op id={it.id} op="delete" label={tt("Vitrinden kaldır")}>
            <XIcon size={15} />
          </Op>
        </li>
      ))}
    </ol>
  );
}
