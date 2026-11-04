import Link from "next/link";
import type { ReactNode } from "react";
import { ThemeToggle } from "@/components/theme/theme-toggle";
/** Girişsiz erişilebilen yasal sayfalar (Meta/TikTok App Review için menüye girmeden görünür). */
export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-canvas text-fg">
      <header className="sticky top-0 z-30 border-b border-line bg-canvas/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
          <Link href="/" className="flex items-center gap-2 text-lg font-semibold tracking-tight">
            <span aria-hidden className="h-6 w-6 rounded-lg bg-[conic-gradient(from_180deg,#ff2bd6,#9d4dff,#00e5ff,#a3ff12,#ff2bd6)]" />
            Infulancer
          </Link>
          <nav aria-label="Genel" className="flex items-center gap-5 text-sm text-fg-muted">
            <Link href="/" className="hidden hover:text-fg sm:inline">
              Ana sayfa
            </Link>
            <Link href="/giris" className="rounded-full bg-fg px-4 py-1.5 font-medium text-bg">
              Giriş
            </Link>
            <ThemeToggle />
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 pb-24">{children}</main>
    </div>
  );
}
