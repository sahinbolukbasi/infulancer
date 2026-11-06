import type { ReactNode } from "react";
import Link from "next/link";
import { RotatingWord } from "@/components/landing/motion";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { ReelCard } from "@/components/landing/reel-card";
import type { LandingVideo } from "@/lib/landing-content";
import { cn } from "@/lib/cn";
import { BRAND_NAME } from "@/lib/brand";

/**
 * Giriş / kayıt / onay ekranlarının ortak çerçevesi: solda animasyonlu marka paneli,
 * sağda cam efektli form kartı. Mobilde yalnız form ve üst başlık görünür.
 */
export function AuthShell({
  title,
  subtitle,
  children,
  footer,
  wide = false,
  videos,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
  videos: LandingVideo[];
}) {
  return (
    <div className="relative isolate grid min-h-dvh grid-cols-1 overflow-hidden bg-canvas text-fg lg:grid-cols-[1fr_minmax(0,1.05fr)]">
      {/* Arka plan */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="bg-grid absolute inset-0 [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_70%)]" />
        <div className="absolute -top-40 -left-40 h-[520px] w-[520px] rounded-full bg-fuchsia-600/25 blur-[120px] animate-aurora" />
        <div className="absolute -right-40 bottom-0 h-[560px] w-[560px] rounded-full bg-indigo-600/25 blur-[120px] animate-aurora [animation-delay:-8s]" />
      </div>

      {/* Sol: marka paneli */}
      <aside className="relative hidden flex-col justify-between overflow-hidden border-r border-line p-12 lg:flex">
        <Link href="/" className="flex w-fit items-center gap-2 text-lg font-semibold tracking-tight">
          <span aria-hidden className="h-7 w-7 rounded-lg bg-[conic-gradient(from_180deg,#ff2bd6,#9d4dff,#00e5ff,#a3ff12,#ff2bd6)] animate-spin-slow" />
          {BRAND_NAME}
        </Link>
        <div className="relative mx-auto flex h-[420px] w-full max-w-[380px] items-center justify-center">
          <div aria-hidden className="absolute inset-6 rounded-full bg-[conic-gradient(from_0deg,#ff2bd633,#00e5ff33,#a3ff1233,#ff2bd633)] blur-2xl animate-spin-slow" />
          {videos[0] ? (
            <div className="absolute top-10 left-0 w-[46%] -rotate-6 animate-float">
              <ReelCard video={videos[0]} />
            </div>
          ) : null}
          {videos[1] ? (
            <div className="absolute top-0 right-0 w-[50%] rotate-3 animate-float [animation-delay:-2.5s]">
              <ReelCard video={videos[1]} delay={1500} className="ring-1 ring-line-strong" />
            </div>
          ) : null}
        </div>
        <div className="flex flex-col gap-3">
          <p className="neon-text text-[34px] leading-tight font-semibold tracking-tight">
            İçerik üreticileriyle
            <br />
            ölçülebilir <RotatingWord words={["erişim.", "etkileşim.", "satış.", "güven."]} />
          </p>
          <p className="max-w-md text-sm text-fg-muted">Ajans, marka ve içerik üreticisi aynı panelde: brief, onay, yayın, ölçüm ve ödeme.</p>
        </div>
      </aside>

      {/* Sağ: form */}
      <main className="flex items-center justify-center px-4 py-12 sm:px-8">
        <div className={cn("flex w-full animate-enter flex-col gap-6", wide ? "max-w-2xl" : "max-w-md")}>
          <div className="flex items-center justify-between gap-3">
            <Link href="/" className="flex w-fit items-center gap-2 text-lg font-semibold tracking-tight lg:invisible">
              <span aria-hidden className="h-6 w-6 rounded-lg bg-[conic-gradient(from_180deg,#ff2bd6,#9d4dff,#00e5ff,#a3ff12,#ff2bd6)]" />
              {BRAND_NAME}
            </Link>
            <ThemeToggle />
          </div>
          <div className="flex flex-col gap-2">
            <h1 className="text-[32px] leading-tight font-semibold tracking-tight">{title}</h1>
            {subtitle ? <p className="text-sm text-fg-muted">{subtitle}</p> : null}
          </div>
          <div className="relative rounded-3xl border border-line bg-glass p-6 backdrop-blur-xl sm:p-8">
            <div aria-hidden className="pointer-events-none absolute inset-x-10 -top-px h-px bg-gradient-to-r from-transparent via-neon-pink/70 to-transparent" />
            {children}
          </div>
          {footer ? <div className="text-center text-[13px] text-fg-muted">{footer}</div> : null}
          <nav aria-label="Yasal" className="flex justify-center gap-5 text-[12px] text-fg-passive">
            <Link href="/" className="hover:text-fg">
              Ana sayfa
            </Link>
            <Link href="/gizlilik" className="hover:text-fg">
              Gizlilik
            </Link>
            <Link href="/kullanim-kosullari" className="hover:text-fg">
              Kullanım koşulları
            </Link>
          </nav>
        </div>
      </main>
    </div>
  );
}
