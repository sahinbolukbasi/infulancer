"use client";
import { useRef, useState, type KeyboardEvent } from "react";
import Link from "next/link";
import { RotatingWord } from "@/components/landing/motion";
import { cn } from "@/lib/cn";

export const AUDIENCES = [
  {
    id: "ajans",
    tab: "Ajanslar",
    eyebrow: "Influencer ajansları için operasyon merkezi",
    title: "Tüm müşteri kampanyalarınız",
    words: ["tek panelde.", "zamanında.", "kârlı."],
    text: "Markaları, içerik üreticilerini, sözleşmeleri, yayın takvimini ve ödemeleri tek yerden yönetin. Her kampanyanın skoru, maliyeti ve brüt farkı anlık görünür.",
    bullets: ["Çoklu influencer ataması ve teklif takibi", "Hakediş, ödeme listesi ve marka tahsilatı", "Ekip için düzenlenebilir pano ve agent uyarıları"],
    cta: { href: "/giris", label: "Ajans paneline giriş" },
    alt: { href: "#nasil", label: "Demoyu kaydırarak izle" },
  },
  {
    id: "marka",
    tab: "Markalar",
    eyebrow: "Markalar için şeffaf influencer kampanyası",
    title: "Kampanyanızı canlı izleyin,",
    words: ["sonucu ölçün.", "içeriği onaylayın.", "bütçeyi koruyun."],
    text: "Yayından önce içerikleri onaylayın, rakip marka çakışmalarından korunun. Erişim, etkileşim ve kupon satışları kampanya skoruna dönüşür; rapor hazır gelir.",
    bullets: ["Taslak onayı ve revizyon tek tıkla", "#reklam ve md. 23/A kontrolü yayın öncesi", "WhatsApp ve Instagram DM gelen kutusu"],
    cta: { href: "/giris", label: "Marka paneline giriş" },
    alt: { href: "#referanslar", label: "Marka sonuçlarını gör" },
  },
  {
    id: "influencer",
    tab: "İçerik üreticileri",
    eyebrow: "İçerik üreticileri için iş ve ödeme takibi",
    title: "Markalarla çalış,",
    words: ["kazancını takip et.", "brief'i kaçırma.", "ödemeni al."],
    text: "Teklifleri kabul et, brief'i ve teslim tarihlerini tek yerde gör. Takipçi verilerin resmî API'lerden güncellenir; hakedişini ve ödeme talebini panelden yönet.",
    bullets: ["Teklif, brief ve yayın takvimi", "Hakediş ve çekim talebi", "Instagram, TikTok, YouTube hesap bağlantısı"],
    cta: { href: "/kayit", label: "Davet koduyla katıl" },
    alt: { href: "/giris", label: "Hesabım var, giriş yap" },
  },
] as const;

/** Hero: Ajans / Marka / İçerik üreticisi bölümlemesi — sekme değişince başlık, metin ve çağrılar değişir. */
export function AudienceHero() {
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const a = AUDIENCES[active]!;
  const onKey = (e: KeyboardEvent) => {
    let n = active;
    if (e.key === "ArrowRight") n = (active + 1) % AUDIENCES.length;
    else if (e.key === "ArrowLeft") n = (active - 1 + AUDIENCES.length) % AUDIENCES.length;
    else return;
    e.preventDefault();
    setActive(n);
    listRef.current?.querySelectorAll<HTMLButtonElement>("[role=tab]")[n]?.focus();
  };
  return (
    <div className="flex flex-col gap-7">
      <div ref={listRef} role="tablist" aria-label="Kimin için" onKeyDown={onKey} className="relative inline-flex w-fit rounded-full border border-line bg-glass p-1 backdrop-blur">
        <span
          aria-hidden
          className="bg-neon neon-glow absolute top-1 bottom-1 rounded-full transition-all duration-500 ease-out"
          style={{ left: `calc(${(active * 100) / AUDIENCES.length}% + 4px)`, width: `calc(${100 / AUDIENCES.length}% - 8px)` }}
        />
        {AUDIENCES.map((x, i) => (
          <button
            key={x.id}
            type="button"
            role="tab"
            id={`aud-tab-${x.id}`}
            aria-selected={i === active}
            aria-controls="aud-panel"
            tabIndex={i === active ? 0 : -1}
            onClick={() => setActive(i)}
            className={cn("relative z-10 min-w-[110px] rounded-full px-4 py-2 text-[13px] font-medium transition-colors duration-300", i === active ? "text-black" : "text-fg-muted hover:text-fg")}
          >
            {x.tab}
          </button>
        ))}
      </div>
      <div id="aud-panel" role="tabpanel" aria-labelledby={`aud-tab-${a.id}`} key={a.id} className="flex flex-col gap-6 animate-enter">
        <span className="inline-flex w-fit items-center gap-2 rounded-full border border-line bg-glass px-3 py-1 text-[12px] text-fg-muted">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full rounded-full bg-neon-lime animate-ping-slow" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-neon-lime" />
          </span>
          {a.eyebrow}
        </span>
        <h1 className="text-[44px] leading-[1.03] font-semibold tracking-[-0.03em] sm:text-[64px]">
          {a.title}
          <br />
          <span className="neon-text">
            <RotatingWord words={[...a.words]} />
          </span>
        </h1>
        <p className="max-w-xl text-lg leading-relaxed text-fg-muted">{a.text}</p>
        <ul className="flex flex-col gap-2 text-[15px]">
          {a.bullets.map((b, i) => (
            <li key={b} className="flex items-center gap-3 animate-enter" style={{ animationDelay: `${120 + i * 90}ms` }}>
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-neon-lime/15 text-[11px] text-neon-lime">✓</span>
              {b}
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap gap-3">
          <Link
            href={a.cta.href}
            className="bg-neon neon-glow inline-flex h-12 items-center justify-center rounded-full px-7 text-[15px] font-semibold text-black transition-transform duration-300 hover:scale-[1.04] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-neon-pink"
          >
            {a.cta.label} →
          </Link>
          <a
            href={a.alt.href}
            className="inline-flex h-12 items-center justify-center rounded-full border border-line-strong bg-glass px-7 text-[15px] text-fg backdrop-blur transition-standard hover:border-neon-cyan hover:text-fg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-neon-pink"
          >
            {a.alt.label}
          </a>
        </div>
      </div>
    </div>
  );
}
