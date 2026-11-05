"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

const KEY = "infl-cookie-consent";
const OPEN_EVENT = "infl-cookie-open";
type Consent = { v: 1; functional: boolean; at: string };

function read(): Consent | null {
  try {
    const m = document.cookie.match(/(?:^|; )infl-cookie-consent=([^;]+)/);
    return m ? (JSON.parse(decodeURIComponent(m[1]!)) as Consent) : null;
  } catch {
    return null;
  }
}
function write(functional: boolean) {
  const c: Consent = { v: 1, functional, at: new Date().toISOString() };
  document.cookie = `${KEY}=${encodeURIComponent(JSON.stringify(c))};path=/;max-age=31536000;samesite=lax`;
  if (!functional) {
    try {
      localStorage.removeItem("infl-theme");
    } catch {
      /* depolama kapalı */
    }
  }
}

/**
 * Çerez bandı: yalnız zorunlu + işlevsel (tema) çerez var; reklam/analitik yok. Seçim 1 yıl saklanır.
 * Çerez politikasındaki "Tercihleri değiştir" düğmesi bandı yeniden açar.
 */
export function CookieBanner() {
  const [open, setOpen] = useState(false);
  const [details, setDetails] = useState(false);
  const [functional, setFunctional] = useState(true);
  useEffect(() => {
    const c = read();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- ilk yüklemede kayıtlı tercih okunur
    if (!c) setOpen(true);
    else setFunctional(c.functional);
    const onOpen = () => {
      setOpen(true);
      setDetails(true);
    };
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_EVENT, onOpen);
  }, []);
  if (!open) return null;
  const save = (f: boolean) => {
    write(f);
    setFunctional(f);
    setOpen(false);
  };
  return (
    <div role="dialog" aria-modal="false" aria-labelledby="cookie-title" className="fixed inset-x-3 bottom-3 z-[60] rounded-3xl border border-line bg-bg/95 p-5 backdrop-blur-xl animate-modal-in md:right-auto md:left-6 md:bottom-6 md:max-w-md">
      <h2 id="cookie-title" className="text-[15px] font-semibold">
        Çerez tercihleri
      </h2>
      <p className="mt-1 text-[13px] text-fg-muted">
        Oturum ve güvenlik için zorunlu çerezler, tema tercihiniz için işlevsel bir çerez kullanıyoruz. Reklam veya takip çerezi yok.{" "}
        <Link href="/cerez-politikasi" className="underline underline-offset-4">
          Çerez Politikası
        </Link>
      </p>
      {details ? (
        <div className="mt-3 flex flex-col gap-2 text-[13px]">
          <label className="flex items-center justify-between gap-3 rounded-xl border border-line px-3 py-2">
            <span>
              <span className="font-medium text-fg">Zorunlu</span> <span className="text-fg-muted">· oturum, güvenlik</span>
            </span>
            <input type="checkbox" checked disabled className="h-4 w-4" aria-label="Zorunlu çerezler (kapatılamaz)" />
          </label>
          <label className="flex items-center justify-between gap-3 rounded-xl border border-line px-3 py-2">
            <span>
              <span className="font-medium text-fg">İşlevsel</span> <span className="text-fg-muted">· tema tercihi</span>
            </span>
            <input type="checkbox" checked={functional} onChange={(e) => setFunctional(e.target.checked)} className="h-4 w-4 accent-[var(--color-fg)]" aria-label="İşlevsel çerezler" />
          </label>
        </div>
      ) : null}
      <div className="mt-4 flex flex-wrap justify-end gap-2">
        {details ? (
          <button type="button" onClick={() => save(functional)} className="rounded-full border border-line-strong px-4 py-2 text-[13px] hover:border-fg">
            Seçimi kaydet
          </button>
        ) : (
          <button type="button" onClick={() => setDetails(true)} className="rounded-full px-4 py-2 text-[13px] text-fg-muted hover:text-fg">
            Ayarlar
          </button>
        )}
        <button type="button" onClick={() => save(false)} className="rounded-full border border-line-strong px-4 py-2 text-[13px] hover:border-fg">
          Yalnız zorunlu
        </button>
        <button type="button" onClick={() => save(true)} className="rounded-full bg-fg px-4 py-2 text-[13px] font-medium text-bg">
          Tümünü kabul et
        </button>
      </div>
    </div>
  );
}

export function CookiePreferencesButton() {
  return (
    <button type="button" onClick={() => window.dispatchEvent(new Event(OPEN_EVENT))} className="w-fit rounded-full border border-line-strong px-4 py-2 text-[13px] text-fg hover:border-fg">
      Çerez tercihlerini değiştir
    </button>
  );
}
