"use client";
import { useEffect } from "react";
import Link from "next/link";

/** Beklenmedik çalışma zamanı hatası. Ayrıntı kullanıcıya gösterilmez; tekrar deneme sunulur. */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("App error:", error.digest ?? error.message);
  }, [error]);
  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-canvas px-6 text-center text-fg">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="bg-grid absolute inset-0 opacity-40 [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_70%)]" />
        <div className="absolute top-1/4 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-neon-violet/20 blur-[120px] animate-aurora" />
      </div>
      <p className="neon-text text-[64px] leading-none font-semibold tracking-tight">Bir sorun oluştu</p>
      <p className="mt-3 max-w-md text-fg-muted">İşlem tamamlanamadı. Tekrar deneyebilir ya da ana sayfaya dönebilirsiniz. Sorun sürerse ajansınıza bildirin.</p>
      {error.digest ? <p className="mt-2 text-[12px] text-fg-passive">Hata kodu: {error.digest}</p> : null}
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <button type="button" onClick={reset} className="bg-neon neon-glow inline-flex h-11 items-center rounded-full px-6 text-[15px] font-semibold text-black transition-transform hover:scale-105">
          Tekrar dene
        </button>
        <Link href="/" className="inline-flex h-11 items-center rounded-full border border-line-strong px-6 text-[15px] transition-standard hover:border-neon-pink">
          Ana sayfa
        </Link>
      </div>
    </main>
  );
}
