import type { ReactNode } from "react";
import Link from "next/link";
import { CountUp, Reveal, RevealRoot, Spotlight, Tilt } from "@/components/landing/motion";
import { ReelCard } from "@/components/landing/reel-card";
import { ScrollDemo } from "@/components/landing/scroll-demo";
import { AudienceHero } from "@/components/landing/audience-hero";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { BrandBadge, BrandLogo, type BrandLogoName } from "@/components/icons/brand-logos";
import { LANDING_FEATURES, type LandingReference, type LandingVideo } from "@/lib/landing-content";
import { cn } from "@/lib/cn";
import { BRAND_NAME } from "@/lib/brand";

export type LandingStats = { influencers: number; followers: number; campaigns: number; published: number };

/** Parlayan kenarlı ana buton */
function GlowButton({ href, children, className }: { href: string; children: ReactNode; className?: string }) {
  return (
    <Link
      href={href}
      className={cn(
        "group relative inline-flex h-12 items-center justify-center overflow-hidden rounded-full px-7 text-[15px] font-medium text-fg transition-transform duration-300 hover:scale-[1.03] hover:text-black neon-glow focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-neon-pink",
        className,
      )}
    >
      <span aria-hidden className="absolute inset-0 bg-[linear-gradient(90deg,#ff2bd6,#9d4dff,#00e5ff,#a3ff12,#ff2bd6)] bg-[length:300%_100%] animate-gradient-x" />
      <span aria-hidden className="absolute inset-[2px] rounded-full bg-canvas/90 transition-opacity duration-300 group-hover:opacity-0" />
      <span className="relative">{children}</span>
    </Link>
  );
}

function GhostButton({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      className="inline-flex h-12 items-center justify-center rounded-full border border-line-strong bg-glass px-7 text-[15px] text-fg backdrop-blur transition-standard hover:border-line-strong hover:bg-surface-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-neon-pink"
    >
      {children}
    </a>
  );
}

/** Hero'da reel kartlarının etrafında yüzen bildirimler */
function FloatChip({ className, dot, children, delay = 0 }: { className?: string; dot: string; children: ReactNode; delay?: number }) {
  return (
    <div
      aria-hidden
      className={cn("absolute z-20 flex items-center gap-2 rounded-2xl border border-line bg-glass-strong px-3 py-2 text-[12px] text-fg backdrop-blur-md animate-pop", className)}
      style={{ animationDelay: `${delay}ms` }}
    >
      <span className="relative flex h-2 w-2">
        <span className={cn("absolute inline-flex h-full w-full rounded-full animate-ping-slow", dot)} />
        <span className={cn("relative inline-flex h-2 w-2 rounded-full", dot)} />
      </span>
      {children}
    </div>
  );
}

function SectionTitle({ eyebrow, title, text }: { eyebrow: string; title: ReactNode; text?: string }) {
  return (
    <Reveal className="mb-12 flex flex-col items-center gap-4 text-center">
      <span className="rounded-full border border-line bg-glass px-3 py-1 text-[12px] tracking-wide text-fg-muted uppercase">{eyebrow}</span>
      <h2 className="max-w-3xl text-[34px] leading-tight font-semibold tracking-tight sm:text-[48px]">{title}</h2>
      {text ? <p className="max-w-2xl text-fg-muted">{text}</p> : null}
    </Reveal>
  );
}

/** Özellik kutularındaki küçük canlı görseller */
function FeatureVisual({ i }: { i: number }) {
  if (i === 0)
    return (
      <div aria-hidden className="flex h-24 items-end gap-2">
        {[40, 65, 50, 85, 70, 100, 90].map((h, k) => (
          <span key={k} className="w-full origin-bottom rounded-t-md bg-gradient-to-t from-violet-500/40 to-fuchsia-400 animate-bar" style={{ height: `${h}%`, animationDelay: `${k * 120}ms` }} />
        ))}
      </div>
    );
  if (i === 1)
    return (
      <div aria-hidden className="relative flex h-24 items-center justify-center">
        <span className="absolute h-20 w-20 rounded-full border border-dashed border-sky-400/50 animate-spin-slow" />
        <span className="absolute h-12 w-12 rounded-full bg-sky-400/20 animate-ping-slow" />
        <span className="relative text-2xl font-semibold text-sky-300">+18%</span>
      </div>
    );
  if (i === 2)
    return (
      <ul aria-hidden className="flex h-24 flex-col justify-center gap-2 text-[12px]">
        {["#reklam etiketi", "İYS onayı", "KVKK kaydı"].map((t, k) => (
          <li key={t} className="flex items-center gap-2 text-emerald-300">
            <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-emerald-400/20 animate-pop" style={{ animationDelay: `${k * 400}ms` }}>
              ✓
            </span>
            {t}
          </li>
        ))}
      </ul>
    );
  if (i === 3)
    return (
      <div aria-hidden className="flex h-24 flex-col justify-center gap-2 text-[12px]">
        <span className="w-fit rounded-2xl rounded-bl-sm bg-surface-hover px-3 py-1.5">Kampanya kodu nedir?</span>
        <span className="ml-auto w-fit rounded-2xl rounded-br-sm bg-violet-500/30 px-3 py-1.5">
          Yazıyor<span className="animate-blink">…</span>
        </span>
      </div>
    );
  if (i === 4)
    return (
      <div aria-hidden className="flex h-24 flex-col justify-center gap-2">
        {[80, 55, 92].map((w, k) => (
          <span key={k} className="h-2 overflow-hidden rounded-full bg-surface-hover">
            <span className="block h-full origin-left rounded-full bg-gradient-to-r from-amber-400 to-rose-400 animate-fill" style={{ width: `${w}%`, animationDelay: `${k * 200}ms` }} />
          </span>
        ))}
      </div>
    );
  return (
    <div aria-hidden className="relative flex h-24 items-center justify-center">
      <svg viewBox="0 0 120 60" className="h-full w-full">
        <path d="M0 50 C 20 45, 30 20, 50 28 S 80 10, 120 6" fill="none" stroke="url(#lg)" strokeWidth="3" strokeLinecap="round" pathLength={100} strokeDasharray="100" className="animate-draw" />
        <defs>
          <linearGradient id="lg" x1="0" x2="1">
            <stop offset="0" stopColor="#60a5fa" />
            <stop offset="1" stopColor="#f0abfc" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}

const INTEGRATIONS: { name: string; kind: string; text: string; tone: string; soon?: boolean; logo?: BrandLogoName }[] = [
  { name: "Instagram", logo: "instagram", kind: "Sosyal medya", text: "Business Discovery ile takipçi ve etkileşim; DM gelen kutusu.", tone: "from-pink-500 to-amber-400" },
  { name: "TikTok", logo: "tiktok", kind: "Sosyal medya", text: "Üretici TikTok hesabıyla bağlanır; profil ve video istatistikleri doğrudan okunur.", tone: "from-zinc-700 to-cyan-500" },
  { name: "YouTube", logo: "youtube", kind: "Sosyal medya", text: "YouTube Data API ile abone, video ve izlenme verisi otomatik güncellenir.", tone: "from-red-600 to-rose-400" },
  { name: "WhatsApp", logo: "whatsapp", kind: "Mesajlaşma", text: "Cloud API ile gelen kutusu, şablon mesajlar ve AI asistan; İYS onayı kontrol edilir.", tone: "from-emerald-600 to-lime-400" },
  { name: "UTM ve kupon", logo: "googleanalytics", kind: "Analitik", text: "Her kampanyaya UTM etiketi ve influencer başına kupon kodu; satışlar skora işlenir.", tone: "from-sky-600 to-indigo-400" },
  { name: "İYS ve KVKK", kind: "Uyum", text: "Ticari ileti onayları, yurt dışı aktarım kayıtları ve saklama süreleri takip edilir.", tone: "from-slate-600 to-slate-400" },
  { name: "Meta ortaklık reklamları", logo: "meta", kind: "Reklam", text: "Üreticinin içeriğini onun adıyla ortaklık reklamı olarak yayınlayın.", tone: "from-blue-600 to-violet-400", soon: true },
  { name: "TikTok Spark Ads", logo: "tiktok", kind: "Reklam", text: "Üreticinin videosunu kendi hesabından Spark Ads ile öne çıkarın.", tone: "from-fuchsia-600 to-cyan-400", soon: true },
];
const SEGMENTS = [
  {
    badgeText: "Ajanslar",
    title: "Operasyonu ölçeklendirin",
    text: "Onlarca markayı ve yüzlerce içerik üreticisini aynı ekipte, aynı kurallarla yönetin.",
    items: ["Marka profili: geçmiş kampanyalar, tahsilat, brüt fark", "Çoklu atama, sözleşme ve münhasırlık", "Kullanıcı, rol ve davet yönetimi"],
    href: "/giris",
    cta: "Ajans paneli",
    badge: "bg-neon-pink",
    dot: "bg-neon-pink",
    blob: "bg-neon-pink",
    glow: "hover:neon-glow",
  },
  {
    badgeText: "Markalar",
    title: "Kontrol sizde kalsın",
    text: "Hangi içeriğin ne zaman yayınlanacağını görün, onaylayın ve sonuçları raporlayın.",
    items: ["Taslak onayı, revizyon, yayın takvimi", "Kampanya skoru ve PDF rapor", "Gelen kutusu, asistanlar, İYS ve KVKK"],
    href: "/giris",
    cta: "Marka paneli",
    badge: "bg-neon-cyan",
    dot: "bg-neon-cyan",
    blob: "bg-neon-cyan",
    glow: "hover:neon-glow-cyan",
  },
  {
    badgeText: "İçerik üreticileri",
    title: "İşine odaklan",
    text: "Teklifler, brief'ler, teslim tarihleri ve ödemeler tek yerde; takipçi verilerin otomatik güncellenir.",
    items: ["Teklif kabul/red ve brief", "Hakediş ve çekim talebi", "Davet kodu ile başka üreticileri davet"],
    href: "/kayit",
    cta: "Davet koduyla katıl",
    badge: "bg-neon-lime",
    dot: "bg-neon-lime",
    blob: "bg-neon-lime",
    glow: "hover:neon-glow-cyan",
  },
];
const FAQ = [
  { q: "Kimler üye olabilir?", a: "Üyelik davetle açılır. Ajans marka ve içerik üreticisi davet eder; içerik üreticileri de sınırlı sayıda başka üreticiyi davet edebilir. Her başvuru ajans onayından sonra etkinleşir." },
  { q: "Takipçi ve etkileşim verileri nereden geliyor?", a: "Instagram, TikTok ve YouTube'un resmî API'lerinden. Kazıma (scraping) yapılmaz; hesap bağlanmadıysa elle girilen değerler korunur." },
  { q: "Reklam açıklaması ve yasal uyum nasıl sağlanıyor?", a: "Yayın öncesi içerikte #reklam/#işbirliği etiketi, story kareleri ve platform açıklama ayarları kontrol edilir. WhatsApp iletileri için İYS onayı, yurt dışı aktarım için KVKK kayıtları tutulur." },
  { q: "İçerik üreticisine ödeme nasıl yapılıyor?", a: "Yayınlanan ve onaylanan işler hakediş oluşturur. İçerik üreticisi çekim talebi açar; ajans onaylayıp ödeme listesine alır. Vergi profiline göre kesintiler hesaplanır." },
  { q: "Verilerim güvende mi?", a: "Veriler AWS Frankfurt bölgesinde şifreli tutulur; erişim anahtarları Secrets Manager'dadır. Denetim kaydı değiştirilemez ve her işlem kimin yaptığıyla saklanır." },
];
const FEATURE_TONES = [
  "from-violet-500/20",
  "from-sky-500/20",
  "from-emerald-500/20",
  "from-fuchsia-500/20",
  "from-amber-500/20",
  "from-blue-500/20",
];
const BENTO = ["md:col-span-4", "md:col-span-2", "md:col-span-2", "md:col-span-2", "md:col-span-2", "md:col-span-6"];

/** Herkese açık tanıtım sayfası. */
export type LandingData = {
  videos: LandingVideo[];
  references: (LandingReference & { logo?: string })[];
  creators: { handle: string; niche: string; followers: string; tone: string; platform: string; city: string; engagement: string; brand: string }[];
};
export function LandingPage({ stats, data }: { stats: LandingStats; data: LandingData }) {
  const vid = (i: number) => data.videos[i % data.videos.length]!;
  const statItems = [
    { label: "Influencer", value: stats.influencers },
    { label: "Toplam takipçi", value: stats.followers },
    { label: "Kampanya", value: stats.campaigns },
    { label: "Yayınlanan içerik", value: stats.published },
  ];
  const creators = [...data.creators, ...data.creators];
  return (
    <RevealRoot className="min-h-screen overflow-x-clip bg-canvas text-fg">
      {/* İlk boyamadan önce: kaydırma animasyonları JS varken etkin (JS yoksa içerik görünür kalır). */}
      <script dangerouslySetInnerHTML={{ __html: "document.documentElement.classList.add('js-reveal')" }} />
      <a href="#icerik" className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded focus:bg-fg focus:px-3 focus:py-2 focus:text-bg">
        İçeriğe geç
      </a>

      {/* Üst menü */}
      <header className="fixed inset-x-0 top-4 z-50 px-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 rounded-full border border-line bg-glass-strong py-2 pr-2 pl-5 backdrop-blur-xl">
          <Link href="/" className="flex items-center gap-2 text-[17px] font-semibold tracking-tight">
            <span aria-hidden className="h-6 w-6 rounded-lg bg-[conic-gradient(from_180deg,#ff2bd6,#9d4dff,#00e5ff,#a3ff12,#ff2bd6)] animate-spin-slow" />
            {BRAND_NAME}
          </Link>
          <nav aria-label="Tanıtım" className="hidden gap-7 text-sm text-fg-muted md:flex">
            {[
              ["#kimler-icin", "Kimler için"],
              ["#ureticiler", "Üreticiler"],
              ["#nasil", "Nasıl çalışır"],
              ["#entegrasyonlar", "Entegrasyonlar"],
              ["#referanslar", "Referanslar"],
            ].map(([h, l]) => (
              <a key={h} href={h} className="transition-standard hover:text-fg">
                {l}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link href="/giris" className="inline-flex h-9 items-center rounded-full bg-fg px-4 text-sm font-medium text-bg transition-transform hover:scale-105">
              Giriş yap
            </Link>
          </div>
        </div>
      </header>

      <main id="icerik">
        {/* HERO */}
        <Spotlight className="relative isolate overflow-hidden">
          <div aria-hidden className="absolute inset-0 -z-10">
            <div className="bg-grid absolute inset-0 [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)]" />
            <div className="absolute -top-40 -left-32 h-[520px] w-[520px] rounded-full bg-fuchsia-600/30 blur-[120px] animate-aurora" />
            <div className="absolute top-20 -right-40 h-[560px] w-[560px] rounded-full bg-indigo-600/30 blur-[120px] animate-aurora [animation-delay:-6s]" />
            <div className="absolute -bottom-40 left-1/3 h-[420px] w-[420px] rounded-full bg-emerald-500/20 blur-[120px] animate-aurora [animation-delay:-12s]" />
          </div>
          <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-16 px-6 pt-36 pb-24 lg:grid-cols-[1.1fr_1fr] lg:pt-44">
            <div className="flex flex-col gap-7">
              <AudienceHero />
              <Reveal delay={320}>
                <dl className="mt-2 grid grid-cols-2 gap-6 border-t border-line pt-6 sm:grid-cols-4">
                  {statItems.map((s) => (
                    <div key={s.label} className="flex flex-col gap-1">
                      <dt className="text-[12px] text-fg-passive">{s.label}</dt>
                      <dd className="text-[28px] font-semibold">
                        <CountUp value={s.value} />
                      </dd>
                    </div>
                  ))}
                </dl>
              </Reveal>
            </div>

            <Reveal delay={200} className="relative mx-auto h-[560px] w-full max-w-[460px]">
              <div aria-hidden className="absolute inset-10 rounded-full bg-[conic-gradient(from_0deg,#ff2bd633,#00e5ff33,#a3ff1233,#ff2bd633)] blur-2xl animate-spin-slow" />
              <div className="absolute top-16 left-0 z-10 w-[46%] -rotate-6">
                <Tilt>
                  <ReelCard video={vid(0)} />
                </Tilt>
              </div>
              <div className="absolute top-0 left-1/2 z-20 w-[50%] -translate-x-1/2">
                <Tilt>
                  <ReelCard video={vid(1)} delay={1200} className="ring-1 ring-line-strong" />
                </Tilt>
              </div>
              <div className="absolute top-20 right-0 z-10 w-[46%] rotate-6">
                <Tilt>
                  <ReelCard video={vid(2)} delay={2400} />
                </Tilt>
              </div>
              <FloatChip className="top-6 -left-2" dot="bg-fuchsia-400">
                +12,4B beğeni
              </FloatChip>
              <FloatChip className="top-[46%] -right-4" dot="bg-emerald-400" delay={900}>
                Teklif kabul edildi
              </FloatChip>
              <FloatChip className="bottom-10 left-6" dot="bg-sky-400" delay={1800}>
                Ödeme gönderildi · 45.000 TL
              </FloatChip>
            </Reveal>
          </div>
        </Spotlight>

        {/* Kayan içerik üreticileri */}
        <section aria-label="Platformdaki içerik üreticileri" className="relative border-y border-line py-8 [mask-image:linear-gradient(90deg,transparent,black_10%,black_90%,transparent)]">
          {[false, true].map((rev) => (
            <div key={String(rev)} className={cn("flex w-max gap-4", rev ? "mt-4 animate-marquee-reverse" : "animate-marquee")} aria-hidden={rev || undefined}>
              {creators.map((c, k) => (
                <div key={`${c.handle}-${k}`} className="flex items-center gap-3 rounded-full border border-line bg-glass py-2 pr-5 pl-2" aria-hidden={k >= data.creators.length || undefined}>
                  <span className={cn("h-9 w-9 rounded-full bg-gradient-to-br", c.tone)} />
                  <span className="flex flex-col leading-tight">
                    <span className="text-sm text-fg">{c.handle}</span>
                    <span className="text-[11px] text-fg-passive">
                      {c.niche} · {c.followers} takipçi
                    </span>
                  </span>
                </div>
              ))}
            </div>
          ))}
        </section>

        {/* Kimler için: ajans / marka / içerik üreticisi */}
        <section id="kimler-icin" className="mx-auto max-w-6xl px-6 pt-28">
          <SectionTitle eyebrow="Kimler için" title="Üç taraf, tek platform" text="Her rol yalnız kendi ihtiyacını görür; veriler aynı kaynaktan gelir." />
          <ul className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            {SEGMENTS.map((g, i) => (
              <Reveal as="li" key={g.title} delay={i * 120}>
                <Tilt max={6} className="h-full">
                  <div className={cn("group relative flex h-full flex-col gap-5 overflow-hidden rounded-3xl border border-line bg-glass p-7 transition-all duration-300 hover:border-transparent", g.glow)}>
                    <div aria-hidden className={cn("absolute -top-24 -right-24 h-56 w-56 rounded-full opacity-40 blur-3xl transition-opacity duration-500 group-hover:opacity-80", g.blob)} />
                    <span className={cn("relative w-fit rounded-full px-3 py-1 text-[12px] font-semibold text-black", g.badge)}>{g.badgeText}</span>
                    <h3 className="relative text-[26px] leading-tight font-semibold tracking-tight">{g.title}</h3>
                    <p className="relative text-sm leading-relaxed text-fg-muted">{g.text}</p>
                    <ul className="relative flex flex-col gap-2 text-[14px]">
                      {g.items.map((it) => (
                        <li key={it} className="flex items-start gap-2">
                          <span className={cn("mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full", g.dot)} />
                          {it}
                        </li>
                      ))}
                    </ul>
                    <Link href={g.href} className="relative mt-auto inline-flex w-fit items-center gap-1 text-sm font-medium text-fg underline-offset-4 hover:underline">
                      {g.cta} →
                    </Link>
                  </div>
                </Tilt>
              </Reveal>
            ))}
          </ul>
        </section>

        {/* İçerik üreticileri */}
        <section id="ureticiler" className="mx-auto max-w-6xl px-6 pt-28">
          <SectionTitle eyebrow="Platformdaki içerik üreticileri" title="Markana uygun profili keşfet" text="Takipçi, etkileşim, şehir ve kategoriye göre karşılaştır; birlikte çalıştığı markaları gör." />
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {data.creators.slice(0, 8).map((c, i) => (
              <Reveal as="li" key={`${c.handle}-${i}`} delay={(i % 4) * 90}>
                <Tilt max={8} className="h-full">
                  <div className="group flex h-full flex-col gap-4 rounded-3xl border border-line bg-glass p-5 transition-colors duration-300 hover:border-line-strong">
                    <div className="flex items-center gap-3">
                      <span className="relative">
                        <span aria-hidden className={cn("block h-12 w-12 rounded-full bg-gradient-to-br ring-2 ring-line-strong", c.tone)} />
                        <span aria-hidden className="absolute -right-1 -bottom-1 h-4 w-4 rounded-full border-2 border-canvas bg-emerald-400" />
                      </span>
                      <span className="flex min-w-0 flex-col leading-tight">
                        <span className="truncate text-sm font-medium">{c.handle}</span>
                        <span className="flex items-center gap-1.5 text-[12px] text-fg-passive">
                          <BrandLogo name={c.platform === "TikTok" ? "tiktok" : c.platform === "YouTube" ? "youtube" : "instagram"} size={12} />
                          {[c.platform, c.city].filter(Boolean).join(" · ")}
                        </span>
                      </span>
                    </div>
                    <span className="w-fit rounded-full border border-line px-2.5 py-0.5 text-[11px] text-fg-muted">{c.niche}</span>
                    <dl className="mt-auto grid grid-cols-2 gap-2 border-t border-line pt-3">
                      <div>
                        <dt className="text-[11px] text-fg-passive">Takipçi</dt>
                        <dd className="text-lg font-semibold tabular-nums">{c.followers}</dd>
                      </div>
                      <div>
                        <dt className="text-[11px] text-fg-passive">Etkileşim</dt>
                        <dd className="text-gradient text-lg font-semibold tabular-nums">{c.engagement || "—"}</dd>
                      </div>
                    </dl>
                    {c.brand ? <p className="text-[12px] text-fg-muted">Çalıştığı marka: {c.brand}</p> : null}
                  </div>
                </Tilt>
              </Reveal>
            ))}
          </ul>
        </section>

        {/* Video vitrini */}
        <section id="icerikler" className="relative mx-auto max-w-6xl px-6 py-28">
          <SectionTitle
            eyebrow="Kampanyalardan içerikler"
            title={
              <>
                Planlandı, onaylandı, <span className="text-gradient">ölçüldü.</span>
              </>
            }
            text="Reels, TikTok ve YouTube içerikleri tek akışta: brief, taslak onayı, reklam açıklaması kontrolü ve yayın sonrası metrikler."
          />
          <div className="grid grid-cols-2 gap-5 md:grid-cols-4">
            {data.videos.map((v, i) => (
              <Reveal key={`${v.handle}-${i}`} delay={i * 120} className={cn(i % 2 === 1 && "md:mt-12")}>
                <Tilt max={14}>
                  <ReelCard video={v} delay={i * 700} />
                </Tilt>
              </Reveal>
            ))}
          </div>
        </section>

        {/* Nasıl çalışır — kaydırdıkça ilerleyen demo */}
        <section id="nasil" className="relative py-28">
          <div aria-hidden className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_center,rgba(99,102,241,0.12),transparent_60%)]" />
          <div className="mx-auto max-w-6xl px-6">
            <SectionTitle eyebrow="Nasıl çalışır · kaydırdıkça demo ilerler" title="Brief'ten sonuca bir kampanya" text="Bir kampanyanın panelde nasıl ilerlediğini adım adım görün." />
            <ScrollDemo />
          </div>
        </section>

        {/* Entegrasyonlar */}
        <section id="entegrasyonlar" className="mx-auto max-w-6xl px-6 py-28">
          <SectionTitle eyebrow="Entegrasyonlar" title="Kullandığın kanallarla çalışır" text="Veriler resmî API'lerden okunur; ekran görüntüsü toplamaya gerek kalmaz." />
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {INTEGRATIONS.map((it, i) => (
              <Reveal as="li" key={it.name} delay={(i % 4) * 80}>
                <div className="group flex h-full flex-col gap-3 rounded-3xl border border-line bg-glass p-5 transition-all duration-300 hover:-translate-y-1 hover:border-line-strong hover:bg-glass">
                  <div className="flex items-center justify-between gap-2">
                    {it.logo ? (
                      <BrandBadge name={it.logo} size={44} className="transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-3" />
                    ) : (
                      <span className={cn("inline-flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br text-white transition-transform duration-300 group-hover:scale-110", it.tone)} aria-hidden>
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 3 4.5 6v5.5c0 4.5 3.2 8.4 7.5 9.5 4.3-1.1 7.5-5 7.5-9.5V6Z" />
                          <path d="m8.8 12.2 2.2 2.2 4.4-4.6" />
                        </svg>
                      </span>
                    )}
                    <span className={cn("rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide", it.soon ? "border border-neon-amber/50 text-neon-amber" : "bg-surface-hover text-fg-muted")}>
                      {it.soon ? "Erken erişim" : it.kind}
                    </span>
                  </div>
                  <h3 className="font-medium">{it.name}</h3>
                  <p className="text-[13px] leading-relaxed text-fg-muted">{it.text}</p>
                </div>
              </Reveal>
            ))}
          </ul>
        </section>

        {/* Özellikler (bento) */}
        <section id="ozellikler" className="mx-auto max-w-6xl px-6 py-28">
          <SectionTitle eyebrow="Özellikler" title="Tek panelde her şey" text="Ajans, marka ve içerik üreticisi aynı veriye bakar; kimse e-posta ve Excel arasında kaybolmaz." />
          <ul className="grid grid-cols-1 gap-4 md:grid-cols-6">
            {LANDING_FEATURES.map((f, i) => (
              <Reveal as="li" key={f.title} delay={(i % 3) * 100} className={BENTO[i]}>
                <Tilt max={4} className="h-full">
                  <div
                    className={cn(
                      "group relative flex h-full flex-col gap-4 overflow-hidden rounded-3xl border border-line bg-gradient-to-br to-transparent p-6 transition-colors duration-300 hover:border-line-strong",
                      FEATURE_TONES[i],
                    )}
                  >
                    <div
                      aria-hidden
                      className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                      style={{ background: "radial-gradient(400px circle at var(--mx, 50%) var(--my, 50%), rgba(255,255,255,0.08), transparent 40%)" }}
                    />
                    <FeatureVisual i={i} />
                    <h3 className="text-lg font-medium">{f.title}</h3>
                    <p className="text-sm leading-relaxed text-fg-muted">{f.text}</p>
                  </div>
                </Tilt>
              </Reveal>
            ))}
          </ul>
        </section>

        {/* Referanslar */}
        {data.references.length > 0 ? (
        <section id="referanslar" className="relative py-28">
          <div aria-hidden className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_bottom,rgba(255,43,214,0.16),transparent_60%)]" />
          <div className="mx-auto max-w-6xl px-6">
            <SectionTitle eyebrow="Referanslar" title="Markalar sonuçla konuşuyor" />
            <ul className="grid grid-cols-1 gap-5 lg:grid-cols-3">
              {data.references.map((r, i) => (
                <Reveal as="li" key={`${r.brand}-${i}`} delay={i * 140}>
                  <Tilt max={6} className="h-full">
                    <figure className="relative flex h-full flex-col gap-5 overflow-hidden rounded-3xl border border-line bg-glass p-7 backdrop-blur">
                      <span aria-hidden className="absolute -top-6 right-4 text-[120px] leading-none text-fg/5">
                        “
                      </span>
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          {r.logo ? (
                            // eslint-disable-next-line @next/next/no-img-element -- admin tarafından girilen harici logo adresi
                            <img src={r.logo} alt={`${r.brand} logosu`} className="h-10 w-10 rounded-xl bg-white object-contain p-1" loading="lazy" />
                          ) : (
                            <span aria-hidden className={cn("h-10 w-10 rounded-xl bg-gradient-to-br", ["from-rose-400 to-fuchsia-600", "from-sky-400 to-indigo-600", "from-amber-400 to-red-600"][i % 3])} />
                          )}
                          <div className="flex flex-col">
                            <span className="font-medium">{r.brand}</span>
                            <span className="text-[12px] text-fg-passive">{r.sector}</span>
                          </div>
                        </div>
                        {r.sample ? <span className="rounded-full border border-line-strong px-2 py-0.5 text-[11px] text-fg-muted">Örnek çalışma</span> : null}
                      </div>
                      <blockquote className="relative text-[16px] leading-relaxed">{r.quote}</blockquote>
                      <figcaption className="text-[13px] text-fg-muted">— {r.person}</figcaption>
                      <dl className="mt-auto grid grid-cols-3 gap-3 border-t border-line pt-5">
                        {r.results.map((x) => (
                          <div key={x.label} className="flex flex-col gap-1">
                            <dt className="text-[11px] text-fg-passive">{x.label}</dt>
                            <dd className="text-gradient text-xl font-semibold tabular-nums">{x.value}</dd>
                          </div>
                        ))}
                      </dl>
                    </figure>
                  </Tilt>
                </Reveal>
              ))}
            </ul>
          </div>
        </section>
        ) : null}

        {/* Karşılaştırma */}
        <section className="mx-auto max-w-5xl px-6 py-28">
          <SectionTitle eyebrow={`Neden ${BRAND_NAME}`} title="Kampanyanın her adımı tek yerde" />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Reveal className="rounded-3xl border border-line bg-glass p-7">
              <h3 className="mb-4 text-sm tracking-wide text-fg-passive uppercase">Platform olmadan</h3>
              <ul className="flex flex-col gap-3 text-fg-muted">
                {["Hashtag'lerde tek tek profil aramak", "Excel tabloları ve e-posta zincirleri", "Ekran görüntüsüyle toplanan sonuçlar", "Elle hesaplanan hakediş ve ödemeler"].map((t) => (
                  <li key={t} className="flex items-start gap-3">
                    <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-glass text-[11px] text-fg-passive">✕</span>
                    {t}
                  </li>
                ))}
              </ul>
            </Reveal>
            <Reveal delay={120} className="relative overflow-hidden rounded-3xl border border-neon-pink/30 bg-gradient-to-br from-fuchsia-500/15 via-indigo-500/10 to-transparent p-7">
              <h3 className="mb-4 text-sm tracking-wide text-fuchsia-200 uppercase">{BRAND_NAME} ile</h3>
              <ul className="flex flex-col gap-3">
                {["Filtreyle doğru profil, tek tıkla teklif", "Brief, onay ve takvim tek panelde", "Metrikler resmî API'lerden otomatik", "Hakediş, ödeme listesi ve marka raporu hazır"].map((t, i) => (
                  <li key={t} className="flex items-start gap-3">
                    <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-400/20 text-[11px] text-emerald-300 animate-pop" style={{ animationDelay: `${i * 300}ms` }}>
                      ✓
                    </span>
                    {t}
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>
        </section>

        {/* SSS */}
        <section id="sss" className="mx-auto max-w-3xl px-6 py-28">
          <SectionTitle eyebrow="Sık sorulan sorular" title="Merak edilenler" />
          <div className="flex flex-col gap-3">
            {FAQ.map((f, i) => (
              <Reveal key={f.q} delay={i * 60}>
                <details className="group rounded-2xl border border-line bg-glass px-5 py-4 transition-colors open:border-neon-violet/50 hover:border-line-strong">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[15px] font-medium [&::-webkit-details-marker]:hidden">
                    {f.q}
                    <span aria-hidden className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-line text-fg-muted transition-transform duration-300 group-open:rotate-45 group-open:border-neon-pink group-open:text-neon-pink">
                      +
                    </span>
                  </summary>
                  <p className="mt-3 text-sm leading-relaxed text-fg-muted">{f.a}</p>
                </details>
              </Reveal>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="mx-auto max-w-6xl px-6 pt-10 pb-32">
          <Reveal>
            <div className="relative isolate overflow-hidden rounded-[32px] border border-line px-8 py-16 text-center sm:px-16">
              <div aria-hidden className="absolute inset-0 -z-10 bg-[linear-gradient(120deg,#86198f,#4338ca,#0e7490,#047857,#86198f)] bg-[length:300%_300%] opacity-60 animate-gradient-x" />
              <div aria-hidden className="bg-grid absolute inset-0 -z-10 opacity-40" />
              <h2 className="mx-auto max-w-2xl text-[34px] leading-tight font-semibold tracking-tight sm:text-[48px]">Bir sonraki kampanyanız burada başlıyor.</h2>
              <p className="mx-auto mt-4 max-w-xl text-fg-muted">Üyelik davetle açılır. Davet kodunuz varsa kayıt olun, hesabınız varsa giriş yapın.</p>
              <div className="mx-auto mt-10 grid max-w-3xl grid-cols-1 gap-4 text-left md:grid-cols-2">
                <div className="flex flex-col gap-3 rounded-2xl border border-line-strong bg-glass-strong p-6 backdrop-blur">
                  <span className="text-[12px] tracking-wide text-fg-passive uppercase">Markalar ve ajanslar</span>
                  <p className="text-lg font-medium">Kampanyanızı panelden yönetin</p>
                  <GlowButton href="/giris" className="mt-auto w-full">
                    Giriş yap
                  </GlowButton>
                </div>
                <div className="flex flex-col gap-3 rounded-2xl border border-line-strong bg-glass-strong p-6 backdrop-blur">
                  <span className="text-[12px] tracking-wide text-fg-passive uppercase">İçerik üreticileri</span>
                  <p className="text-lg font-medium">Davet kodunla katıl, işlerini ve ödemelerini takip et</p>
                  <GhostButton href="/kayit">Davet koduyla kayıt ol</GhostButton>
                </div>
              </div>
            </div>
          </Reveal>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-8 text-[13px] text-fg-passive">
          <span>© {new Date().getFullYear()} {BRAND_NAME}</span>
          <nav aria-label="Yasal" className="flex gap-6">
            <Link href="/gizlilik" className="hover:text-fg">
              Gizlilik
            </Link>
            <Link href="/kullanim-kosullari" className="hover:text-fg">
              Kullanım koşulları
            </Link>
            <Link href="/kvkk" className="hover:text-fg">
              KVKK
            </Link>
            <Link href="/cerez-politikasi" className="hover:text-fg">
              Çerezler
            </Link>
            <Link href="/giris" className="hover:text-fg">
              Giriş
            </Link>
          </nav>
        </div>
      </footer>
    </RevealRoot>
  );
}
