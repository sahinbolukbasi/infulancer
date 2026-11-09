import { BRAND_NAME, SUPPORT_EMAIL } from "../brand";
import type { Locale } from "../i18n/regions";

/**
 * Markalı (Nordvow) responsive e-posta HTML'i. Bildirim şablonlarındaki düz metin gövde
 * bu çerçeveye sarılır; e-posta istemcilerinde güvenli olması için tablo tabanlı,
 * satır içi stilli ve tek sütundur. İçerik düz metin olarak gelir (güvenli kaçışlanır),
 * paragraflar boş satırla ayrılır ve {{link}} varsa CTA butonuna dönüşür.
 */
export type EmailContent = {
  subject: string;
  /** Düz metin gövde (şablondan). */
  body: string;
  /** Varsa CTA bağlantısı (gövdedeki URL'den ayrı geçilebilir). */
  ctaUrl?: string | null;
  ctaLabel?: string;
  /** Alıcıya hitap (opsiyonel; gövdede zaten olabilir). */
  preheader?: string;
  /** E-posta dili (CTA etiketi ve altbilgi bu dilde). */
  locale?: Locale;
};

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Metindeki ilk http(s) URL'sini bulur (CTA butonu için). */
export function firstUrl(text: string): string | null {
  const m = text.match(/https?:\/\/[^\s)]+/);
  return m ? m[0] : null;
}

/** Düz metni, URL'leri tıklanabilir yaparak paragraf HTML'ine çevirir. */
function bodyToHtml(body: string): string {
  const paragraphs = body.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  return paragraphs
    .map((p) => {
      const withBreaks = escapeHtml(p).replace(/\n/g, "<br />");
      const linked = withBreaks.replace(/(https?:\/\/[^\s)]+)/g, '<a href="$1" style="color:#111111;text-decoration:underline;">$1</a>');
      return `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#2b2b2b;">${linked}</p>`;
    })
    .join("");
}

/** Markalı HTML e-posta üretir (tablo tabanlı, satır içi stil). */
const COPY: Record<string, { cta: string; footer: (b: string, e: string) => string }> = {
  tr: { cta: "Görüntüle", footer: (b, e) => `Bu e-posta ${b} tarafından gönderildi. Sorularınız için ${e}.` },
  en: { cta: "View", footer: (b, e) => `This email was sent by ${b}. Questions? ${e}.` },
  de: { cta: "Ansehen", footer: (b, e) => `Diese E-Mail wurde von ${b} gesendet. Fragen? ${e}.` },
  fr: { cta: "Voir", footer: (b, e) => `Cet e-mail a été envoyé par ${b}. Des questions ? ${e}.` },
};
export function renderBrandedEmail(content: EmailContent): string {
  const copy = COPY[content.locale ?? "tr"] ?? COPY.tr!;
  const cta = content.ctaUrl ?? firstUrl(content.body);
  const ctaLabel = content.ctaLabel ?? copy.cta;
  const preheader = content.preheader ?? content.subject;
  const year = new Date().getFullYear();
  const ctaBlock = cta
    ? `<tr><td style="padding:8px 0 24px;">
         <a href="${cta}" style="display:inline-block;background:#111111;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:12px 24px;border-radius:999px;">${escapeHtml(ctaLabel)}</a>
       </td></tr>`
    : "";
  return `<!doctype html>
<html lang="${content.locale ?? "tr"}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="color-scheme" content="light only" />
<title>${escapeHtml(content.subject)}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:24px 0;">
  <tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #ececef;">
      <tr>
        <td style="padding:28px 32px 16px;border-bottom:1px solid #f0f0f2;">
          <span style="font-size:20px;font-weight:700;letter-spacing:-0.02em;color:#111111;">${escapeHtml(BRAND_NAME)}</span>
        </td>
      </tr>
      <tr>
        <td style="padding:28px 32px 8px;">
          <h1 style="margin:0 0 16px;font-size:19px;line-height:1.35;color:#111111;font-weight:650;">${escapeHtml(content.subject)}</h1>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr><td>${bodyToHtml(content.body)}</td></tr>
            ${ctaBlock}
          </table>
        </td>
      </tr>
      <tr>
        <td style="padding:20px 32px 28px;border-top:1px solid #f0f0f2;">
          <p style="margin:0 0 6px;font-size:12px;line-height:1.5;color:#8a8a8f;">
            ${escapeHtml(copy.footer(BRAND_NAME, "")).replace(new RegExp("\\s+\\.$"), "")}
            <a href="mailto:${SUPPORT_EMAIL}" style="color:#6b6b70;text-decoration:underline;">${SUPPORT_EMAIL}</a>
          </p>
          <p style="margin:0;font-size:12px;color:#b4b4b8;">© ${year} ${escapeHtml(BRAND_NAME)}</p>
        </td>
      </tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}
