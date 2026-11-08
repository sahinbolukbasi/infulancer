"use client";
import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LOCALE_LABEL, LOCALES, REGIONS, regionOf, type Locale } from "@infulancer/core/i18n/regions";
import { setRegionAction } from "@/lib/actions/region";
import { idleState } from "@/lib/action-state";
import { usePrefs, useT } from "@/lib/i18n/client";
import { useDismiss } from "@/lib/use-dismiss";
import { cn } from "@/lib/cn";

/**
 * Dil + ülke seçici. İlk ziyarette konum ve tarayıcı dilinden otomatik seçilir; kullanıcı buradan
 * değiştirir (çerez + hesap). Ülke para birimini belirler; tutarlar çevrilmez.
 */
export function RegionSwitcher({ compact = false }: { compact?: boolean }) {
  const { locale, country } = usePrefs();
  const t = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loc, setLoc] = useState<Locale>(locale);
  const [cty, setCty] = useState(country);
  const [state, action, pending] = useActionState(setRegionAction, idleState);
  const ref = useRef<HTMLDivElement>(null);
  useDismiss(ref, open, () => setOpen(false));
  useEffect(() => {
    if (state.ok) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- kayıttan sonra menüyü kapat
      setOpen(false);
      router.refresh();
    }
  }, [state, router]);
  const r = regionOf(country);
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={cn("inline-flex h-9 items-center gap-1.5 rounded-[8px] px-2 text-[13px] text-fg-muted transition-standard hover:bg-surface-hover hover:text-fg", compact && "px-1.5")}
        aria-label={`${t("region.title", "Dil ve bölge")}: ${LOCALE_LABEL[locale]}, ${r.nativeName}, ${r.currency}`}
      >
        <span aria-hidden>🌐</span>
        <span className="font-medium uppercase">{locale}</span>
        {!compact ? <span className="text-fg-passive">· {r.code} · {r.currency}</span> : null}
      </button>
      {open ? (
        <form
          action={action}
          role="dialog"
          aria-label={t("region.title", "Dil ve bölge")}
          className="animate-modal-in absolute right-0 z-40 mt-2 flex w-72 flex-col gap-3 rounded-[8px] border border-border bg-surface p-4"
        >
          <p className="text-sm font-medium text-fg">{t("region.title", "Dil ve bölge")}</p>
          <label className="flex flex-col gap-1 text-[12px] text-fg-muted">
            {t("region.language", "Dil")}
            <select name="locale" value={loc} onChange={(e) => setLoc(e.target.value as Locale)} className="h-9 rounded-[8px] border border-border bg-bg px-2 text-sm text-fg">
              {LOCALES.map((l) => (
                <option key={l} value={l}>
                  {LOCALE_LABEL[l]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[12px] text-fg-muted">
            {t("region.country", "Ülke")}
            <select name="country" value={cty} onChange={(e) => setCty(e.target.value)} className="h-9 rounded-[8px] border border-border bg-bg px-2 text-sm text-fg">
              {REGIONS.map((x) => (
                <option key={x.code} value={x.code}>
                  {x.nativeName} · {x.currency}
                </option>
              ))}
            </select>
          </label>
          <p className="text-[11px] text-fg-passive">{t("region.note", "Tutarlar her zaman hesabın kendi para biriminde gösterilir; çevrim yapılmaz.")}</p>
          {state.error ? <p role="alert" className="text-[12px] text-critical">{state.error}</p> : null}
          <button type="submit" disabled={pending} className="h-9 rounded-full bg-fg text-[13px] font-semibold text-bg disabled:opacity-50">
            {t("region.save", "Kaydet")}
          </button>
        </form>
      ) : null}
    </div>
  );
}
