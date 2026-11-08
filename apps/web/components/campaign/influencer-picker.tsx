"use client";
import { useTT } from "@/lib/i18n/tt-client";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Platform } from "@infulancer/core/enums";
import { CheckIcon, SearchIcon, SparkleIcon, XIcon } from "@/components/icons";
import { PlatformIcon } from "@/components/platform-icon";
import { Button, Input, Select } from "@/components/ui/form";
import { createAssignmentsBulk, type BulkAssignResult } from "@/lib/actions/assignments";
import { cn } from "@/lib/cn";
import { Avatar } from "@/components/ui/avatar";

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
  avatarUrl?: string | null;
};

const compact = new Intl.NumberFormat("tr-TR", { notation: "compact", maximumFractionDigits: 1 });
const pct = new Intl.NumberFormat("tr-TR", { style: "percent", maximumFractionDigits: 1 });
const FOLLOWER_STEPS = [0, 10_000, 50_000, 100_000, 500_000, 1_000_000];

/**
 * Kampanyaya influencer ekleme: kategori çipleriyle filtrele → listelenenlerin tümünü (veya tek tek) seç
 * → ortak bedeli herkese uygula → tek tıkla ekle (50'den fazlası parça parça gönderilir).
 * Marka çakışması olanlar eklenmez ve gerekçeli tekli atamaya yönlendirilir.
 */
export function InfluencerPicker({ campaignId, influencers, preselected = [] }: { campaignId: string; influencers: PickerInfluencer[]; preselected?: string[] }) {
  const tt = useTT();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [cats, setCats] = useState<Set<string>>(new Set());
  const [bulkFee, setBulkFee] = useState("");
  const [platform, setPlatform] = useState<"" | Platform>("");
  const [minFollowers, setMinFollowers] = useState(0);
  const [sort, setSort] = useState<"suggested" | "followers" | "er" | "name">("suggested");
  // Markanın önerdiği (kısa liste) influencerlar önceden seçili gelir; bedel son atamadan önerilir.
  const [selected, setSelected] = useState<Map<string, string>>(
    () => new Map(influencers.filter((i) => preselected.includes(i.id)).map((i) => [i.id, i.lastFeeTl ? String(i.lastFeeTl) : ""])),
  );
  const [commissionPct, setCommissionPct] = useState("20");
  const [result, setResult] = useState<BulkAssignResult | null>(null);
  const [pending, start] = useTransition();

  // Kategori → kişi sayısı (çipte gösterilir), en kalabalık önce.
  const categoryCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const i of influencers) for (const c of i.categories) m.set(c, (m.get(c) ?? 0) + 1);
    return [...m].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "tr"));
  }, [influencers]);
  const byId = useMemo(() => new Map(influencers.map((i) => [i.id, i])), [influencers]);

  const list = useMemo(() => {
    const needle = q.trim().toLocaleLowerCase("tr");
    const rows = influencers.filter((i) => {
      if (needle && !`${i.name} ${i.city ?? ""} ${i.accounts.map((a) => a.handle).join(" ")}`.toLocaleLowerCase("tr").includes(needle)) return false;
      if (cats.size && !i.categories.some((c) => cats.has(c))) return false;
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
  }, [influencers, q, cats, platform, minFollowers, sort]);
  const toggleCat = (c: string) =>
    setCats((prev) => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c);
      else next.add(c);
      return next;
    });
  const listedSelected = list.filter((i) => selected.has(i.id)).length;
  const allListed = list.length > 0 && listedSelected === list.length;
  /** Listelenen herkesi seç / seçimi kaldır (filtreye göre toplu seçim). */
  const selectListed = (on: boolean) =>
    setSelected((prev) => {
      const next = new Map(prev);
      for (const i of list) {
        if (on && !next.has(i.id)) next.set(i.id, bulkFee || (i.lastFeeTl ? String(i.lastFeeTl) : ""));
        if (!on) next.delete(i.id);
      }
      return next;
    });
  /** Bedeli seçili herkese (veya yalnız boş olanlara) uygula. */
  const applyFee = (onlyEmpty: boolean) =>
    setSelected((prev) => {
      const next = new Map(prev);
      for (const [id, v] of next) if (!onlyEmpty || !v.trim()) next.set(id, bulkFee);
      return next;
    });

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
      // Sunucu tek istekte en fazla 50 kişi kabul eder; büyük seçimler parça parça gönderilir.
      const items = parsedFees.map((f) => ({ influencerId: f.id, feeKurus: Math.round(f.tl * 100) }));
      const merged: BulkAssignResult = { ok: false, created: [], failed: [] };
      for (let k = 0; k < items.length; k += 50) {
        const res = await createAssignmentsBulk({ campaignId, commissionPct: Number.isFinite(pctNum) ? pctNum : 0, items: items.slice(k, k + 50) });
        merged.created.push(...res.created);
        merged.failed.push(...res.failed);
        if (!res.created.length && !res.failed.length && res.error) merged.error = res.error;
      }
      merged.ok = merged.created.length > 0;
      setResult(merged);
      if (merged.created.length) {
        setSelected((prev) => {
          const next = new Map(prev);
          for (const c of merged.created) next.delete(c.influencerId);
          return next;
        });
        router.refresh();
      }
    });
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-[2fr_1fr_1fr_1fr]">
        <label className="relative">
          <span className="sr-only">{tt("Influencer ara")}</span>
          <SearchIcon size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-fg-passive" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={tt("İsim, şehir veya @kullanıcı")} className="pl-9" />
        </label>
        <label>
          <span className="sr-only">{tt("Platform")}</span>
          <Select value={platform} onChange={(e) => setPlatform(e.target.value as "" | Platform)}>
            <option value="">{tt("Tüm platformlar")}</option>
            <option value="INSTAGRAM">{tt("Instagram")}</option>
            <option value="TIKTOK">{tt("TikTok")}</option>
            <option value="YOUTUBE">{tt("YouTube")}</option>
          </Select>
        </label>
        <label>
          <span className="sr-only">{tt("En az takipçi")}</span>
          <Select value={minFollowers} onChange={(e) => setMinFollowers(Number(e.target.value))}>
            {FOLLOWER_STEPS.map((n) => (
              <option key={n} value={n}>
                {n ? `${compact.format(n)}+ takipçi` : tt("Takipçi: hepsi")}
              </option>
            ))}
          </Select>
        </label>
        <label>
          <span className="sr-only">{tt("Sırala")}</span>
          <Select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
            <option value="suggested">{tt("Önerilen önce")}</option>
            <option value="followers">{tt("Takipçi")}</option>
            <option value="er">{tt("Etkileşim")}</option>
            <option value="name">{tt("Ad")}</option>
          </Select>
        </label>
      </div>

      {categoryCounts.length ? (
        <div className="flex flex-col gap-2">
          <span className="text-[12px] text-fg-muted">{tt("Kategoriler (birden fazla seçebilirsiniz)")}</span>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label={tt("Kategori filtresi")}>
            <button
              type="button"
              aria-pressed={cats.size === 0}
              onClick={() => setCats(new Set())}
              className={cn("rounded-full border px-3 py-1 text-[12px] transition-standard", cats.size === 0 ? "border-fg bg-fg text-bg" : "border-border text-fg-muted hover:text-fg")}
            >{tt("Tümü")}{" "}<span className="tabular-nums opacity-60">{influencers.length}</span>
            </button>
            {categoryCounts.map(([c, n]) => (
              <button
                key={c}
                type="button"
                aria-pressed={cats.has(c)}
                onClick={() => toggleCat(c)}
                className={cn("rounded-full border px-3 py-1 text-[12px] transition-standard", cats.has(c) ? "border-fg bg-fg text-bg" : "border-border text-fg-muted hover:text-fg")}
              >
                {c} <span className="tabular-nums opacity-60">{n}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-3 rounded-[8px] border border-border bg-surface-hover/40 px-3 py-2">
        <label className="flex items-center gap-2 text-[13px] text-fg">
          <input
            type="checkbox"
            className="h-4 w-4 accent-[var(--color-fg)]"
            checked={allListed}
            ref={(el) => {
              if (el) el.indeterminate = listedSelected > 0 && !allListed;
            }}
            onChange={(e) => selectListed(e.target.checked)}
            disabled={list.length === 0}
            aria-label={tt("Listelenen tüm influencerları seç")}
          />
          {allListed ? tt("Listelenenlerin seçimini kaldır") : `Listelenen ${list.length} kişinin tümünü seç`}
        </label>
        <span className="text-[13px] text-fg-passive" aria-live="polite">
          {list.length}{" "}{tt("listelenen ·")}{" "}{selected.size}{" "}{tt("seçili")}</span>
        {selected.size ? (
          <button type="button" onClick={() => setSelected(new Map())} className="ml-auto text-[12px] text-fg-muted underline-offset-4 hover:text-fg hover:underline">{tt("Tüm seçimi temizle")}</button>
        ) : null}
      </div>

      {influencers.length === 0 ? (
        <p className="text-sm text-fg-passive">{tt("Eklenebilecek influencer kalmadı; hepsi bu kampanyada.")}</p>
      ) : (
        <ul className="flex max-h-[520px] flex-col divide-y divide-border overflow-auto rounded-[8px] border border-border" aria-label={tt("Influencer listesi")}>
          {list.map((i) => {
            const on = selected.has(i.id);
            return (
              <li key={i.id}>
                <button
                  type="button"
                  onClick={() => toggle(i)}
                  aria-pressed={on}
                  className={cn(
                    "flex w-full items-start gap-3 px-3 py-2.5 text-left transition-standard",
                    on ? "bg-surface-hover" : "hover:bg-surface-hover/60",
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
                  <Avatar name={i.name} src={i.avatarUrl} size={36} />
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-sm text-fg">{i.name}</span>
                      {i.suggested ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-border px-2 text-[11px] text-fg-muted">
                          <SparkleIcon size={11} />{" "}{tt("Önerilen")}</span>
                      ) : null}
                      {i.brandHistory ? (
                        <span className="rounded-full border border-border px-2 text-[11px] text-fg-muted">{tt("Markayla")}{" "}{i.brandHistory}{" "}{tt("iş")}</span>
                      ) : null}
                    </span>
                    <span className="text-[12px] text-fg-passive">
                      {i.primaryCategory}
                      {i.city ? ` · ${i.city}` : ""}
                      {i.lastFeeTl ? ` · son bedel ${i.lastFeeTl.toLocaleString("tr-TR")} TL` : ""}
                    </span>
                    <span className="flex flex-wrap gap-3 text-[12px] tabular-nums text-fg-muted">
                      {i.accounts.length === 0 ? <span>{tt("Sosyal hesap yok")}</span> : null}
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
            <p className="text-sm text-fg">{tt("Seçilenler (")}{selected.size}{tt(") · bedelleri girin")}</p>
            <div className="flex flex-wrap items-center gap-2">
              <Input value={bulkFee} onChange={(e) => setBulkFee(e.target.value)} inputMode="decimal" placeholder={tt("Ortak bedel (TL)")} aria-label={tt("Seçilenlere uygulanacak ortak bedel (TL)")} className="w-40" />
              <Button type="button" size="sm" variant="secondary" onClick={() => applyFee(false)} disabled={!bulkFee.trim()}>{tt("Herkese uygula")}</Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => applyFee(true)} disabled={!bulkFee.trim()}>{tt("Yalnız boşlara")}</Button>
            </div>
            <label className="flex items-center gap-2 text-[13px] text-fg-muted">{tt("Ajans komisyonu %")}<Input value={commissionPct} onChange={(e) => setCommissionPct(e.target.value)} inputMode="decimal" className="w-20" aria-label={tt("Ajans komisyonu yüzdesi")} />
            </label>
          </div>
          <ul className="flex max-h-72 flex-col divide-y divide-border overflow-auto">
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
                      placeholder={tt("Bedel (TL)")}
                      aria-label={`${inf?.name ?? id} bedeli (TL)`}
                      className="w-36"
                    />
                    <button
                      type="button"
                      onClick={() => inf && toggle(inf)}
                      aria-label={`${inf?.name ?? id} seçimini kaldır`}
                      title={tt("Kaldır")}
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
            <span className="text-[13px] tabular-nums text-fg-muted">{tt("Toplam bedel")}{" "}{totalTl.toLocaleString("tr-TR")}{" "}{tt("TL · komisyon")}{" "}{Math.round((totalTl * (Number.isFinite(pctNum) ? pctNum : 0)) / 100).toLocaleString("tr-TR")}{" "}{tt("TL")}</span>
            <Button type="button" onClick={submit} disabled={pending || missingFee}>
              {pending ? tt("Ekleniyor…") : missingFee ? tt("Tüm bedelleri girin") : `${selected.size} influencer ekle ve teklif gönder`}
            </Button>
          </div>
        </div>
      ) : null}

      <div aria-live="polite" className="flex flex-col gap-2">
        {result?.created.length ? (
          <p className="text-sm text-fg">{tt("Eklendi ve teklif gönderildi:")}{" "}{result.created.map((c) => c.name).join(", ")}.
          </p>
        ) : null}
        {result?.failed.length ? (
          <div className="flex flex-col gap-1 rounded-[8px] border border-critical/40 p-3">
            <p className="text-sm text-critical">{tt("Eklenemeyenler")}</p>
            <ul className="list-disc pl-4 text-[13px] text-fg-muted">
              {result.failed.map((f) => (
                <li key={f.influencerId}>
                  {f.name}: {f.reason}
                  {f.conflict ? tt(" — gerekçeyle eklemek için aşağıdaki tekli formu kullanın.") : ""}
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
