"use client";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Platform } from "@infulancer/core/enums";
import { CheckIcon, SearchIcon, SparkleIcon, XIcon } from "@/components/icons";
import { PlatformIcon } from "@/components/platform-icon";
import { Button, Input, Select } from "@/components/ui/form";
import { createAssignmentsBulk, type BulkAssignResult } from "@/lib/actions/assignments";
import { cn } from "@/lib/cn";

export type PickerInfluencer = {
  id: string;
  name: string;
  city: string | null;
  primaryCategory: string;
  categories: string[];
  accounts: { platform: Platform; handle: string; followers: number; er: number }[];
  totalFollowers: number;
  bestEr: number;
  /** Bu influencer'a son atamadaki bedel (TL, öneri olarak) */
  lastFeeTl: number | null;
  /** Aynı markayla daha önce yapılan kampanya sayısı */
  brandHistory: number;
  suggested: boolean;
  rationale?: string;
};

const compact = new Intl.NumberFormat("tr-TR", { notation: "compact", maximumFractionDigits: 1 });
const pct = new Intl.NumberFormat("tr-TR", { style: "percent", maximumFractionDigits: 1 });
const FOLLOWER_STEPS = [0, 10_000, 50_000, 100_000, 500_000, 1_000_000];

/**
 * Kampanyaya influencer ekleme: ara/filtrele → işaretle → bedel gir → tek tıkla ekle.
 * Marka çakışması olanlar eklenmez ve gerekçeli tekli atamaya yönlendirilir.
 */
export function InfluencerPicker({ campaignId, influencers }: { campaignId: string; influencers: PickerInfluencer[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [platform, setPlatform] = useState<"" | Platform>("");
  const [minFollowers, setMinFollowers] = useState(0);
  const [sort, setSort] = useState<"suggested" | "followers" | "er" | "name">("suggested");
  const [selected, setSelected] = useState<Map<string, string>>(new Map());
  const [commissionPct, setCommissionPct] = useState("20");
  const [result, setResult] = useState<BulkAssignResult | null>(null);
  const [pending, start] = useTransition();

  const categories = useMemo(() => [...new Set(influencers.flatMap((i) => i.categories))].sort((a, b) => a.localeCompare(b, "tr")), [influencers]);
  const byId = useMemo(() => new Map(influencers.map((i) => [i.id, i])), [influencers]);

  const list = useMemo(() => {
    const needle = q.trim().toLocaleLowerCase("tr");
    const rows = influencers.filter((i) => {
      if (needle && !`${i.name} ${i.city ?? ""} ${i.accounts.map((a) => a.handle).join(" ")}`.toLocaleLowerCase("tr").includes(needle)) return false;
      if (category && !i.categories.includes(category)) return false;
      const accs = platform ? i.accounts.filter((a) => a.platform === platform) : i.accounts;
      if (platform && accs.length === 0) return false;
      if (minFollowers && accs.reduce((s, a) => s + a.followers, 0) < minFollowers) return false;
      return true;
    });
    return rows.sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name, "tr");
      if (sort === "followers") return b.totalFollowers - a.totalFollowers;
      if (sort === "er") return b.bestEr - a.bestEr;
      return Number(b.suggested) - Number(a.suggested) || b.brandHistory - a.brandHistory || b.totalFollowers - a.totalFollowers;
    });
  }, [influencers, q, category, platform, minFollowers, sort]);

  const toggle = (i: PickerInfluencer) =>
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(i.id)) next.delete(i.id);
      else next.set(i.id, i.lastFeeTl ? String(i.lastFeeTl) : "");
      return next;
    });
  const setFee = (id: string, v: string) => setSelected((prev) => new Map(prev).set(id, v));

  const parsedFees = [...selected].map(([id, v]) => ({ id, tl: Number(v.replace(/\./g, "").replace(",", ".")) }));
  const missingFee = parsedFees.some((f) => !Number.isFinite(f.tl) || f.tl <= 0);
  const totalTl = parsedFees.reduce((s, f) => s + (Number.isFinite(f.tl) ? f.tl : 0), 0);
  const pctNum = Number(commissionPct.replace(",", "."));

  const submit = () =>
    start(async () => {
      const res = await createAssignmentsBulk({
        campaignId,
        commissionPct: Number.isFinite(pctNum) ? pctNum : 0,
        items: parsedFees.map((f) => ({ influencerId: f.id, feeKurus: Math.round(f.tl * 100) })),
      });
      setResult(res);
      if (res.created.length) {
        setSelected((prev) => {
          const next = new Map(prev);
          for (const c of res.created) next.delete(c.influencerId);
          return next;
        });
        router.refresh();
      }
    });

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-[2fr_1fr_1fr_1fr_1fr]">
        <label className="relative">
          <span className="sr-only">Influencer ara</span>
          <SearchIcon size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-fg-passive" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="İsim, şehir veya @kullanıcı" className="pl-9" />
        </label>
        <label>
          <span className="sr-only">Kategori</span>
          <Select value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">Tüm kategoriler</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </label>
        <label>
          <span className="sr-only">Platform</span>
          <Select value={platform} onChange={(e) => setPlatform(e.target.value as "" | Platform)}>
            <option value="">Tüm platformlar</option>
            <option value="INSTAGRAM">Instagram</option>
            <option value="TIKTOK">TikTok</option>
            <option value="YOUTUBE">YouTube</option>
          </Select>
        </label>
        <label>
          <span className="sr-only">En az takipçi</span>
          <Select value={minFollowers} onChange={(e) => setMinFollowers(Number(e.target.value))}>
            {FOLLOWER_STEPS.map((n) => (
              <option key={n} value={n}>
                {n ? `${compact.format(n)}+ takipçi` : "Takipçi: hepsi"}
              </option>
            ))}
          </Select>
        </label>
        <label>
          <span className="sr-only">Sırala</span>
          <Select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
            <option value="suggested">Önerilen önce</option>
            <option value="followers">Takipçi</option>
            <option value="er">Etkileşim</option>
            <option value="name">Ad</option>
          </Select>
        </label>
      </div>

      <p className="text-[13px] text-fg-passive" aria-live="polite">
        {list.length} uygun influencer · {selected.size} seçili
      </p>

      {influencers.length === 0 ? (
        <p className="text-sm text-fg-passive">Eklenebilecek influencer kalmadı; hepsi bu kampanyada.</p>
      ) : (
        <ul className="grid max-h-[480px] grid-cols-1 gap-2 overflow-auto pr-1 lg:grid-cols-2" aria-label="Influencer listesi">
          {list.map((i) => {
            const on = selected.has(i.id);
            return (
              <li key={i.id}>
                <button
                  type="button"
                  onClick={() => toggle(i)}
                  aria-pressed={on}
                  className={cn(
                    "flex w-full items-start gap-3 rounded-[8px] border p-3 text-left transition-standard",
                    on ? "border-fg bg-surface-hover" : "border-border hover:bg-surface-hover",
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-[5px] border",
                      on ? "border-fg bg-fg text-bg" : "border-border",
                    )}
                  >
                    {on ? <CheckIcon size={14} /> : null}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-sm text-fg">{i.name}</span>
                      {i.suggested ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-border px-2 text-[11px] text-fg-muted">
                          <SparkleIcon size={11} /> Önerilen
                        </span>
                      ) : null}
                      {i.brandHistory ? (
                        <span className="rounded-full border border-border px-2 text-[11px] text-fg-muted">Markayla {i.brandHistory} iş</span>
                      ) : null}
                    </span>
                    <span className="text-[12px] text-fg-passive">
                      {i.primaryCategory}
                      {i.city ? ` · ${i.city}` : ""}
                      {i.lastFeeTl ? ` · son bedel ${i.lastFeeTl.toLocaleString("tr-TR")} TL` : ""}
                    </span>
                    <span className="flex flex-wrap gap-3 text-[12px] tabular-nums text-fg-muted">
                      {i.accounts.length === 0 ? <span>Sosyal hesap yok</span> : null}
                      {i.accounts.map((a) => (
                        <span key={a.platform} className="inline-flex items-center gap-1" title={`@${a.handle}`}>
                          <PlatformIcon platform={a.platform} size={12} />
                          {compact.format(a.followers)} · {pct.format(a.er)}
                        </span>
                      ))}
                    </span>
                    {i.rationale ? <span className="text-[12px] text-fg-passive">{i.rationale}</span> : null}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {selected.size > 0 ? (
        <div className="flex flex-col gap-3 rounded-[8px] border border-border p-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <p className="text-sm text-fg">Seçilenler ({selected.size}) · bedelleri girin</p>
            <label className="flex items-center gap-2 text-[13px] text-fg-muted">
              Ajans komisyonu %
              <Input value={commissionPct} onChange={(e) => setCommissionPct(e.target.value)} inputMode="decimal" className="w-20" aria-label="Ajans komisyonu yüzdesi" />
            </label>
          </div>
          <ul className="flex flex-col divide-y divide-border">
            {[...selected].map(([id, fee]) => {
              const inf = byId.get(id);
              return (
                <li key={id} className="flex flex-wrap items-center justify-between gap-3 py-2">
                  <span className="text-sm">{inf?.name ?? id}</span>
                  <span className="flex items-center gap-2">
                    <Input
                      value={fee}
                      onChange={(e) => setFee(id, e.target.value)}
                      inputMode="decimal"
                      placeholder="Bedel (TL)"
                      aria-label={`${inf?.name ?? id} bedeli (TL)`}
                      className="w-36"
                    />
                    <button
                      type="button"
                      onClick={() => inf && toggle(inf)}
                      aria-label={`${inf?.name ?? id} seçimini kaldır`}
                      title="Kaldır"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-[8px] text-fg-muted hover:bg-surface-hover hover:text-fg"
                    >
                      <XIcon size={16} />
                    </button>
                  </span>
                </li>
              );
            })}
          </ul>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
            <span className="text-[13px] tabular-nums text-fg-muted">
              Toplam bedel {totalTl.toLocaleString("tr-TR")} TL · komisyon {Math.round((totalTl * (Number.isFinite(pctNum) ? pctNum : 0)) / 100).toLocaleString("tr-TR")} TL
            </span>
            <Button type="button" onClick={submit} disabled={pending || missingFee}>
              {pending ? "Ekleniyor…" : missingFee ? "Tüm bedelleri girin" : `${selected.size} influencer ekle ve teklif gönder`}
            </Button>
          </div>
        </div>
      ) : null}

      <div aria-live="polite" className="flex flex-col gap-2">
        {result?.created.length ? (
          <p className="text-sm text-fg">
            Eklendi ve teklif gönderildi: {result.created.map((c) => c.name).join(", ")}.
          </p>
        ) : null}
        {result?.failed.length ? (
          <div className="flex flex-col gap-1 rounded-[8px] border border-critical/40 p-3">
            <p className="text-sm text-critical">Eklenemeyenler</p>
            <ul className="list-disc pl-4 text-[13px] text-fg-muted">
              {result.failed.map((f) => (
                <li key={f.influencerId}>
                  {f.name}: {f.reason}
                  {f.conflict ? " — gerekçeyle eklemek için aşağıdaki tekli formu kullanın." : ""}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {result && !result.created.length && !result.failed.length && result.error ? <p className="text-sm text-critical">{result.error}</p> : null}
      </div>
    </div>
  );
}
