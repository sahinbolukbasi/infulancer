"use client";
import { createContext, useContext, type ReactNode } from "react";
import type { Messages } from "./messages";
const Ctx = createContext<Messages>({});
/** Aktif dilin sayfa metinleri (kök düzen yükler). */
export function MessagesProvider({ messages, children }: { messages: Messages; children: ReactNode }) {
  return <Ctx.Provider value={messages}>{children}</Ctx.Provider>;
}
/** İstemci bileşenlerinde: const tt = useTT(); tt("Türkçe metin"). */
export function useTT(): (s: string) => string {
  const m = useContext(Ctx);
  return ((s: unknown) => (typeof s === "string" ? (m[s] ?? s) : String(s ?? ""))) as (s: string) => string;
}
