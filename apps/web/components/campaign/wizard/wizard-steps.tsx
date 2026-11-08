"use client";
import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import type { ContentType, Platform } from "@infulancer/core/enums";
import { COUNTRIES, GENDERS, OBJECTIVES, type ContentPlanItem, type DraftCheck } from "@infulancer/core/domain/campaign-plan";
import { contentTypeLabels, platformLabels } from "@infulancer/core/domain/labels";
import { platformRules } from "@infulancer/core/domain/platform-rules";
import { ActionForm, type FormAction } from "@/components/forms/action-form";
import { FileUploader } from "@/components/files/file-uploader";
import { CheckIcon, PlusIcon, SearchIcon, XIcon } from "@/components/icons";
import { PlatformIcon } from "@/components/platform-icon";
import { Avatar } from "@/components/ui/avatar";
import { Button, buttonClass, Field, Input, Select, Textarea } from "@/components/ui/form";
import {
  wizardAudienceAction,
  wizardBasicsAction,
  wizardBriefAction,
  wizardContentPlanAction,
  wizardInfluencersAction,
  wizardMediaAction,
  wizardScheduleAction,
  wizardSubmitAction,
} from "@/lib/actions/campaign-wizard";
import { cn } from "@/lib/cn";

const PLATFORMS: Platform[] = ["INSTAGRAM", "TIKTOK", "YOUTUBE"];

/**
 * Ortak adım formu: her adımın altında aynı üç eylem durur, böylece kullanıcı hangi adımda olursa
 * olsun ne yapacağını görür — "Kaydet ve devam", "Taslağı kaydet" ve "Geri".
 */
function StepForm({
  action,
  id,
  backHref,
  submitLabel = "Kaydet ve devam →",
  allowStay = true,
  label,
  children,
}: {
  action: FormAction;
  id?: string;
  backHref?: string | null;
  submitLabel?: string;
  allowStay?: boolean;
  label: string;
  children: ReactNode;
}) {
  return (
    <ActionForm
      action={action}
      aria-label={label}
      submitLabel={submitLabel}
      className="gap-6"
      footer={
        <>
          {allowStay && id ? (
            <Button type="submit" name="intent" value="stay" variant="secondary">
              Taslağı kaydet
            </Button>
          ) : null}
          {backHref ? (
            <Link href={backHref} className={cn(buttonClass("ghost"), "sm:ml-auto")}>
              ← Geri
            </Link>
          ) : null}
        </>
      }
    >
      {id ? <input type="hidden" name="id" value={id} /> : null}
      {children}
    </ActionForm>
  );
}

function Chip({ on, onClick, children, label }: { on: boolean; onClick: () => void; children: ReactNode; label?: string }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={label}
      onClick={onClick}
      className={cn(
        "inline-flex h-9 items-center gap-2 rounded-full border px-3.5 text-[13px] transition-standard",
        on ? "border-fg bg-fg text-bg" : "border-line text-fg-muted hover:border-fg/40 hover:text-fg",
      )}
    >
      {on ? <CheckIcon size={13} /> : null}
      {children}
    </button>
  );
}

// ───────────────────────── 1. Temel bilgiler ─────────────────────────
export function BasicsStep({ id, brands, values }: { id?: string; brands?: { id: string; name: string }[]; values?: { name: string; objective: string | null; description: string | null; brandId: string } }) {
  const [objective, setObjective] = useState(values?.objective ?? "bilinirlik");
  return (
    <StepForm action={wizardBasicsAction} id={id} label="Temel bilgiler" submitLabel={id ? "Kaydet ve devam →" : "Taslağı oluştur ve devam →"}>
      <input type="hidden" name="objective" value={objective} />
      {brands && !id ? (
        <Field label="Marka">
          {(p) => (
            <Select {...p} name="brandId" required defaultValue={values?.brandId ?? ""}>
              <option value="" disabled>
                Marka seçin
              </option>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
      ) : null}
      <Field label="Kampanya adı" hint="Influencerlar ve raporlar bu adı görür.">
        {(p) => <Input {...p} name="name" required minLength={3} maxLength={140} defaultValue={values?.name} placeholder="Yaz koleksiyonu lansmanı" />}
      </Field>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-label text-fg-muted">Kampanyanın amacı</legend>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4" role="radiogroup" aria-label="Kampanyanın amacı">
          {OBJECTIVES.map((o) => (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={objective === o.id}
              onClick={() => setObjective(o.id)}
              className={cn(
                "flex flex-col items-start gap-1 rounded-2xl border p-4 text-left transition-standard",
                objective === o.id ? "border-fg ring-1 ring-fg/40" : "border-line hover:border-fg/40",
              )}
            >
              <span className="text-[15px] font-semibold">{o.title}</span>
              <span className="text-[12px] text-fg-muted">{o.text}</span>
            </button>
          ))}
        </div>
        <p className="text-[12px] text-fg-passive">Amaca göre ölçülecek KPI hedefleri otomatik hazırlanır; ajans gerekirse ince ayar yapar.</p>
      </fieldset>
      <Field label="Kısa açıklama" hint="Ürün/hizmet, kampanyanın hikâyesi, beklenen sonuç.">
        {(p) => <Textarea {...p} name="description" rows={4} maxLength={4000} defaultValue={values?.description ?? ""} />}
      </Field>
    </StepForm>
  );
}

// ───────────────────────── 2. Hedef kitle ─────────────────────────
export function AudienceStep({
  id,
  backHref,
  values,
}: {
  id: string;
  backHref: string;
  values: { targetCountries: string[]; platforms: Platform[]; audienceAgeMin: number | null; audienceAgeMax: number | null; audienceGender: string | null; audienceInterests: string[] };
}) {
  const [countries, setCountries] = useState<string[]>(values.targetCountries.length ? values.targetCountries : ["TR"]);
  const [platforms, setPlatforms] = useState<Platform[]>(values.platforms.length ? values.platforms : ["INSTAGRAM"]);
  const [curNote, setCurNote] = useState<string | null>(null);
  const toggle = <T,>(arr: T[], v: T) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  return (
    <StepForm action={wizardAudienceAction} id={id} backHref={backHref} label="Hedef kitle">
      {countries.map((c) => (
        <input key={c} type="hidden" name="targetCountries" value={c} />
      ))}
      {platforms.map((p) => (
        <input key={p} type="hidden" name="platforms" value={p} />
      ))}
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-label text-fg-muted">Yayınlanacak ülkeler</legend>
        <div className="flex flex-wrap gap-2">
          {COUNTRIES.map((c) => (
            <Chip
              key={c.code}
              on={countries.includes(c.code)}
              onClick={() => {
                const cur = COUNTRIES.find((x) => x.code === countries[0])?.currency;
                // Tutarlar çevrilmez: farklı para birimli ülke seçilirse seçim o bölgeye geçer.
                if (cur && cur !== c.currency && !countries.includes(c.code)) {
                  setCountries([c.code]);
                  setCurNote(`Para birimi ${c.currency} oldu. ${cur} kullanan ülkeler için ayrı kampanya açın.`);
                } else {
                  setCountries(toggle(countries, c.code));
                  setCurNote(null);
                }
              }}
            >
              {c.name} <span className="opacity-60">{c.currency}</span>
            </Chip>
          ))}
        </div>
        {curNote ? <p role="status" className="text-[12px] text-amber-600">{curNote}</p> : null}
        <p className="text-[12px] text-fg-passive">Kampanyanın para birimi seçilen ülkelere göre belirlenir ({COUNTRIES.find((x) => x.code === countries[0])?.currency ?? "TRY"}); tutarlar çevrilmez. Yalnız bu ülkelerde kayıtlı influencerlar listelenir ve reklam ibaresi her influencer'ın ülke kuralına göre denetlenir.</p>
      </fieldset>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-label text-fg-muted">Platformlar</legend>
        <div className="flex flex-wrap gap-2">
          {PLATFORMS.map((p) => (
            <Chip key={p} on={platforms.includes(p)} onClick={() => setPlatforms(toggle(platforms, p))}>
              <PlatformIcon platform={p} size={14} /> {platformLabels[p]}
            </Chip>
          ))}
        </div>
      </fieldset>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Field label="Yaş (en küçük)">{(p) => <Input {...p} name="audienceAgeMin" type="number" min={13} max={80} defaultValue={values.audienceAgeMin ?? 18} />}</Field>
        <Field label="Yaş (en büyük)">{(p) => <Input {...p} name="audienceAgeMax" type="number" min={13} max={80} defaultValue={values.audienceAgeMax ?? 34} />}</Field>
        <Field label="Cinsiyet">
          {(p) => (
            <Select {...p} name="audienceGender" defaultValue={values.audienceGender ?? "hepsi"}>
              {GENDERS.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>
      <Field label="İlgi alanları" hint="Virgülle ayırın: güzellik, cilt bakımı, moda">
        {(p) => <Input {...p} name="audienceInterests" defaultValue={values.audienceInterests.join(", ")} />}
      </Field>
    </StepForm>
  );
}

// ───────────────────────── 3. Tarih ve bütçe ─────────────────────────
const DURATIONS = [
  { label: "2 hafta", days: 14 },
  { label: "1 ay", days: 30 },
  { label: "3 ay", days: 90 },
];
const addDays = (day: string, n: number) => new Date(Date.parse(`${day}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
export function ScheduleStep({
  id,
  backHref,
  isAdmin,
  values,
}: {
  id: string;
  backHref: string;
  isAdmin: boolean;
  values: { startsAt: string; endsAt: string; brandTotalFee: string; budget: string; currency?: string };
}) {
  const cur = !values.currency || values.currency === "TRY" ? "TL" : values.currency;
  const [startsAt, setStartsAt] = useState(values.startsAt);
  const [endsAt, setEndsAt] = useState(values.endsAt);
  const days = Math.round((Date.parse(endsAt) - Date.parse(startsAt)) / 86_400_000) + 1;
  return (
    <StepForm action={wizardScheduleAction} id={id} backHref={backHref} label="Tarih ve bütçe">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field label="Başlangıç">{(p) => <Input {...p} name="startsAt" type="date" required value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />}</Field>
        <Field label="Bitiş">{(p) => <Input {...p} name="endsAt" type="date" required min={startsAt} value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />}</Field>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {DURATIONS.map((d) => (
          <button key={d.label} type="button" onClick={() => setEndsAt(addDays(startsAt, d.days - 1))} className="rounded-full border border-line px-3 py-1 text-[12px] text-fg-muted hover:border-fg/40 hover:text-fg">
            {d.label}
          </button>
        ))}
        <span className="text-[12px] tabular-nums text-fg-passive">{days > 0 ? `${days} gün` : "Bitiş başlangıçtan önce olamaz"}</span>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field label={`Toplam bütçe (${cur})`} hint={`${isAdmin ? "Markanın ödediği toplam tutar." : "Ajansa ödeyeceğiniz toplam tutar (influencer bedelleri dahil)."} Kampanyanın para birimi hedef ülkelere göre ${values.currency ?? "TRY"}; tutarlar çevrilmez.`}>
          {(p) => <Input {...p} name="brandTotalFee" required inputMode="decimal" defaultValue={values.brandTotalFee} placeholder="250.000" />}
        </Field>
        {isAdmin ? (
          <Field label={`Influencer bütçesi (${cur})`} hint="Yalnız ajans görür; boşsa kurulumda girilir.">
            {(p) => <Input {...p} name="budget" inputMode="decimal" defaultValue={values.budget} placeholder="200.000" />}
          </Field>
        ) : null}
      </div>
    </StepForm>
  );
}

// ───────────────────────── 4. İçerik planı ─────────────────────────
export type PlanRow = { platform: Platform; contentType: ContentType; count: number; notes: string };
const PRESETS: { label: string; rows: PlanRow[] }[] = [
  { label: "1 Reels + 3 Story", rows: [{ platform: "INSTAGRAM", contentType: "REELS", count: 1, notes: "" }, { platform: "INSTAGRAM", contentType: "STORY", count: 3, notes: "" }] },
  { label: "Instagram carousel", rows: [{ platform: "INSTAGRAM", contentType: "CAROUSEL", count: 1, notes: "" }] },
  { label: "TikTok video", rows: [{ platform: "TIKTOK", contentType: "VIDEO", count: 1, notes: "" }] },
  { label: "YouTube + Shorts", rows: [{ platform: "YOUTUBE", contentType: "VIDEO", count: 1, notes: "Entegrasyon (60–90 sn)" }, { platform: "YOUTUBE", contentType: "SHORTS", count: 2, notes: "" }] },
];
/** İçerik planı satır düzenleyicisi (sihirbaz ve ajansın toplu plan formu ortak kullanır). */
export function PlanEditor({ rows, setRows, platforms }: { rows: PlanRow[]; setRows: (fn: (r: PlanRow[]) => PlanRow[]) => void; platforms: Platform[] }) {
  const first = (platforms.length ? platforms : PLATFORMS)[0]!;
  const set = (i: number, patch: Partial<PlanRow>) =>
    setRows((r) =>
      r.map((row, j) => {
        if (j !== i) return row;
        const next = { ...row, ...patch };
        if (patch.platform && !platformRules[patch.platform].contentTypes.includes(next.contentType)) next.contentType = platformRules[patch.platform].contentTypes[0]!;
        return next;
      }),
    );
  const total = rows.reduce((s, r) => s + (Number(r.count) || 0), 0);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2" aria-label="Hazır planlar">
        {PRESETS.map((p) => (
          <button key={p.label} type="button" onClick={() => setRows(() => p.rows)} className="rounded-full border border-line px-3 py-1 text-[12px] text-fg-muted hover:border-fg/40 hover:text-fg">
            {p.label}
          </button>
        ))}
      </div>
      <ul className="flex flex-col gap-3">
        {rows.map((row, i) => (
          <li key={i} className="grid grid-cols-2 gap-3 rounded-2xl border border-line p-3 md:grid-cols-[1fr_1fr_100px_1.6fr_auto] md:items-end">
            <Field label="Platform">
              {(p) => (
                <Select {...p} value={row.platform} onChange={(e) => set(i, { platform: e.target.value as Platform })}>
                  {PLATFORMS.map((pl) => (
                    <option key={pl} value={pl}>
                      {platformLabels[pl]}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="İçerik tipi">
              {(p) => (
                <Select {...p} value={row.contentType} onChange={(e) => set(i, { contentType: e.target.value as ContentType })}>
                  {platformRules[row.platform].contentTypes.map((t) => (
                    <option key={t} value={t}>
                      {contentTypeLabels[t]}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label={row.contentType === "STORY" ? "Kare" : "Adet"}>{(p) => <Input {...p} type="number" min={1} max={20} value={row.count} onChange={(e) => set(i, { count: Number(e.target.value) })} />}</Field>
            <Field label="Not">{(p) => <Input {...p} value={row.notes} maxLength={500} placeholder="ör. ürünü kullanırken, 15–30 sn" onChange={(e) => set(i, { notes: e.target.value })} />}</Field>
            <Button variant="ghost" size="sm" onClick={() => setRows((r) => r.filter((_, j) => j !== i))} aria-label={`Satır ${i + 1} sil`} disabled={rows.length === 1}>
              <XIcon size={14} />
            </Button>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="secondary" size="sm" onClick={() => setRows((r) => [...r, { platform: first, contentType: platformRules[first].contentTypes[0]!, count: 1, notes: "" }])} disabled={rows.length >= 20}>
          <PlusIcon size={14} /> Satır ekle
        </Button>
        <span className="text-[13px] tabular-nums text-fg-muted">Influencer başına {total} içerik</span>
      </div>
    </div>
  );
}
export function defaultPlanRow(platforms: Platform[]): PlanRow {
  const first = (platforms.length ? platforms : PLATFORMS)[0]!;
  return { platform: first, contentType: platformRules[first].contentTypes[0]!, count: 1, notes: "" };
}
export function ContentPlanStep({ id, backHref, plan, platforms }: { id: string; backHref: string; plan: ContentPlanItem[]; platforms: Platform[] }) {
  const [rows, setRows] = useState<PlanRow[]>(plan.length ? plan : [defaultPlanRow(platforms)]);
  return (
    <StepForm action={wizardContentPlanAction} id={id} backHref={backHref} label="İçerik planı">
      <input type="hidden" name="plan" value={JSON.stringify(rows.map((r) => ({ ...r, count: Number(r.count) || 0 })))} />
      <p className="text-[13px] text-fg-muted">Her influencer için aynı plan uygulanır; ajans bu planı seçilen tüm influencerlara tek seferde dağıtır. Story satırında adet = kare sayısı.</p>
      <PlanEditor rows={rows} setRows={setRows} platforms={platforms} />
    </StepForm>
  );
}

// ───────────────────────── 5. Brief ─────────────────────────
export function BriefStep({
  id,
  backHref,
  latest,
  advertiser,
}: {
  id: string;
  backHref: string;
  latest: { text: string; dos: string[]; donts: string[]; hashtags: string[]; mentions: string[]; disclosureRequired: boolean; version: number } | null;
  advertiser: string;
}) {
  const [dirty, setDirty] = useState(!latest);
  return (
    <StepForm action={wizardBriefAction} id={id} backHref={backHref} label="Brief">
      <input type="hidden" name="unchanged" value={dirty ? "0" : "1"} />
      <div className="contents" onChange={() => setDirty(true)}>
        {latest ? <p className="text-[12px] text-fg-passive">Son kayıt: sürüm {latest.version}. Değiştirip kaydederseniz yeni sürüm açılır.</p> : null}
        <Field label="Brief metni" hint="Ana mesaj, tonu, ürünün öne çıkan özellikleri.">
          {(p) => <Textarea {...p} name="text" rows={7} required minLength={10} defaultValue={latest?.text} />}
        </Field>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Yapılacaklar" hint="Her satıra bir madde.">
            {(p) => <Textarea {...p} name="dos" rows={4} defaultValue={latest?.dos.join("\n")} />}
          </Field>
          <Field label="Yapılmayacaklar" hint="Her satıra bir madde.">
            {(p) => <Textarea {...p} name="donts" rows={4} defaultValue={latest?.donts.join("\n")} />}
          </Field>
          <Field label="Hashtagler">{(p) => <Input {...p} name="hashtags" defaultValue={latest?.hashtags.join(" ")} placeholder="#markaadi #reklam" />}</Field>
          <Field label="Bahsetmeler">{(p) => <Input {...p} name="mentions" defaultValue={latest?.mentions.join(" ")} placeholder="@markahesabi" />}</Field>
        </div>
        <label className="flex items-start gap-2 text-sm text-fg-muted">
          <input type="checkbox" name="disclosureRequired" defaultChecked={latest?.disclosureRequired ?? true} className="mt-0.5 h-4 w-4 accent-[var(--color-fg)]" />
          <span>
            Reklam ibaresi zorunlu
            <span className="block text-[12px] text-fg-passive">Yasal zorunluluk: her içerikte “Reklam” ve {advertiser} adı görünür.</span>
          </span>
        </label>
      </div>
    </StepForm>
  );
}

// ───────────────────────── 6. Medya ─────────────────────────
export function MediaStep({ id, backHref, gallery }: { id: string; backHref: string; gallery: ReactNode }) {
  return (
    <div className="flex flex-col gap-6">
      <FileUploader
        target={{ type: "campaign", id }}
        multiple
        label="Fotoğraf veya video ekle"
        hint="Birden çok dosya seçebilirsiniz. Ürün görselleri, örnek çekimler, logo, brief PDF. Influencerlar atandıktan sonra görür."
        accept="image/*,video/*,application/pdf"
        kinds={[
          { value: "URUN_FOTO", label: "Ürün fotoğrafı" },
          { value: "ORNEK_CEKIM", label: "Örnek çekim (video/fotoğraf)" },
          { value: "MARKA_LOGO", label: "Marka logosu" },
          { value: "BRIEF_PDF", label: "Brief PDF" },
          { value: "DIGER", label: "Diğer" },
        ]}
      />
      {gallery}
      <StepForm action={wizardMediaAction} id={id} backHref={backHref} label="Medya" allowStay={false}>
        <p className="text-[12px] text-fg-passive">Dosyalar yüklendiği anda kaydedilir. Bu adım isteğe bağlıdır.</p>
      </StepForm>
    </div>
  );
}

// ───────────────────────── 7. Influencerlar (toplu) ─────────────────────────
export type WizardInfluencer = { id: string; name: string; category: string; city: string | null; avatarUrl: string | null; platforms: Platform[]; followers: number };
const compact = new Intl.NumberFormat("tr-TR", { notation: "compact", maximumFractionDigits: 1 });
export function InfluencerStep({ id, backHref, influencers, selected: initial, note }: { id: string; backHref: string; influencers: WizardInfluencer[]; selected: string[]; note: string }) {
  const [selected, setSelected] = useState<Set<string>>(new Set(initial));
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [platform, setPlatform] = useState<"" | Platform>("");
  const cats = useMemo(() => [...new Set(influencers.map((i) => i.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, "tr")), [influencers]);
  const shown = influencers.filter(
    (i) => (!q || i.name.toLocaleLowerCase("tr").includes(q.toLocaleLowerCase("tr"))) && (!cat || i.category === cat) && (!platform || i.platforms.includes(platform)),
  );
  const allShown = shown.length > 0 && shown.every((i) => selected.has(i.id));
  const toggle = (iid: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(iid)) n.delete(iid);
      else n.add(iid);
      return n;
    });
  return (
    <StepForm action={wizardInfluencersAction} id={id} backHref={backHref} label="Influencer seçimi">
      {[...selected].map((s) => (
        <input key={s} type="hidden" name="influencerIds" value={s} />
      ))}
      <p className="text-[13px] text-fg-muted">{note}</p>
      <div className="flex flex-wrap items-end gap-3">
        <label className="relative flex-1">
          <span className="sr-only">Influencer ara</span>
          <SearchIcon size={15} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-fg-passive" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="İsimle ara" className="pl-9" />
        </label>
        <Select aria-label="Kategori" value={cat} onChange={(e) => setCat(e.target.value)} className="w-auto">
          <option value="">Tüm kategoriler</option>
          {cats.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
        <Select aria-label="Platform" value={platform} onChange={(e) => setPlatform(e.target.value as Platform | "")} className="w-auto">
          <option value="">Tüm platformlar</option>
          {PLATFORMS.map((p) => (
            <option key={p} value={p}>
              {platformLabels[p]}
            </option>
          ))}
        </Select>
      </div>
      <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-fg/[0.03] px-4 py-3 text-[13px]">
        <span className="font-medium tabular-nums">{selected.size} seçili</span>
        <span className="text-fg-passive">· {shown.length} listeleniyor</span>
        <Button
          size="sm"
          variant="secondary"
          className="ml-auto"
          onClick={() =>
            setSelected((s) => {
              const n = new Set(s);
              for (const i of shown) {
                if (allShown) n.delete(i.id);
                else n.add(i.id);
              }
              return n;
            })
          }
        >
          {allShown ? "Listelenenlerin seçimini kaldır" : "Listelenenlerin tümünü seç"}
        </Button>
        {selected.size ? (
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
            Seçimi temizle
          </Button>
        ) : null}
      </div>
      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3" aria-label="Influencerlar">
        {shown.map((i) => {
          const on = selected.has(i.id);
          return (
            <li key={i.id}>
              <label className={cn("flex cursor-pointer items-center gap-3 rounded-2xl border p-3 transition-standard", on ? "border-fg bg-fg/[0.04]" : "border-line hover:border-fg/40")}>
                <input type="checkbox" checked={on} onChange={() => toggle(i.id)} className="h-4 w-4 accent-[var(--color-fg)]" aria-label={`${i.name} seç`} />
                <Avatar name={i.name} src={i.avatarUrl} size={36} />
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-[14px] font-medium">{i.name}</span>
                  <span className="truncate text-[12px] text-fg-muted">
                    {i.category}
                    {i.city ? ` · ${i.city}` : ""} · {compact.format(i.followers)} takipçi
                  </span>
                </span>
                <span className="ml-auto flex gap-1 text-fg-muted">
                  {i.platforms.map((p) => (
                    <PlatformIcon key={p} platform={p} size={13} title={platformLabels[p]} />
                  ))}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
      {shown.length === 0 ? <p className="text-[13px] text-fg-passive">Bu filtreyle influencer yok.</p> : null}
    </StepForm>
  );
}

// ───────────────────────── 8. Özet ve kaydet ─────────────────────────
export function SubmitStep({ id, backHref, checks, ready, isBrand, submittedAt, base }: { id: string; backHref: string; checks: DraftCheck[]; ready: boolean; isBrand: boolean; submittedAt: string | null; base: string }) {
  return (
    <StepForm
      action={wizardSubmitAction}
      id={id}
      backHref={backHref}
      allowStay={false}
      label="Özet ve kaydet"
      submitLabel={isBrand ? (submittedAt ? "Değişiklikleri kaydet ve ajansa gönder" : "Kampanyayı kaydet ve ajansa gönder") : "Kaydet ve kuruluma geç →"}
    >
      <ul className="flex flex-col divide-y divide-line rounded-2xl border border-line">
        {checks.map((c) => (
          <li key={c.key} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
            <span className="flex items-center gap-3">
              <span className={cn("inline-flex h-6 w-6 items-center justify-center rounded-full border", c.ok ? "border-fg bg-fg text-bg" : "border-critical text-critical")} aria-hidden>
                {c.ok ? <CheckIcon size={12} /> : "!"}
              </span>
              <span>
                <span className="text-fg">{stepTitle(c.key)}</span>
                <span className="block text-[12px] text-fg-muted">{c.note}</span>
              </span>
            </span>
            <Link href={`${base}?adim=${c.key}`} className="text-[12px] text-fg-muted underline-offset-4 hover:text-fg hover:underline">
              {c.ok ? "Düzenle" : "Tamamla"}
            </Link>
          </li>
        ))}
      </ul>
      {!ready ? <p className="text-[13px] text-critical">Kırmızı işaretli adımları tamamlayın; ardından kaydedebilirsiniz.</p> : null}
      <p className="text-[12px] text-fg-passive">
        {isBrand
          ? submittedAt
            ? `Ajansa ${submittedAt} tarihinde gönderildi. Değişiklikleri kaydedip yeniden gönderebilirsiniz.`
            : "Gönderince ajans bildirim alır: influencerları onaylar, bedelleri belirler ve yasal kontrolden sonra yayına alır."
          : "Kurulumda influencer atama, bedeller, toplu içerik planı ve yasal yayın kontrolü yapılır."}
      </p>
    </StepForm>
  );
}
const TITLES: Record<string, string> = {
  temel: "Temel bilgiler",
  kitle: "Hedef kitle",
  butce: "Tarih ve bütçe",
  icerik: "İçerik planı",
  brief: "Brief",
  medya: "Fotoğraf ve video",
  influencer: "Influencerlar",
};
const stepTitle = (k: string) => TITLES[k] ?? k;
