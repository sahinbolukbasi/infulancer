"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { CopilotChat } from "@/components/copilot/copilot-chat";
import { SparkleIcon } from "@/components/icons";
import { getCopilotWelcome } from "@/lib/actions/copilot";
import type { CopilotWelcome } from "@/lib/copilot";
import { cn } from "@/lib/cn";

const INTRO_KEY = "infl-copilot-intro";
const HOMES = new Set(["/admin", "/marka", "/influencer"]);

/**
 * Her panel sayfasında sağ altta asistan düğmesi; çekmece olarak açılır. İlk girişte bir kez
 * kendiliğinden açılır (ana sayfalarda asistan zaten gömülü olduğu için orada açılmaz).
 */
export function CopilotLauncher() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [welcome, setWelcome] = useState<CopilotWelcome | null>(null);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setWelcome(await getCopilotWelcome());
    } finally {
      setLoading(false);
    }
  }, []);
  const show = useCallback(() => {
    setOpen(true);
    void load();
  }, [load]);
  const hide = useCallback(() => {
    setOpen(false);
    btnRef.current?.focus();
  }, []);

  // İlk ziyarette çekmece kendiliğinden açılmaz (içeriğin üstünü kapatıyordu); düğmenin yanında bir kez ipucu gösterilir.
  const [hint, setHint] = useState(false);
  const dismissHint = useCallback(() => {
    setHint(false);
    try {
      localStorage.setItem(INTRO_KEY, "1");
    } catch {
      /* depolama kapalı */
    }
  }, []);
  useEffect(() => {
    if (HOMES.has(pathname)) return;
    try {
      if (localStorage.getItem(INTRO_KEY)) return;
    } catch {
      return;
    }
    const on = setTimeout(() => setHint(true), 900);
    const off = setTimeout(() => dismissHint(), 9000);
    return () => {
      clearTimeout(on);
      clearTimeout(off);
    };
  }, [pathname, dismissHint]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && hide();
    window.addEventListener("keydown", onKey);
    panelRef.current?.querySelector<HTMLInputElement>("input")?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [open, hide, welcome]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => {
          dismissHint();
          if (open) hide();
          else show();
        }}
        aria-expanded={open}
        aria-controls="copilot-drawer"
        aria-label={open ? "Asistanı kapat" : "Asistanı aç"}
        className={cn(
          "bg-neon neon-glow fixed right-4 bottom-20 z-40 inline-flex h-14 items-center gap-2 rounded-full px-5 text-[14px] font-semibold text-black transition-transform duration-300 hover:scale-105 md:right-6 md:bottom-6",
          open && "scale-90 opacity-0 pointer-events-none",
        )}
      >
        <span className="relative flex h-5 w-5 items-center justify-center">
          <span className="absolute inset-0 rounded-full bg-white/40 animate-ping-slow" aria-hidden />
          <SparkleIcon size={18} />
        </span>
        <span className="hidden sm:inline">Asistan</span>
      </button>
      {hint && !open ? (
        <div role="status" className="fixed right-4 bottom-36 z-40 flex max-w-[260px] items-start gap-2 rounded-2xl border border-line bg-bg/95 px-3 py-2 text-[13px] shadow-none backdrop-blur animate-enter md:right-6 md:bottom-24">
          <span>Takıldığınız yerde Asistan&apos;a sorun: “yeni kampanya başlat”, “ödemem ne zaman”…</span>
          <button type="button" onClick={dismissHint} aria-label="İpucunu kapat" className="text-fg-passive hover:text-fg">
            ×
          </button>
        </div>
      ) : null}
      <div
        id="copilot-drawer"
        ref={panelRef}
        role="dialog"
        aria-modal="false"
        aria-label="Infulancer Asistan"
        hidden={!open}
        className="fixed inset-x-2 bottom-2 z-50 flex h-[min(720px,calc(100dvh-16px))] flex-col overflow-hidden rounded-3xl border border-line bg-bg/95 backdrop-blur-xl animate-modal-in md:inset-x-auto md:right-6 md:bottom-6 md:w-[440px]"
      >
        {welcome ? (
          <CopilotChat welcome={welcome} compact onClose={hide} />
        ) : (
          <div className="flex flex-1 items-center justify-center text-sm text-fg-muted" aria-busy={loading}>
            Asistan hazırlanıyor…
          </div>
        )}
      </div>
    </>
  );
}
