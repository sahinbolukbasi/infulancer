import Link from "next/link";
import { ReelCard } from "@/components/landing/reel-card";
import { buttonClass } from "@/components/ui/form";
import { LANDING_FEATURES, LANDING_REFERENCES, LANDING_STEPS, LANDING_VIDEOS } from "@/lib/landing-content";

const compact = new Intl.NumberFormat("tr-TR", { notation: "compact", maximumFractionDigits: 1 });

export type LandingStats = { influencers: number; followers: number; campaigns: number; published: number };

/** Herkese açık tanıtım sayfası: video vitrini, nasıl çalışır, özellikler, referanslar, giriş/kayıt yönlendirmesi. */
export function LandingPage({ stats }: { stats: LandingStats }) {
  const statItems = [
    { label: "Influencer", value: compact.format(stats.influencers) },
    { label: "Toplam takipçi", value: compact.format(stats.followers) },
    { label: "Kampanya", value: compact.format(stats.campaigns) },
    { label: "Yayınlanan içerik", value: compact.format(stats.published) },
  ];
  return (
    <div className="min-h-screen bg-bg text-fg">
      <a href="#icerik" className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded focus:bg-fg focus:px-3 focus:py-2 focus:text-bg">
        İçeriğe geç
      </a>
      <header className="sticky top-0 z-40 border-b border-border/60 bg-bg/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
          <Link href="/" className="text-lg font-semibold tracking-tight">
            Infulancer
          </Link>
          <nav aria-label="Tanıtım" className="hidden gap-6 text-sm text-fg-muted md:flex">
            <a href="#nasil" className="hover:text-fg">
              Nasıl çalışır
            </a>
            <a href="#ozellikler" className="hover:text-fg">
              Özellikler
            </a>
            <a href="#referanslar" className="hover:text-fg">
              Referanslar
            </a>
            <Link href="/fiyatlandirma" className="hover:text-fg">
              Fiyatlandırma
            </Link>
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/giris" className={buttonClass("ghost", "sm")}>
              Giriş yap
            </Link>
            <a href="#iletisim" className={buttonClass("primary", "sm")}>
              Demo iste
            </a>
          </div>
        </div>
      </header>

      <main id="icerik">
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(217,70,239,0.18),transparent_60%)]" />
          <div className="relative mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 px-6 pt-16 pb-20 lg:grid-cols-2 lg:pt-24">
            <div className="flex flex-col gap-6 animate-enter">
              <span className="w-fit rounded-full border border-border px-3 py-1 text-[12px] text-fg-muted">Influencer marketing ajansları için operasyon platformu</span>
              <h1 className="text-[40px] leading-[1.05] font-semibold tracking-tight sm:text-[56px]">
                Doğru içerik üreticisi, ölçülebilir sonuç.
              </h1>
              <p className="max-w-xl text-lg text-fg-muted">
                Brief&apos;ten yayına, ölçümden ödemeye kadar tüm influencer kampanyanızı tek panelden yönetin. Markalar sonuçları canlı izler, içerik üreticileri işlerini ve
                ödemelerini takip eder.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link href="/giris" className={buttonClass("primary", "md", "h-12 px-6 text-base")}>
                  Panele giriş yap →
                </Link>
                <a href="#referanslar" className={buttonClass("secondary", "md", "h-12 px-6 text-base")}>
                  Referansları gör
                </a>
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-6 sm:grid-cols-4">
                {statItems.map((s) => (
                  <div key={s.label} className="flex flex-col gap-1">
                    <dt className="text-[12px] text-fg-passive">{s.label}</dt>
                    <dd className="text-2xl font-semibold tabular-nums">{s.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <div className="relative mx-auto grid w-full max-w-md grid-cols-2 gap-4">
              <ReelCard video={LANDING_VIDEOS[0]!} className="mt-10 animate-float" />
              <ReelCard video={LANDING_VIDEOS[1]!} delay={1500} className="animate-float" />
            </div>
          </div>
        </section>

        {/* Platform şeridi */}
        <section aria-label="Desteklenen platformlar" className="overflow-hidden border-y border-border py-5">
          <div className="flex w-max gap-12 whitespace-nowrap text-sm text-fg-passive animate-marquee">
            {Array.from({ length: 2 }).flatMap((_, k) =>
              ["Instagram", "TikTok", "YouTube", "WhatsApp", "Meta Partnership Ads", "TikTok Spark Ads", "İYS", "KVKK", "md. 23/A", "AI Creative"].map((t) => (
                <span key={`${k}-${t}`} aria-hidden={k === 1 || undefined}>
                  {t}
                </span>
              )),
            )}
          </div>
        </section>

        {/* Video vitrini */}
        <section className="mx-auto max-w-6xl px-6 py-20">
          <div className="mb-10 flex flex-col gap-3">
            <h2 className="text-3xl font-semibold tracking-tight">Kampanyalardan içerikler</h2>
            <p className="max-w-2xl text-fg-muted">Reels, TikTok ve YouTube içerikleri; her biri planlandı, onaylandı ve ölçüldü.</p>
          </div>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {LANDING_VIDEOS.map((v, i) => (
              <ReelCard key={v.handle} video={v} delay={i * 700} />
            ))}
          </div>
        </section>

        {/* Nasıl çalışır */}
        <section id="nasil" className="border-t border-border bg-surface/40">
          <div className="mx-auto max-w-6xl px-6 py-20">
            <h2 className="mb-10 text-3xl font-semibold tracking-tight">Nasıl çalışır</h2>
            <ol className="grid grid-cols-1 gap-4 md:grid-cols-4">
              {LANDING_STEPS.map((s, i) => (
                <li key={s.title} className="flex flex-col gap-3 rounded-[12px] border border-border bg-bg p-5">
                  <span className="text-[13px] tabular-nums text-fg-passive">0{i + 1}</span>
                  <h3 className="text-lg font-medium">{s.title}</h3>
                  <p className="text-sm text-fg-muted">{s.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Özellikler */}
        <section id="ozellikler" className="mx-auto max-w-6xl px-6 py-20">
          <h2 className="mb-10 text-3xl font-semibold tracking-tight">Tek panelde her şey</h2>
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {LANDING_FEATURES.map((f) => (
              <li key={f.title} className="flex flex-col gap-2 rounded-[12px] border border-border p-5 transition-standard hover:border-border-strong hover:bg-surface">
                <h3 className="font-medium">{f.title}</h3>
                <p className="text-sm text-fg-muted">{f.text}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* Referanslar */}
        <section id="referanslar" className="border-t border-border bg-surface/40">
          <div className="mx-auto max-w-6xl px-6 py-20">
            <div className="mb-10 flex flex-col gap-3">
              <h2 className="text-3xl font-semibold tracking-tight">Referanslar</h2>
              <p className="max-w-2xl text-fg-muted">Markaların platformla yürüttüğü kampanyalardan sonuçlar.</p>
            </div>
            <ul className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              {LANDING_REFERENCES.map((r) => (
                <li key={r.brand} className="flex flex-col gap-5 rounded-[12px] border border-border bg-bg p-6">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex flex-col">
                      <span className="font-medium">{r.brand}</span>
                      <span className="text-[13px] text-fg-passive">{r.sector}</span>
                    </div>
                    {r.sample ? <span className="rounded-full border border-border px-2 py-0.5 text-[11px] text-fg-muted">Örnek çalışma</span> : null}
                  </div>
                  <blockquote className="text-[15px] leading-relaxed text-fg">“{r.quote}”</blockquote>
                  <p className="text-[13px] text-fg-muted">— {r.person}</p>
                  <dl className="mt-auto grid grid-cols-3 gap-3 border-t border-border pt-4">
                    {r.results.map((x) => (
                      <div key={x.label} className="flex flex-col gap-1">
                        <dt className="text-[11px] text-fg-passive">{x.label}</dt>
                        <dd className="text-lg font-semibold tabular-nums">{x.value}</dd>
                      </div>
                    ))}
                  </dl>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* CTA */}
        <section id="iletisim" className="mx-auto max-w-6xl px-6 py-24">
          <div className="flex flex-col items-start gap-6 rounded-[16px] border border-border bg-[radial-gradient(ellipse_at_top_left,rgba(217,70,239,0.15),transparent_60%)] p-10 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-col gap-2">
              <h2 className="text-3xl font-semibold tracking-tight">Kampanyanızı bugün başlatın</h2>
              <p className="text-fg-muted">Üyelik davetle açılır. Davet kodunuz varsa kayıt olun, hesabınız varsa giriş yapın.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/giris" className={buttonClass("primary", "md", "h-12 px-6 text-base")}>
                Giriş yap
              </Link>
              <Link href="/kayit" className={buttonClass("secondary", "md", "h-12 px-6 text-base")}>
                Davet koduyla kayıt ol
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-8 text-[13px] text-fg-passive">
          <span>© {new Date().getFullYear()} Infulancer</span>
          <nav aria-label="Yasal" className="flex gap-6">
            <Link href="/fiyatlandirma" className="hover:text-fg">
              Fiyatlandırma
            </Link>
            <Link href="/gizlilik" className="hover:text-fg">
              Gizlilik
            </Link>
            <Link href="/kullanim-kosullari" className="hover:text-fg">
              Kullanım koşulları
            </Link>
            <Link href="/giris" className="hover:text-fg">
              Giriş
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
