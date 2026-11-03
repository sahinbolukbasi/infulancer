import Link from "next/link";
import type { CategoryNode } from "@infulancer/core/domain/categories";
import { AGE_GROUPS } from "@infulancer/core/domain/influencer-search";

type Sp = Record<string, string | string[] | undefined>;
const v = (sp: Sp, k: string) => {
  const x = sp[k];
  return (Array.isArray(x) ? x[0] : x) ?? "";
};

const inputCls = "h-9 w-full rounded-[8px] border border-border bg-transparent px-3 text-sm";

/** Influencer arama filtreleri — GET formu; filtreler URL'de tutulur (paylaşılabilir, geri tuşuyla çalışır). */
export function InfluencerFilterBar({ categories, sp, count, total, active }: { categories: CategoryNode[]; sp: Sp; count: number; total: number; active: number }) {
  return (
    <form method="get" role="search" aria-label="Influencer filtreleri" className="flex flex-col gap-4 rounded-[12px] border border-border p-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <label className="flex flex-col gap-1 text-[12px] text-fg-muted md:col-span-2">
          Ara (ad, @kullanıcı adı, şehir)
          <input name="q" defaultValue={v(sp, "q")} className={inputCls} placeholder="@zeynep, İzmir…" />
        </label>
        <label className="flex flex-col gap-1 text-[12px] text-fg-muted">
          Kategori
          <select name="kategori" defaultValue={v(sp, "kategori")} className={inputCls}>
            <option value="">Tümü</option>
            {categories.map((c) => (
              <optgroup key={c.id} label={c.name}>
                <option value={c.id}>{c.name} (tümü)</option>
                {c.children.map((ch) => (
                  <option key={ch.id} value={ch.id}>
                    {ch.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[12px] text-fg-muted">
          Platform
          <select name="platform" defaultValue={v(sp, "platform")} className={inputCls}>
            <option value="">Tümü</option>
            <option value="INSTAGRAM">Instagram</option>
            <option value="TIKTOK">TikTok</option>
            <option value="YOUTUBE">YouTube</option>
          </select>
        </label>
      </div>
      <details open={active > 0 && !(active === 1 && (v(sp, "q") || v(sp, "kategori") || v(sp, "platform")))}>
        <summary className="cursor-pointer text-[13px] text-fg-muted">Gelişmiş filtreler (takipçi, etkileşim, kitle, müsaitlik, risk, vergi)</summary>
        <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-6">
          <label className="flex flex-col gap-1 text-[12px] text-fg-muted">
            Min. takipçi
            <input name="minTakipci" inputMode="numeric" defaultValue={v(sp, "minTakipci")} className={inputCls} placeholder="50000" />
          </label>
          <label className="flex flex-col gap-1 text-[12px] text-fg-muted">
            Maks. takipçi
            <input name="maxTakipci" inputMode="numeric" defaultValue={v(sp, "maxTakipci")} className={inputCls} />
          </label>
          <label className="flex flex-col gap-1 text-[12px] text-fg-muted">
            Min. ER (%)
            <input name="minEr" inputMode="decimal" defaultValue={v(sp, "minEr")} className={inputCls} placeholder="3" />
          </label>
          <label className="flex flex-col gap-1 text-[12px] text-fg-muted">
            Kitlede kadın en az (%)
            <input name="minKadin" inputMode="numeric" defaultValue={v(sp, "minKadin")} className={inputCls} />
          </label>
          <label className="flex flex-col gap-1 text-[12px] text-fg-muted">
            Baskın yaş grubu
            <select name="yas" defaultValue={v(sp, "yas")} className={inputCls}>
              <option value="">Fark etmez</option>
              {AGE_GROUPS.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[12px] text-fg-muted">
            Kitle / yaşadığı şehir
            <input name="sehir" defaultValue={v(sp, "sehir")} className={inputCls} placeholder="Ankara" />
          </label>
          <label className="flex flex-col gap-1 text-[12px] text-fg-muted">
            Müsait: başlangıç
            <input type="date" name="musaitBas" defaultValue={v(sp, "musaitBas")} className={inputCls} />
          </label>
          <label className="flex flex-col gap-1 text-[12px] text-fg-muted">
            Müsait: bitiş
            <input type="date" name="musaitBit" defaultValue={v(sp, "musaitBit")} className={inputCls} />
          </label>
          <label className="flex flex-col gap-1 text-[12px] text-fg-muted">
            Maks. risk skoru
            <input name="maxRisk" inputMode="numeric" defaultValue={v(sp, "maxRisk")} className={inputCls} placeholder="40" />
          </label>
          <label className="flex flex-col gap-1 text-[12px] text-fg-muted">
            Vergi durumu
            <select name="vergi" defaultValue={v(sp, "vergi")} className={inputCls}>
              <option value="">Tümü</option>
              <option value="istisna_20b">20/B istisna</option>
              <option value="kayitli_mukellef">Kayıtlı mükellef</option>
              <option value="diger">Fatura kesemiyor</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[12px] text-fg-muted">
            Sırala
            <select name="sirala" defaultValue={v(sp, "sirala") || "name"} className={inputCls}>
              <option value="name">Ada göre</option>
              <option value="followers">Takipçi (çoktan aza)</option>
              <option value="er">Etkileşim (yüksekten)</option>
              <option value="risk">Risk (düşükten)</option>
            </select>
          </label>
        </div>
      </details>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13px] text-fg-muted" aria-live="polite">
          {active ? `${active} filtre · ` : ""}
          {count} / {total} influencer
        </p>
        <div className="flex gap-2">
          {active ? (
            <Link href="/admin/influencerlar" className="inline-flex h-9 items-center rounded-[8px] border border-border px-4 text-sm text-fg-muted hover:text-fg">
              Temizle
            </Link>
          ) : null}
          <button type="submit" className="inline-flex h-9 items-center rounded-[8px] bg-fg px-4 text-sm text-bg">
            Filtrele
          </button>
        </div>
      </div>
    </form>
  );
}
