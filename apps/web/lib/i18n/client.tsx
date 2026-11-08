"use client";
import { createContext, useContext, type ReactNode } from "react";
import type { Locale } from "@infulancer/core/i18n/regions";
import { translate } from "./dict";

const Ctx = createContext<{ locale: Locale; country: string; currency: string }>({ locale: "tr", country: "TR", currency: "TRY" });
export function I18nProvider({ locale, country, currency, children }: { locale: Locale; country: string; currency: string; children: ReactNode }) {
  return <Ctx.Provider value={{ locale, country, currency }}>{children}</Ctx.Provider>;
}
export function usePrefs() {
  return useContext(Ctx);
}
/** İstemci bileşenlerinde çeviri. */
export function useT() {
  const { locale } = useContext(Ctx);
  return (key: string, fallback: string) => translate(locale, key, fallback);
}
