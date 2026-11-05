/**
 * iCalendar (.ics) üretimi — Apple/Google/Outlook takvimlerine "etkinliği ekle" için.
 * Harici bağımlılık yok; RFC 5545 temel alanları. Dosya indirilince kullanıcının takvimine düşer.
 */
export type IcsEvent = {
  uid: string;
  title: string;
  description?: string | null;
  location?: string | null;
  startsAt: Date;
  endsAt?: Date | null;
};

function fmt(d: Date): string {
  // UTC, saniye hassasiyetinde: 20261220T190000Z
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function escapeText(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

export function buildIcs(e: IcsEvent): string {
  const end = e.endsAt ?? new Date(e.startsAt.getTime() + 2 * 3_600_000);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Infulancer//Etkinlik//TR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${e.uid}@infulancer`,
    `DTSTAMP:${fmt(new Date())}`,
    `DTSTART:${fmt(e.startsAt)}`,
    `DTEND:${fmt(end)}`,
    `SUMMARY:${escapeText(e.title)}`,
    e.description ? `DESCRIPTION:${escapeText(e.description)}` : null,
    e.location ? `LOCATION:${escapeText(e.location)}` : null,
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter((x): x is string => x !== null);
  // RFC 5545 satır sonu CRLF.
  return lines.join("\r\n") + "\r\n";
}

/** Google Takvim'e web üzerinden ekleme bağlantısı (anahtar gerektirmez). */
export function googleCalendarUrl(e: IcsEvent): string {
  const end = e.endsAt ?? new Date(e.startsAt.getTime() + 2 * 3_600_000);
  const dates = `${fmt(e.startsAt)}/${fmt(end)}`;
  const params = new URLSearchParams({ action: "TEMPLATE", text: e.title, dates });
  if (e.description) params.set("details", e.description);
  if (e.location) params.set("location", e.location);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
