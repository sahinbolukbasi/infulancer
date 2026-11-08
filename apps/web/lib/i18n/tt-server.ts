import { getPreferences } from "./server";
import { messagesFor } from "./messages";
/** Sunucu bileşenlerinde: const tt = await getTT(); tt("Türkçe metin"). */
export async function getTT(): Promise<(s: string) => string> {
  const { locale } = await getPreferences();
  const m = messagesFor(locale);
  return ((s: unknown) => (typeof s === "string" ? (m[s] ?? s) : String(s ?? ""))) as (s: string) => string;
}
