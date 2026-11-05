/**
 * Bildirim olay katalogu: sistemdeki tüm bildirim tetikleyicileri, varsayılan kanalları
 * ve kanal bazlı varsayılan şablonları. Admin bunları panelden düzenler; burada tohum değer.
 * Şablon yer tutucuları {{anahtar}} biçimindedir ve dispatch sırasında doldurulur.
 */
export type NotifChannel = "INAPP" | "EMAIL" | "WHATSAPP" | "INSTAGRAM";

export type NotifEvent = {
  key: string;
  label: string;
  /** Bu olayda kullanılabilir değişkenler (admin'e ipucu). */
  vars: string[];
  defaultChannels: NotifChannel[];
  templates: Partial<Record<NotifChannel, { subject?: string; body: string }>>;
};

export const NOTIF_EVENTS: NotifEvent[] = [
  {
    key: "EVENT_CREATED",
    label: "Etkinlik oluşturuldu",
    vars: ["baslik", "tarih"],
    defaultChannels: ["INAPP"],
    templates: {
      INAPP: { subject: "Yeni etkinlik", body: "“{{baslik}}” etkinliği oluşturuldu ({{tarih}})." },
      EMAIL: { subject: "Yeni etkinlik: {{baslik}}", body: "Merhaba,\n\n“{{baslik}}” etkinliği {{tarih}} tarihinde planlandı." },
    },
  },
  {
    key: "EVENT_INVITED",
    label: "Etkinliğe davet",
    vars: ["ad", "baslik", "tarih", "link"],
    defaultChannels: ["INAPP", "EMAIL", "WHATSAPP"],
    templates: {
      INAPP: { subject: "Etkinlik daveti", body: "“{{baslik}}” etkinliğine davet edildiniz." },
      EMAIL: { subject: "Davetlisiniz: {{baslik}}", body: "Merhaba {{ad}},\n\n{{tarih}} tarihli “{{baslik}}” etkinliğine davetlisiniz. Katılım ve biletiniz: {{link}}" },
      WHATSAPP: { body: "Merhaba {{ad}} 👋 “{{baslik}}” etkinliğine davetlisiniz ({{tarih}}). Detay: {{link}}" },
      INSTAGRAM: { body: "“{{baslik}}” etkinliğine davetlisiniz! Detay: {{link}}" },
    },
  },
  {
    key: "COUPON_GRANTED",
    label: "Kupon/hediye çeki gönderildi",
    vars: ["ad", "baslik", "deger", "kod", "link"],
    defaultChannels: ["INAPP", "EMAIL", "WHATSAPP"],
    templates: {
      INAPP: { subject: "Size bir kupon tanımlandı", body: "“{{baslik}}” ({{deger}}) kuponu hesabınıza eklendi." },
      EMAIL: { subject: "Size özel: {{baslik}}", body: "Merhaba {{ad}},\n\n“{{baslik}}” ({{deger}}) kuponunuz hazır. Kod: {{kod}}\nKartı görün: {{link}}" },
      WHATSAPP: { body: "Merhaba {{ad}} 🎁 “{{baslik}}” ({{deger}}) kuponunuz hazır. Kod: {{kod}} · {{link}}" },
    },
  },
  {
    key: "NEW_OFFER",
    label: "Yeni iş birliği teklifi",
    vars: ["ad", "marka", "baslik", "tutar", "link"],
    defaultChannels: ["INAPP", "EMAIL", "WHATSAPP"],
    templates: {
      INAPP: { subject: "Yeni teklif", body: "{{marka}} size “{{baslik}}” teklifini gönderdi ({{tutar}})." },
      EMAIL: { subject: "Yeni teklif: {{marka}}", body: "Merhaba {{ad}},\n\n{{marka}} “{{baslik}}” iş birliği teklifini gönderdi. Tutar: {{tutar}}. Yanıtlayın: {{link}}" },
      WHATSAPP: { body: "Merhaba {{ad}} 💼 {{marka}} size yeni bir teklif gönderdi: “{{baslik}}” ({{tutar}}). {{link}}" },
    },
  },
  {
    key: "OFFER_RESPONDED",
    label: "Teklif yanıtlandı",
    vars: ["ad", "baslik", "durum"],
    defaultChannels: ["INAPP", "EMAIL"],
    templates: {
      INAPP: { subject: "Teklif yanıtı", body: "{{ad}} “{{baslik}}” teklifini {{durum}}." },
      EMAIL: { subject: "Teklif {{durum}}", body: "“{{baslik}}” teklifi {{ad}} tarafından {{durum}}." },
    },
  },
  {
    key: "PAYOUT_APPROVED",
    label: "Para çekim onayı",
    vars: ["ad", "tutar"],
    defaultChannels: ["INAPP", "EMAIL", "WHATSAPP"],
    templates: {
      INAPP: { subject: "Ödeme onaylandı", body: "{{tutar}} tutarındaki çekim talebiniz onaylandı." },
      EMAIL: { subject: "Ödemeniz onaylandı", body: "Merhaba {{ad}},\n\n{{tutar}} tutarındaki çekim talebiniz onaylandı ve ödeme sürecine alındı." },
      WHATSAPP: { body: "Merhaba {{ad}} ✅ {{tutar}} tutarındaki ödemeniz onaylandı." },
    },
  },
  {
    key: "OPEN_CALL_PUBLISHED",
    label: "Yeni açık çağrı (başvuru)",
    vars: ["marka", "baslik", "link"],
    defaultChannels: ["INAPP"],
    templates: {
      INAPP: { subject: "Yeni açık çağrı", body: "{{marka}} “{{baslik}}” başvuru çağrısını açtı." },
      EMAIL: { subject: "Yeni fırsat: {{baslik}}", body: "{{marka}} “{{baslik}}” başvuru çağrısını açtı. Başvurun: {{link}}" },
    },
  },
  {
    key: "APPLICATION_REVIEWED",
    label: "Başvuru sonucu",
    vars: ["ad", "baslik", "durum"],
    defaultChannels: ["INAPP", "EMAIL"],
    templates: {
      INAPP: { subject: "Başvuru sonucu", body: "“{{baslik}}” başvurunuz: {{durum}}." },
      EMAIL: { subject: "Başvuru sonucu: {{baslik}}", body: "Merhaba {{ad}},\n\n“{{baslik}}” başvurunuzun sonucu: {{durum}}." },
    },
  },
  {
    key: "ANNOUNCEMENT",
    label: "Özel duyuru (manuel)",
    vars: ["ad", "mesaj", "link"],
    defaultChannels: ["INAPP", "EMAIL"],
    templates: {
      INAPP: { subject: "Duyuru", body: "{{mesaj}}" },
      EMAIL: { subject: "Duyuru", body: "Merhaba {{ad}},\n\n{{mesaj}}\n\n{{link}}" },
      WHATSAPP: { body: "{{mesaj}} {{link}}" },
      INSTAGRAM: { body: "{{mesaj}} {{link}}" },
    },
  },
];

export const NOTIF_EVENT_MAP = new Map(NOTIF_EVENTS.map((e) => [e.key, e]));

/** {{anahtar}} yer tutucularını değerlerle doldurur. */
export function renderTemplate(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => vars[k] ?? "");
}
