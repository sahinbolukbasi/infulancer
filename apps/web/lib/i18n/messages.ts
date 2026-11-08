import type { Locale } from "@infulancer/core/i18n/regions";
import de from "./messages/de.json";
import en from "./messages/en.json";
import fr from "./messages/fr.json";
/**
 * Sayfa metinleri: anahtar Türkçe kaynak metnin kendisidir (tt("Kampanyalar")).
 * Çeviri yoksa Türkçe gösterilir. Dosyalar scripts/i18n ile güncellenir.
 */
export type Messages = Record<string, string>;
const ALL: Record<Exclude<Locale, "tr">, Messages> = { en, de, fr };
export function messagesFor(locale: Locale): Messages {
  return locale === "tr" ? {} : ALL[locale];
}
