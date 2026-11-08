"use client";
import { formatMinor } from "@infulancer/core/i18n/regions";
import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Platform } from "@infulancer/core/enums";
import { CheckIcon, SearchIcon, XIcon } from "@/components/icons";
import { PlatformIcon } from "@/components/platform-icon";
import { Avatar } from "@/components/ui/avatar";
import { Button, Input, Select, Textarea } from "@/components/ui/form";
import { sendOffersAction } from "@/lib/actions/offers";
import { cn } from "@/lib/cn";

export type DiscoverCreator = {
  id: string;
  name: string;
  city: string | null;
  avatarUrl: string | null;
  categories: string[];
  primaryCategory: string;
  accounts: { platform: Platform; handle: string; followers: number; er: number }[];
  totalFollowers: number;
  rates: { platform: Platform; contentType: string; label: string; priceKurus: number }[];
  headline?: string | null;
};
export type ContentOption = { platform: Platform; contentType: string; label: string };
type Item = { platform: Platform; contentType: string; qty: number; priceTl: string };

const compact = new Intl.NumberFormat("tr-TR", { notation: "compact", maximumFractionDigits: 1 });
const pct = new Intl.NumberFormat("tr-TR", { style: "percent", maximumFractionDigits: 1 });
const num = (v: string) => Number(v.replace(/\./g, "").replace(",", ".")) || 0;

/** Marka: içerik üreticisi keşfi → seç → tek formla teklif gönder (her birine ayrı teklif ve bildirim). */
export function BrandDiscover({ creators, options, campaigns, initialSelected = [], currency = "TRY" }: { creators: DiscoverCreator[]; options: ContentOption[]; campaigns: { id: string; name: string }[]; initialSelected?: string[]; currency?: string }) {
  // Tutarlar bölgenin para biriminde (çevrim yok).
  const tl = (k: number) => formatMinor(k, currency);
  const cur = currency === "TRY" ? "TL" : currency;
  const router = useRouter();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [platform, setPlatform] = useState<"" | Platform>("");
  const [priced, setPriced] = useState(false);
  const [sel, setSel] = useState<Set<string>>(new Set(initialSelected));
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [publishBy, setPublishBy] = useState("");
  const [campaignId, setCampaignId] = useState("");
  const [useRates, setUseRates] = useState(true);
  const [items, setItems] = useState<Item[]>([{ platform: "INSTAGRAM", contentType: "REELS", qty: 1, priceTl: "" }]);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const cats = useMemo(() => [...new Set(creators.flatMap((c) => c.categories))].sort((a, b) => a.localeCompare(b, "tr")), [creators]);
  const list = useMemo(() => {
    const n = q.trim().toLocaleLowerCase("tr");
    return creators
      .filter((c) => (!n || `${c.name} ${c.city ?? ""} ${c.accounts.map((a) => a.handle).join(" ")}`.toLocaleLowerCase("tr").includes(n)) && (!cat || c.categories.includes(cat)) && (!platform || c.accounts.some((a) => a.platform === platform)) && (!priced || c.rates.length > 0))
      .sort((a, b) => b.totalFollowers - a.totalFollowers);
  }, [creators, q, cat, platform, priced]);
  const byId = useMemo(() => new Map(creators.map((c) => [c.id, c])), [creators]);
  const toggle = (id: string) =>
    setSel((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const estimate = (c: DiscoverCreator) =>
    items.reduce((s, i) => s + i.qty * (useRates ? (c.rates.find((r) => r.platform === i.platform && r.contentType === i.contentType)?.priceKurus ?? num(i.priceTl) * 100) : num(i.priceTl) * 100), 0);
  const selected = [...sel].map((id) => byId.get(id)!).filter(Boolean);
  const total = selected.reduce((s, c) => s + estimate(c), 0);
  const optFor = (p: Platform) => options.filter((o) => o.platform === p);

  const send = () =>
    start(async () => {
      setResult(null);
      const r = await sendOffersAction({
        influencerIds: [...sel],
        title,
        message,
        publishBy: publishBy || null,
        campaignId: campaignId || null,
        perInfluencerPricing: useRates,
        items: items.map((i) => ({ platform: i.platform, contentType: i.contentType, qty: i.qty, priceKurus: Math.round(num(i.priceTl) * 100) })),
      });
      if (r.ok) {
        setResult({ ok: true, text: `${r.sent} teklif gönderildi.${r.skipped.length ? ` Atlananlar: ${r.skipped.map((s) => `${s.name} (${s.reason})`).join(", ")}` : ""}` });
        setSel(new Set());
        router.refresh();
      } else setResult({ ok: false, text: `${r.error ?? "Gönderilemedi."}${r.skipped.length ? ` ${r.skipped.map((s) => `${s.name}: ${s.reason}`).join(" · ")}` : ""}` });
    });

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[2fr_1fr_1fr_auto]">
          <label className="relative">
            <span className="sr-only">Ara</span>
            <SearchIcon size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-fg-passive" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="İsim, şehir veya @kullanıcı" className="pl-9" />
          </label>
          <Select value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Kategori">
            <option value="">Tüm kategoriler</option>
            {cats.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
          <Select value={platform} onChange={(e) => setPlatform(e.target.value as "" | Platform)} aria-label="Platform">
            <option value="">Tüm platformlar</option>
            <option value="INSTAGRAM">Instagram</option>
            <option value="TIKTOK">TikTok</option>
            <option value="YOUTUBE">YouTube</option>
          </Select>
          <label className="flex items-center gap-2 text-[13px] text-fg-muted">
            <input type="checkbox" checked={priced} onChange={(e) => setPriced(e.target.checked)} className="h-4 w-4 accent-[var(--color-fg)]" /> Fiyatı olanlar
          </label>
        </div>
        <p className="text-[13px] text-fg-passive" aria-live="polite">
          {list.length} içerik üreticisi · {sel.size} seçili
        </p>
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 2xl:grid-cols-3">
          {list.map((c) => {
            const on = sel.has(c.id);
            const from = c.rates.length ? Math.min(...c.rates.map((r) => r.priceKurus)) : null;
            return (
              <li key={c.id} className={cn("flex h-full flex-col overflow-hidden rounded-3xl border transition-standard", on ? "border-neon-pink bg-surface ring-1 ring-neon-pink/40" : "border-line bg-glass hover:border-line-strong")}>
                <button type="button" onClick={() => toggle(c.id)} aria-pressed={on} aria-label={`${c.name}: ${on ? "seçimi kaldır" : "teklif için seç"}`} className="flex flex-1 flex-col gap-3 p-4 text-left">
                  <span className="flex items-center gap-3">
                    <Avatar name={c.name} src={c.avatarUrl} size={48} />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate font-medium">{c.name}</span>
                      <span className="truncate text-[12px] text-fg-muted">
                        {c.primaryCategory}
                        {c.city ? ` · ${c.city}` : ""}
                      </span>
                      {c.headline ? <span className="line-clamp-1 text-[12px] text-fg">{c.headline}</span> : null}
                    </span>
                    <span className={cn("inline-flex h-6 w-6 items-center justify-center rounded-md border", on ? "border-neon-pink bg-neon-pink text-black" : "border-line-strong")} aria-hidden>
                      {on ? <CheckIcon size={14} /> : null}
                    </span>
                  </span>
                  <span className="flex flex-wrap gap-3 text-[12px] tabular-nums text-fg-muted">
                    {c.accounts.map((a) => (
                      <span key={a.platform} className="inline-flex items-center gap-1">
                        <PlatformIcon platform={a.platform} size={12} /> {compact.format(a.followers)} · {pct.format(a.er)}
                      </span>
                    ))}
                  </span>
                  <span className="mt-auto flex items-center justify-between border-t border-line pt-2 text-[12px]">
                    <span className="text-fg-muted">{c.rates.length ? `${c.rates.length} içerik fiyatı` : "Fiyat listesi yok"}</span>
                    {from != null ? <span className="font-semibold text-fg">{tl(from)}&apos;den başlayan</span> : null}
                  </span>
                </button>
                <Link href={`/marka/kesfet/${c.id}`} className="flex items-center justify-between border-t border-line px-4 py-2 text-[13px] text-fg-muted transition-standard hover:bg-surface-hover hover:text-fg">
                  Detaylı profil, iş birlikleri ve işler <span aria-hidden>→</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>

      <aside className="xl:sticky xl:top-24 xl:self-start">
        <div className="flex flex-col gap-4 rounded-3xl border border-line bg-surface/90 p-5 backdrop-blur">
          <h2 className="text-lg font-semibold">Teklif gönder</h2>
          {selected.length === 0 ? <p className="text-sm text-fg-muted">Soldan bir veya daha fazla içerik üreticisi seçin.</p> : null}
          {selected.length ? (
            <ul className="flex flex-wrap gap-2">
              {selected.map((c) => (
                <li key={c.id} className="inline-flex items-center gap-1 rounded-full border border-line py-0.5 pr-1 pl-2 text-[12px]">
                  {c.name} · {tl(estimate(c))}
                  <button type="button" onClick={() => toggle(c.id)} aria-label={`${c.name} kaldır`} className="inline-flex h-5 w-5 items-center justify-center rounded-full hover:bg-surface-hover">
                    <XIcon size={12} />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Başlık (ör. Yaz koleksiyonu tanıtımı)" aria-label="Teklif başlığı" maxLength={140} />
          <Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={4} placeholder="Mesajınız: ürün, beklenti, teslim, kullanım hakkı…" aria-label="Mesaj" maxLength={3000} />
          <div className="flex flex-col gap-2">
            <span className="text-label text-fg-muted">İçerikler</span>
            {items.map((it, i) => (
              <div key={i} className="grid grid-cols-[1fr_1.2fr_56px_auto] items-center gap-2">
                <Select value={it.platform} aria-label="Platform" onChange={(e) => setItems((x) => x.map((y, k) => (k === i ? { ...y, platform: e.target.value as Platform, contentType: optFor(e.target.value as Platform)[0]?.contentType ?? "" } : y)))}>
                  <option value="INSTAGRAM">Instagram</option>
                  <option value="TIKTOK">TikTok</option>
                  <option value="YOUTUBE">YouTube</option>
                </Select>
                <Select value={it.contentType} aria-label="İçerik türü" onChange={(e) => setItems((x) => x.map((y, k) => (k === i ? { ...y, contentType: e.target.value } : y)))}>
                  {optFor(it.platform).map((o) => (
                    <option key={o.contentType} value={o.contentType}>
                      {o.label}
                    </option>
                  ))}
                </Select>
                <Input type="number" min={1} max={20} value={it.qty} aria-label="Adet" onChange={(e) => setItems((x) => x.map((y, k) => (k === i ? { ...y, qty: Math.max(1, Number(e.target.value) || 1) } : y)))} />
                <button type="button" onClick={() => setItems((x) => (x.length > 1 ? x.filter((_, k) => k !== i) : x))} aria-label="Satırı sil" className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-fg-muted hover:bg-surface-hover">
                  <XIcon size={14} />
                </button>
                {!useRates ? <Input className="col-span-4" value={it.priceTl} onChange={(e) => setItems((x) => x.map((y, k) => (k === i ? { ...y, priceTl: e.target.value } : y)))} placeholder={`Birim fiyat (${cur})`} inputMode="decimal" aria-label="Birim fiyat" /> : null}
              </div>
            ))}
            <button type="button" onClick={() => setItems((x) => [...x, { platform: "TIKTOK", contentType: "VIDEO", qty: 1, priceTl: "" }])} className="w-fit text-[13px] text-fg-muted hover:text-fg">
              + İçerik ekle
            </button>
          </div>
          <label className="flex items-start gap-2 text-[13px] text-fg-muted">
            <input type="checkbox" checked={useRates} onChange={(e) => setUseRates(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[var(--color-fg)]" />
            Her üreticinin kendi fiyatını kullan (listesi olmayana aşağıdaki fiyat)
          </label>
          {useRates ? (
            <Input value={items[0]?.priceTl ?? ""} onChange={(e) => setItems((x) => x.map((y) => ({ ...y, priceTl: e.target.value })))} placeholder={`Listesi olmayanlar için birim fiyat (${cur})`} inputMode="decimal" aria-label="Varsayılan birim fiyat" />
          ) : null}
          <div className="grid grid-cols-2 gap-2">
            <Input type="date" value={publishBy} onChange={(e) => setPublishBy(e.target.value)} aria-label="En geç yayın tarihi" />
            <Select value={campaignId} onChange={(e) => setCampaignId(e.target.value)} aria-label="Kampanya (isteğe bağlı)">
              <option value="">Kampanya seçme</option>
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex items-center justify-between border-t border-line pt-3">
            <span className="text-[13px] text-fg-muted">Tahmini toplam</span>
            <span className="text-xl font-semibold tabular-nums">{tl(total)}</span>
          </div>
          <Button onClick={send} disabled={pending || sel.size === 0 || title.trim().length < 3 || message.trim().length < 10}>
            {pending ? "Gönderiliyor…" : `${sel.size || ""} teklif gönder`}
          </Button>
          {result ? (
            <p role="status" className={cn("text-[13px]", result.ok ? "text-neon-lime" : "text-critical")}>
              {result.text}
            </p>
          ) : null}
          <p className="text-[11px] text-fg-passive">Teklif 7 gün geçerlidir. Kabul edilince ajans kampanyaya ekler ve brief paylaşılır.</p>
        </div>
      </aside>
    </div>
  );
}
