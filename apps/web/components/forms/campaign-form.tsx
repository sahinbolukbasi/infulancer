"use client";
import { useState, type ReactNode } from "react";
import { KPI_KEYS, kpiLabels, type Kpi } from "@infulancer/core/domain/campaign-score";
import { ActionForm } from "@/components/forms/action-form";
import { Button, Field, Input, Select } from "@/components/ui/form";
import { saveCampaign } from "@/lib/actions/campaigns";
import { cn } from "@/lib/cn";

type TargetRow = { kpi: Kpi; target: string; weight: string; windowDays: string };
export type CampaignFormValues = {
  id: string;
  brandId: string;
  name: string;
  slug: string;
  budget: string;
  brandTotalFee: string;
  startsAt: string;
  endsAt: string;
  status: "TASLAK" | "AKTIF" | "KAPANDI" | "IPTAL";
  targets: { kpi: Kpi; target: number; weight: number; windowDays: number }[];
};

/** Hedef şablonları: seçince KPI hedefleri hazır doldurulur (gelişmiş bölümde düzenlenebilir). */
const GOALS: { id: string; title: string; text: string; tone: string; rows: TargetRow[] }[] = [
  {
    id: "bilinirlik",
    title: "Bilinirlik",
    text: "Geniş kitleye ulaş",
    tone: "from-neon-pink/30",
    rows: [
      { kpi: "reach", target: "500000", weight: "2", windowDays: "30" },
      { kpi: "impressions", target: "1200000", weight: "1", windowDays: "30" },
    ],
  },
  {
    id: "etkilesim",
    title: "Etkileşim",
    text: "Beğeni, yorum, kaydetme",
    tone: "from-neon-violet/30",
    rows: [
      { kpi: "er", target: "0,05", weight: "2", windowDays: "14" },
      { kpi: "reach", target: "200000", weight: "1", windowDays: "30" },
    ],
  },
  {
    id: "satis",
    title: "Satış",
    text: "Kupon ve tıklama",
    tone: "from-neon-lime/30",
    rows: [
      { kpi: "sales", target: "1000", weight: "3", windowDays: "30" },
      { kpi: "click", target: "20000", weight: "1", windowDays: "30" },
    ],
  },
  {
    id: "video",
    title: "Video izlenme",
    text: "Reels, TikTok, YouTube",
    tone: "from-neon-cyan/30",
    rows: [
      { kpi: "views", target: "1000000", weight: "2", windowDays: "30" },
      { kpi: "er", target: "0,04", weight: "1", windowDays: "30" },
    ],
  },
];
const DURATIONS = [
  { label: "2 hafta", days: 14 },
  { label: "1 ay", days: 30 },
  { label: "3 ay", days: 90 },
];
const iso = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (day: string, n: number) => iso(new Date(Date.parse(`${day}T12:00:00Z`) + n * 86_400_000));
const tl = (v: string) => Number(v.replace(/\./g, "").replace(",", ".")) || 0;
const fmt = (n: number) => n.toLocaleString("tr-TR", { maximumFractionDigits: 0 });

function Section({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-3xl border border-line bg-glass p-5">
      <h2 className="flex items-center gap-3 text-[15px] font-medium">
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-fg text-[13px] font-semibold text-bg">{n}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

/** Kampanya formu: Hedef → Marka ve tarih → Bütçe; KPI ayrıntıları ve kısa ad "Gelişmiş"te. */
export function CampaignForm({ campaign, brands, returnTo, defaultBrandId }: { returnTo?: string; defaultBrandId?: string; campaign?: CampaignFormValues; brands: { id: string; name: string }[] }) {
  const [rows, setRows] = useState<TargetRow[]>(
    campaign?.targets.map((t) => ({ kpi: t.kpi, target: String(t.target).replace(".", ","), weight: String(t.weight), windowDays: String(t.windowDays) })) ?? GOALS[0]!.rows,
  );
  const [goal, setGoal] = useState<string | null>(campaign ? null : GOALS[0]!.id);
  const [startsAt, setStartsAt] = useState(campaign?.startsAt ?? addDays(iso(new Date()), 7));
  const [endsAt, setEndsAt] = useState(campaign?.endsAt ?? addDays(addDays(iso(new Date()), 7), 30));
  const [budget, setBudget] = useState(campaign?.budget ?? "");
  const [fee, setFee] = useState(campaign?.brandTotalFee ?? "");
  const update = (i: number, patch: Partial<TargetRow>) => setRows((r) => r.map((row, j) => (j === i ? { ...row, ...patch } : row)));
  const unused = KPI_KEYS.filter((k) => !rows.some((r) => r.kpi === k));
  const margin = tl(fee) - tl(budget);
  const days = Math.round((Date.parse(endsAt) - Date.parse(startsAt)) / 86_400_000) + 1;

  return (
    <ActionForm action={saveCampaign} submitLabel={campaign ? "Kaydet" : "Oluştur ve influencer seçimine geç →"} aria-label="Kampanya bilgileri" className="gap-5">
      {campaign ? <input type="hidden" name="id" value={campaign.id} /> : null}
      {returnTo ? <input type="hidden" name="returnTo" value={returnTo} /> : null}
      <input type="hidden" name="targets" value={JSON.stringify(rows)} />

      <Section n={1} title="Kampanyanın hedefi ne?">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4" role="radiogroup" aria-label="Kampanya hedefi">
          {GOALS.map((g) => (
            <button
              key={g.id}
              type="button"
              role="radio"
              aria-checked={goal === g.id}
              onClick={() => {
                setGoal(g.id);
                setRows(g.rows);
              }}
              className={cn(
                "flex flex-col items-start gap-1 rounded-2xl border bg-gradient-to-br to-transparent p-4 text-left transition-standard",
                g.tone,
                goal === g.id ? "border-neon-pink ring-1 ring-neon-pink/50" : "border-line hover:border-line-strong",
              )}
            >
              <span className="text-[15px] font-semibold">{g.title}</span>
              <span className="text-[12px] text-fg-muted">{g.text}</span>
            </button>
          ))}
        </div>
        <p className="text-[12px] text-fg-passive">
          Hedefler: {rows.map((r) => `${kpiLabels[r.kpi]} ${r.target}`).join(" · ")}
        </p>
      </Section>

      <Section n={2} title="Marka ve tarih">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Marka">
            {(p) => (
              <Select {...p} name="brandId" required defaultValue={campaign?.brandId ?? defaultBrandId ?? ""}>
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
          <Field label="Kampanya adı">{(p) => <Input {...p} name="name" required defaultValue={campaign?.name} placeholder="Yaz koleksiyonu lansmanı" />}</Field>
          <Field label="Başlangıç">{(p) => <Input {...p} name="startsAt" type="date" required value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />}</Field>
          <Field label="Bitiş">{(p) => <Input {...p} name="endsAt" type="date" required value={endsAt} min={startsAt} onChange={(e) => setEndsAt(e.target.value)} />}</Field>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {DURATIONS.map((d) => (
            <button key={d.label} type="button" onClick={() => setEndsAt(addDays(startsAt, d.days - 1))} className="rounded-full border border-line px-3 py-1 text-[12px] text-fg-muted hover:border-neon-pink hover:text-fg">
              {d.label}
            </button>
          ))}
          <span className="text-[12px] text-fg-passive tabular-nums">{days > 0 ? `${days} gün` : "Bitiş başlangıçtan önce olamaz"}</span>
        </div>
      </Section>

      <Section n={3} title="Bütçe">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Field label="Influencer bütçesi (TL)" hint="Yalnız ajans görür.">
            {(p) => <Input {...p} name="budget" required inputMode="decimal" value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="450000" />}
          </Field>
          <Field label="Marka bedeli (TL)" hint="Markanın ödediği tutar.">
            {(p) => <Input {...p} name="brandTotalFee" required inputMode="decimal" value={fee} onChange={(e) => setFee(e.target.value)} placeholder="560000" />}
          </Field>
          <div className="flex flex-col justify-center gap-1 rounded-2xl border border-line p-4">
            <span className="text-[12px] text-fg-muted">Brüt fark</span>
            <span className={cn("text-xl font-semibold tabular-nums", margin < 0 ? "text-critical" : "text-neon-lime")}>{fmt(margin)} TL</span>
            <span className="text-[12px] text-fg-passive tabular-nums">{tl(fee) ? `%${fmt((margin / tl(fee)) * 100)} marj` : "—"}</span>
          </div>
        </div>
      </Section>

      <details className="rounded-3xl border border-line px-5 py-4">
        <summary className="cursor-pointer text-sm text-fg-muted hover:text-fg">Gelişmiş: KPI ağırlıkları, kısa ad, durum</summary>
        <div className="mt-4 flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="Kısa ad (UTM)" hint="Boşsa addan üretilir.">
              {(p) => <Input {...p} name="slug" defaultValue={campaign?.slug} pattern="[a-z0-9\-]*" />}
            </Field>
            <Field label="Durum">
              {(p) =>
                campaign?.status === "KAPANDI" ? (
                  <Input {...p} value="Kapandı" disabled readOnly />
                ) : (
                  <Select {...p} name="status" defaultValue={campaign?.status ?? "TASLAK"}>
                    <option value="TASLAK">Taslak</option>
                    <option value="AKTIF">Aktif</option>
                    <option value="IPTAL">İptal</option>
                  </Select>
                )
              }
            </Field>
          </div>
          <fieldset className="flex flex-col gap-3">
            <legend className="mb-2 text-label text-fg-muted">Hedefler (ağırlıklı skor)</legend>
            {rows.map((row, i) => (
              <div key={i} className="grid grid-cols-2 gap-3 md:grid-cols-[1.4fr_1fr_0.7fr_0.8fr_auto]">
                <Select aria-label={`Hedef ${i + 1} KPI`} value={row.kpi} onChange={(e) => update(i, { kpi: e.target.value as Kpi })}>
                  {[row.kpi, ...unused].map((k) => (
                    <option key={k} value={k}>
                      {kpiLabels[k]}
                    </option>
                  ))}
                </Select>
                <Input aria-label={`Hedef ${i + 1} değer`} inputMode="decimal" value={row.target} placeholder={row.kpi === "er" ? "0,045" : "250000"} onChange={(e) => update(i, { target: e.target.value })} required />
                <Input aria-label={`Hedef ${i + 1} ağırlık`} inputMode="decimal" value={row.weight} onChange={(e) => update(i, { weight: e.target.value })} required />
                <Input aria-label={`Hedef ${i + 1} pencere (gün)`} type="number" min={1} max={365} value={row.windowDays} onChange={(e) => update(i, { windowDays: e.target.value })} required />
                <Button variant="ghost" size="md" onClick={() => setRows((r) => r.filter((_, j) => j !== i))} aria-label={`Hedef ${i + 1} sil`}>
                  Sil
                </Button>
              </div>
            ))}
            {unused.length > 0 ? (
              <div>
                <Button variant="secondary" size="sm" onClick={() => setRows((r) => [...r, { kpi: unused[0]!, target: "", weight: "1", windowDays: "30" }])}>
                  Hedef ekle
                </Button>
              </div>
            ) : null}
          </fieldset>
        </div>
      </details>
    </ActionForm>
  );
}
