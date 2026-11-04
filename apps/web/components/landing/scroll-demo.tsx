"use client";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";

const STEPS = [
  {
    tag: "1 · Brief",
    title: "Hedefi yaz, brief hazır",
    text: "Bütçe, tarih ve KPI ağırlıklarını gir. Hashtag, mention ve reklam açıklaması kuralları brief'e işlenir; her değişiklik yeni sürüm olarak saklanır.",
  },
  {
    tag: "2 · Influencer seçimi",
    title: "Doğru profili filtreyle bul",
    text: "Kategori, platform, takipçi ve etkileşime göre filtrele; birden çok kişiyi işaretleyip tek tıkla teklif gönder. Rakip marka çakışması otomatik engellenir.",
  },
  {
    tag: "3 · Onay ve yayın",
    title: "Yayından önce içeriği onayla",
    text: "Taslaklar panele düşer; marka ve ajans revizyon ister ya da onaylar. Story kareleri ve #reklam etiketi yayın öncesi kontrol edilir.",
  },
  {
    tag: "4 · Sonuçlar",
    title: "Sonuç ve ödeme tek ekranda",
    text: "Erişim, etkileşim ve kupon satışları kampanya skoruna dönüşür. Hakedişler oluşur, ödeme listesi ve marka raporu hazırlanır.",
  },
];

function Mock({ step }: { step: number }) {
  const box = "rounded-2xl border border-line bg-glass-strong p-4";
  if (step === 0)
    return (
      <div className="flex flex-col gap-3">
        <div className={box}>
          <p className="text-[11px] text-fg-passive uppercase">Kampanya</p>
          <p className="text-lg font-medium">Yaz koleksiyonu lansmanı</p>
          <div className="mt-3 grid grid-cols-3 gap-2 text-[12px]">
            {[
              ["Bütçe", "450.000 TL"],
              ["Süre", "21 gün"],
              ["Hedef", "Erişim %60"],
            ].map(([k, v]) => (
              <div key={k} className="rounded-xl bg-glass p-2">
                <p className="text-fg-passive">{k}</p>
                <p className="tabular-nums">{v}</p>
              </div>
            ))}
          </div>
        </div>
        <div className={cn(box, "flex flex-col gap-2 text-[13px]")}>
          {["#işbirliği etiketi zorunlu", "@marka mention", "Story: 3 kare, link çıkartması"].map((t, i) => (
            <p key={t} className="flex items-center gap-2 animate-enter" style={{ animationDelay: `${i * 150}ms` }}>
              <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-emerald-400/20 text-[10px] text-emerald-300">✓</span>
              {t}
            </p>
          ))}
        </div>
      </div>
    );
  if (step === 1)
    return (
      <div className="flex flex-col gap-2">
        {[
          ["@stil.defteri", "Moda", "690B", "%6,2", true],
          ["@guzellik.rutini", "Güzellik", "412B", "%6,8", true],
          ["@hareket.et", "Spor", "540B", "%7,5", false],
          ["@gezgin.not", "Seyahat", "320B", "%5,9", false],
        ].map(([h, n, f, e, on], i) => (
          <div key={String(h)} className={cn(box, "flex items-center gap-3 py-3 animate-enter", on && "border-neon-pink/50")} style={{ animationDelay: `${i * 120}ms` }}>
            <span className={cn("inline-flex h-5 w-5 items-center justify-center rounded-md border text-[11px]", on ? "border-fg bg-fg text-bg" : "border-line-strong")}>{on ? "✓" : ""}</span>
            <span className="h-8 w-8 rounded-full bg-gradient-to-br from-fuchsia-400 to-indigo-500" />
            <span className="flex flex-1 flex-col leading-tight">
              <span className="text-sm">{h}</span>
              <span className="text-[11px] text-fg-passive">{n}</span>
            </span>
            <span className="text-[12px] tabular-nums text-fg-muted">
              {f} · {e}
            </span>
          </div>
        ))}
        <div className="mt-1 rounded-xl bg-fg px-4 py-2 text-center text-[13px] font-medium text-bg">2 influencer ekle ve teklif gönder</div>
      </div>
    );
  if (step === 2)
    return (
      <div className="grid grid-cols-[120px_1fr] gap-3">
        <div className="aspect-[9/16] overflow-hidden rounded-2xl bg-gradient-to-br from-rose-500/70 via-fuchsia-600/50 to-indigo-700/70 animate-reel-pan" />
        <div className="flex flex-col gap-2 text-[13px]">
          <div className={box}>
            <p className="text-fg-passive text-[11px] uppercase">Taslak · Story 3 kare</p>
            <p>Sabah rutinimde yeni serum ✨ #işbirliği</p>
          </div>
          {[
            ["Reklam açıklaması", "Uygun", "text-emerald-300"],
            ["Mention", "Uygun", "text-emerald-300"],
            ["Kare 2 etiket", "Eksik", "text-amber-300"],
          ].map(([k, v, c], i) => (
            <p key={k} className="flex justify-between rounded-xl bg-glass px-3 py-2 animate-enter" style={{ animationDelay: `${i * 150}ms` }}>
              {k} <span className={c}>{v}</span>
            </p>
          ))}
          <div className="flex gap-2">
            <span className="flex-1 rounded-xl border border-line-strong px-3 py-2 text-center">Revizyon iste</span>
            <span className="flex-1 rounded-xl bg-fg px-3 py-2 text-center font-medium text-bg">Onayla</span>
          </div>
        </div>
      </div>
    );
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-3 gap-2">
        {[
          ["Erişim", "3,1M"],
          ["Etkileşim", "%6,2"],
          ["Skor", "%92"],
        ].map(([k, v]) => (
          <div key={k} className={box}>
            <p className="text-[11px] text-fg-passive">{k}</p>
            <p className="text-gradient text-2xl font-semibold tabular-nums">{v}</p>
          </div>
        ))}
      </div>
      <div className={cn(box, "flex h-32 items-end gap-2")}>
        {[30, 45, 40, 62, 58, 80, 74, 95].map((h, i) => (
          <span key={i} className="w-full origin-bottom rounded-t-md bg-gradient-to-t from-violet-500/40 to-fuchsia-400 animate-bar" style={{ height: `${h}%`, animationDelay: `${i * 90}ms` }} />
        ))}
      </div>
      <p className="flex justify-between rounded-xl bg-glass px-3 py-2 text-[13px]">
        Ödeme listesi hazır <span className="tabular-nums text-emerald-300">12 influencer · 318.000 TL</span>
      </p>
    </div>
  );
}

/** Kaydırdıkça ilerleyen demo: soldaki adımlar görünür oldukça sağdaki yapışkan ekran değişir. */
export function ScrollDemo() {
  const [active, setActive] = useState(0);
  const refs = useRef<(HTMLLIElement | null)[]>([]);
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActive(Number((e.target as HTMLElement).dataset.step));
      },
      { rootMargin: "-45% 0px -45% 0px" },
    );
    refs.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, []);
  return (
    <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
      <ol className="flex flex-col">
        {STEPS.map((s, i) => (
          <li
            key={s.tag}
            ref={(el) => {
              refs.current[i] = el;
            }}
            data-step={i}
            className={cn("flex min-h-[48vh] flex-col justify-center gap-3 border-l-2 py-10 pl-6 transition-colors duration-500 lg:min-h-[60vh]", i === active ? "border-neon-pink" : "border-line")}
          >
            <span className={cn("text-[12px] tracking-wide uppercase transition-colors", i === active ? "text-neon-pink" : "text-fg-passive")}>{s.tag}</span>
            <h3 className={cn("text-[28px] leading-tight font-semibold tracking-tight transition-colors", i === active ? "text-fg" : "text-fg-passive")}>{s.title}</h3>
            <p className={cn("max-w-md transition-colors", i === active ? "text-fg-muted" : "text-fg-passive")}>{s.text}</p>
            {/* Mobilde ekran adımın altında */}
            <div className="mt-4 rounded-3xl border border-line bg-glass p-5 lg:hidden" aria-hidden>
              <Mock step={i} />
            </div>
          </li>
        ))}
      </ol>
      <div className="hidden lg:block">
        <div className="sticky top-28">
          <div className="relative overflow-hidden rounded-[28px] border border-line bg-surface p-2">
            <div className="flex items-center gap-1.5 px-3 py-2" aria-hidden>
              <span className="h-2.5 w-2.5 rounded-full bg-line-strong" />
              <span className="h-2.5 w-2.5 rounded-full bg-line-strong" />
              <span className="h-2.5 w-2.5 rounded-full bg-line-strong" />
              <span className="ml-3 text-[11px] text-fg-passive">panel.infulancer · {STEPS[active]!.tag}</span>
            </div>
            <div className="h-1 overflow-hidden rounded-full bg-glass" aria-hidden>
              <div className="h-full bg-gradient-to-r from-fuchsia-400 to-sky-400 transition-all duration-700" style={{ width: `${((active + 1) / STEPS.length) * 100}%` }} />
            </div>
            <div key={active} className="min-h-[380px] p-5 animate-enter" aria-live="polite">
              <span className="sr-only">{STEPS[active]!.title}</span>
              <Mock step={active} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
