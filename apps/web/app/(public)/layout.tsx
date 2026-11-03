import Link from "next/link";
import type { ReactNode } from "react";

/** Girişsiz erişilebilen sayfalar (App Review: gizlilik ve kullanım koşulları menüye girmeden görünür). */
export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-bg text-fg">
      <header className="mx-auto flex max-w-4xl items-center justify-between px-6 py-6">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          Infulancer
        </Link>
        <nav aria-label="Genel" className="flex gap-6 text-sm text-fg-muted">
          <Link href="/fiyatlandirma">Fiyatlandırma</Link>
          <Link href="/gizlilik">Gizlilik</Link>
          <Link href="/kullanim-kosullari">Kullanım koşulları</Link>
          <Link href="/giris">Giriş</Link>
        </nav>
      </header>
      <main className="mx-auto max-w-4xl px-6 pb-24">{children}</main>
    </div>
  );
}
