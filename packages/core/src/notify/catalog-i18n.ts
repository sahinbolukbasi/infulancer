import type { Locale } from "../i18n/regions";
import { NOTIF_EVENTS, type NotifChannel, type NotifEvent } from "./catalog";

/**
 * Bildirim şablonlarının EN/DE/FR karşılıkları. Katalog (catalog.ts) Türkçe kaynaktır; burada
 * olay+kanal başına çeviriler durur. Yer tutucular ({{ad}}, {{link}}…) aynen korunur.
 * Admin panelden özel şablon yazdıysa (DB'de kayıt) o öncelikli olur; bu çeviriler yalnız
 * katalog varsayılanları için ve alıcının diline göre dispatch'te seçilir.
 */
type Tpl = { subject?: string; body: string };
type EventTpls = Partial<Record<NotifChannel, Tpl>>;
type LocaleTpls = Record<string, EventTpls>; // eventKey -> channel -> tpl

const en: LocaleTpls = {
  EVENT_CREATED: {
    INAPP: { subject: "New event", body: "The event “{{baslik}}” was created ({{tarih}})." },
    EMAIL: { subject: "New event: {{baslik}}", body: "Hello,\n\nThe event “{{baslik}}” is scheduled for {{tarih}}." },
  },
  EVENT_INVITED: {
    INAPP: { subject: "Event invitation", body: "You are invited to “{{baslik}}”." },
    EMAIL: { subject: "You're invited: {{baslik}}", body: "Hello {{ad}},\n\nYou are invited to “{{baslik}}” on {{tarih}}. RSVP and ticket: {{link}}" },
    WHATSAPP: { body: "Hi {{ad}} 👋 You're invited to “{{baslik}}” ({{tarih}}). Details: {{link}}" },
    INSTAGRAM: { body: "You're invited to “{{baslik}}”! Details: {{link}}" },
  },
  COUPON_GRANTED: {
    INAPP: { subject: "A coupon was added for you", body: "The coupon “{{baslik}}” ({{deger}}) was added to your account." },
    EMAIL: { subject: "Just for you: {{baslik}}", body: "Hello {{ad}},\n\nYour coupon “{{baslik}}” ({{deger}}) is ready. Code: {{kod}}\nView the card: {{link}}" },
    WHATSAPP: { body: "Hi {{ad}} 🎁 Your coupon “{{baslik}}” ({{deger}}) is ready. Code: {{kod}} · {{link}}" },
  },
  NEW_OFFER: {
    INAPP: { subject: "New offer", body: "{{marka}} sent you the offer “{{baslik}}” ({{tutar}})." },
    EMAIL: { subject: "New offer: {{marka}}", body: "Hello {{ad}},\n\n{{marka}} sent you the collaboration offer “{{baslik}}”. Amount: {{tutar}}. Reply: {{link}}" },
    WHATSAPP: { body: "Hi {{ad}} 💼 {{marka}} sent you a new offer: “{{baslik}}” ({{tutar}}). {{link}}" },
  },
  OFFER_RESPONDED: {
    INAPP: { subject: "Offer response", body: "{{ad}} {{durum}} the offer “{{baslik}}”." },
    EMAIL: { subject: "Offer {{durum}}", body: "The offer “{{baslik}}” was {{durum}} by {{ad}}." },
  },
  PAYOUT_APPROVED: {
    INAPP: { subject: "Payout approved", body: "Your withdrawal request for {{tutar}} was approved." },
    EMAIL: { subject: "Your payout was approved", body: "Hello {{ad}},\n\nYour withdrawal request for {{tutar}} was approved and is now being processed." },
    WHATSAPP: { body: "Hi {{ad}} ✅ Your payout of {{tutar}} was approved." },
  },
  OPEN_CALL_PUBLISHED: {
    INAPP: { subject: "New open call", body: "{{marka}} opened the application call “{{baslik}}”." },
    EMAIL: { subject: "New opportunity: {{baslik}}", body: "{{marka}} opened the application call “{{baslik}}”. Apply: {{link}}" },
  },
  APPLICATION_REVIEWED: {
    INAPP: { subject: "Application result", body: "Your application “{{baslik}}”: {{durum}}." },
    EMAIL: { subject: "Application result: {{baslik}}", body: "Hello {{ad}},\n\nThe result of your application “{{baslik}}”: {{durum}}." },
  },
  ANNOUNCEMENT: {
    INAPP: { subject: "Announcement", body: "{{mesaj}}" },
    EMAIL: { subject: "Announcement", body: "Hello {{ad}},\n\n{{mesaj}}\n\n{{link}}" },
    WHATSAPP: { body: "{{mesaj}} {{link}}" },
    INSTAGRAM: { body: "{{mesaj}} {{link}}" },
  },
};

const de: LocaleTpls = {
  EVENT_CREATED: {
    INAPP: { subject: "Neue Veranstaltung", body: "Die Veranstaltung „{{baslik}}“ wurde erstellt ({{tarih}})." },
    EMAIL: { subject: "Neue Veranstaltung: {{baslik}}", body: "Hallo,\n\ndie Veranstaltung „{{baslik}}“ ist für {{tarih}} geplant." },
  },
  EVENT_INVITED: {
    INAPP: { subject: "Veranstaltungseinladung", body: "Sie sind zu „{{baslik}}“ eingeladen." },
    EMAIL: { subject: "Sie sind eingeladen: {{baslik}}", body: "Hallo {{ad}},\n\nSie sind am {{tarih}} zu „{{baslik}}“ eingeladen. Zusage und Ticket: {{link}}" },
    WHATSAPP: { body: "Hallo {{ad}} 👋 Sie sind zu „{{baslik}}“ eingeladen ({{tarih}}). Details: {{link}}" },
    INSTAGRAM: { body: "Sie sind zu „{{baslik}}“ eingeladen! Details: {{link}}" },
  },
  COUPON_GRANTED: {
    INAPP: { subject: "Ein Gutschein wurde für Sie hinzugefügt", body: "Der Gutschein „{{baslik}}“ ({{deger}}) wurde Ihrem Konto hinzugefügt." },
    EMAIL: { subject: "Nur für Sie: {{baslik}}", body: "Hallo {{ad}},\n\nIhr Gutschein „{{baslik}}“ ({{deger}}) ist bereit. Code: {{kod}}\nKarte ansehen: {{link}}" },
    WHATSAPP: { body: "Hallo {{ad}} 🎁 Ihr Gutschein „{{baslik}}“ ({{deger}}) ist bereit. Code: {{kod}} · {{link}}" },
  },
  NEW_OFFER: {
    INAPP: { subject: "Neues Angebot", body: "{{marka}} hat Ihnen das Angebot „{{baslik}}“ ({{tutar}}) gesendet." },
    EMAIL: { subject: "Neues Angebot: {{marka}}", body: "Hallo {{ad}},\n\n{{marka}} hat Ihnen das Kooperationsangebot „{{baslik}}“ gesendet. Betrag: {{tutar}}. Antworten: {{link}}" },
    WHATSAPP: { body: "Hallo {{ad}} 💼 {{marka}} hat Ihnen ein neues Angebot gesendet: „{{baslik}}“ ({{tutar}}). {{link}}" },
  },
  OFFER_RESPONDED: {
    INAPP: { subject: "Angebotsantwort", body: "{{ad}} hat das Angebot „{{baslik}}“ {{durum}}." },
    EMAIL: { subject: "Angebot {{durum}}", body: "Das Angebot „{{baslik}}“ wurde von {{ad}} {{durum}}." },
  },
  PAYOUT_APPROVED: {
    INAPP: { subject: "Auszahlung genehmigt", body: "Ihre Auszahlungsanfrage über {{tutar}} wurde genehmigt." },
    EMAIL: { subject: "Ihre Auszahlung wurde genehmigt", body: "Hallo {{ad}},\n\nIhre Auszahlungsanfrage über {{tutar}} wurde genehmigt und wird jetzt bearbeitet." },
    WHATSAPP: { body: "Hallo {{ad}} ✅ Ihre Auszahlung über {{tutar}} wurde genehmigt." },
  },
  OPEN_CALL_PUBLISHED: {
    INAPP: { subject: "Neuer offener Aufruf", body: "{{marka}} hat den Bewerbungsaufruf „{{baslik}}“ eröffnet." },
    EMAIL: { subject: "Neue Gelegenheit: {{baslik}}", body: "{{marka}} hat den Bewerbungsaufruf „{{baslik}}“ eröffnet. Jetzt bewerben: {{link}}" },
  },
  APPLICATION_REVIEWED: {
    INAPP: { subject: "Bewerbungsergebnis", body: "Ihre Bewerbung „{{baslik}}“: {{durum}}." },
    EMAIL: { subject: "Bewerbungsergebnis: {{baslik}}", body: "Hallo {{ad}},\n\ndas Ergebnis Ihrer Bewerbung „{{baslik}}“: {{durum}}." },
  },
  ANNOUNCEMENT: {
    INAPP: { subject: "Ankündigung", body: "{{mesaj}}" },
    EMAIL: { subject: "Ankündigung", body: "Hallo {{ad}},\n\n{{mesaj}}\n\n{{link}}" },
    WHATSAPP: { body: "{{mesaj}} {{link}}" },
    INSTAGRAM: { body: "{{mesaj}} {{link}}" },
  },
};

const fr: LocaleTpls = {
  EVENT_CREATED: {
    INAPP: { subject: "Nouvel événement", body: "L'événement « {{baslik}} » a été créé ({{tarih}})." },
    EMAIL: { subject: "Nouvel événement : {{baslik}}", body: "Bonjour,\n\nL'événement « {{baslik}} » est prévu le {{tarih}}." },
  },
  EVENT_INVITED: {
    INAPP: { subject: "Invitation à un événement", body: "Vous êtes invité·e à « {{baslik}} »." },
    EMAIL: { subject: "Vous êtes invité·e : {{baslik}}", body: "Bonjour {{ad}},\n\nVous êtes invité·e à « {{baslik}} » le {{tarih}}. Confirmation et billet : {{link}}" },
    WHATSAPP: { body: "Bonjour {{ad}} 👋 Vous êtes invité·e à « {{baslik}} » ({{tarih}}). Détails : {{link}}" },
    INSTAGRAM: { body: "Vous êtes invité·e à « {{baslik}} » ! Détails : {{link}}" },
  },
  COUPON_GRANTED: {
    INAPP: { subject: "Un coupon vous a été attribué", body: "Le coupon « {{baslik}} » ({{deger}}) a été ajouté à votre compte." },
    EMAIL: { subject: "Rien que pour vous : {{baslik}}", body: "Bonjour {{ad}},\n\nVotre coupon « {{baslik}} » ({{deger}}) est prêt. Code : {{kod}}\nVoir la carte : {{link}}" },
    WHATSAPP: { body: "Bonjour {{ad}} 🎁 Votre coupon « {{baslik}} » ({{deger}}) est prêt. Code : {{kod}} · {{link}}" },
  },
  NEW_OFFER: {
    INAPP: { subject: "Nouvelle offre", body: "{{marka}} vous a envoyé l'offre « {{baslik}} » ({{tutar}})." },
    EMAIL: { subject: "Nouvelle offre : {{marka}}", body: "Bonjour {{ad}},\n\n{{marka}} vous a envoyé l'offre de collaboration « {{baslik}} ». Montant : {{tutar}}. Répondre : {{link}}" },
    WHATSAPP: { body: "Bonjour {{ad}} 💼 {{marka}} vous a envoyé une nouvelle offre : « {{baslik}} » ({{tutar}}). {{link}}" },
  },
  OFFER_RESPONDED: {
    INAPP: { subject: "Réponse à l'offre", body: "{{ad}} a {{durum}} l'offre « {{baslik}} »." },
    EMAIL: { subject: "Offre {{durum}}", body: "L'offre « {{baslik}} » a été {{durum}} par {{ad}}." },
  },
  PAYOUT_APPROVED: {
    INAPP: { subject: "Retrait approuvé", body: "Votre demande de retrait de {{tutar}} a été approuvée." },
    EMAIL: { subject: "Votre retrait a été approuvé", body: "Bonjour {{ad}},\n\nVotre demande de retrait de {{tutar}} a été approuvée et est en cours de traitement." },
    WHATSAPP: { body: "Bonjour {{ad}} ✅ Votre retrait de {{tutar}} a été approuvé." },
  },
  OPEN_CALL_PUBLISHED: {
    INAPP: { subject: "Nouvel appel ouvert", body: "{{marka}} a ouvert l'appel à candidatures « {{baslik}} »." },
    EMAIL: { subject: "Nouvelle opportunité : {{baslik}}", body: "{{marka}} a ouvert l'appel à candidatures « {{baslik}} ». Postuler : {{link}}" },
  },
  APPLICATION_REVIEWED: {
    INAPP: { subject: "Résultat de candidature", body: "Votre candidature « {{baslik}} » : {{durum}}." },
    EMAIL: { subject: "Résultat de candidature : {{baslik}}", body: "Bonjour {{ad}},\n\nLe résultat de votre candidature « {{baslik}} » : {{durum}}." },
  },
  ANNOUNCEMENT: {
    INAPP: { subject: "Annonce", body: "{{mesaj}}" },
    EMAIL: { subject: "Annonce", body: "Bonjour {{ad}},\n\n{{mesaj}}\n\n{{link}}" },
    WHATSAPP: { body: "{{mesaj}} {{link}}" },
    INSTAGRAM: { body: "{{mesaj}} {{link}}" },
  },
};

const BY_LOCALE: Record<Exclude<Locale, "tr">, LocaleTpls> = { en, de, fr };

/** Katalog varsayılan şablonunun verilen dildeki karşılığı; yoksa null (Türkçe kaynak kullanılır). */
export function localizedTemplate(eventKey: string, channel: NotifChannel, locale: Locale): { subject?: string; body: string } | null {
  if (locale === "tr") return null;
  return BY_LOCALE[locale]?.[eventKey]?.[channel] ?? null;
}

/** Her olayın her dilde eksiksiz çevrildiğini doğrular (test/geliştirme için). */
export function missingTranslations(): string[] {
  const miss: string[] = [];
  for (const ev of NOTIF_EVENTS as NotifEvent[]) {
    for (const ch of Object.keys(ev.templates) as NotifChannel[]) {
      for (const loc of ["en", "de", "fr"] as const) {
        if (!BY_LOCALE[loc][ev.key]?.[ch]) miss.push(`${loc}:${ev.key}:${ch}`);
      }
    }
  }
  return miss;
}
