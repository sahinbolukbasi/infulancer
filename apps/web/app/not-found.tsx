import Link from "next/link";
import type { Metadata } from "next";
export const metadata: Metadata = { title: "Sayfa bulunamadı" };

/** 404: bilinmeyen adres. */
export default function NotFound() {
  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-canvas px-6 text-center text-fg">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="bg-grid absolute inset-0 opacity-40 [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_70%)]" />
        <div className="absolute top-1/4 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-neon-pink/20 blur-[120px] animate-aurora" />
      </div>
      <p className="neon-text text-[80px] leading-none font-semibold tracking-tight sm:text-[120px]">404</p>
      <h1 className="mt-2 text-2xl font-semibold">Sayfa bulunamadı</h1>
      <p className="mt-2 max-w-md text-fg-muted">Aradığınız sayfa taşınmış veya adres yanlış olabilir.</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href="/" className="bg-neon neon-glow inline-flex h-11 items-center rounded-full px-6 text-[15px] font-semibold text-black transition-transform hover:scale-105">
          Ana sayfa
        </Link>
        <Link href="/giris" className="inline-flex h-11 items-center rounded-full border border-line-strong px-6 text-[15px] transition-standard hover:border-neon-pink">
          Giriş yap
        </Link>
      </div>
    </main>
  );
}
