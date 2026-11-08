/**
 * Ülkeye göre reklam/işbirliği açıklama kuralları. Kontrol, içeriği yayınlayan influencer'ın
 * KAYITLI ülkesine göre yapılır (yayıncının tabi olduğu düzenleme).
 *
 * Kaynaklar (özet; hukuki görüş değildir, ajans gerektiğinde yerel danışmana doğrulatmalıdır):
 *  TR  Ticari Reklam ve Haksız Ticari Uygulamalar Yönetmeliği md. 23/A — ilk unsur "Reklam"/"Tanıtım" + reklam veren
 *  DE  UWG §5a(4), MStV §22 — "Werbung" / "Anzeige" başta ve açıkça
 *  AT  UWG §2, MedienG §26 — "Werbung" / "Anzeige"
 *  CH  UWG Art. 3, SLK Grundsatz B.15 — "Werbung" / "Anzeige" / "Publicité"
 *  FR  Loi n° 2023-451 (influence commerciale) art. 5 — "Publicité" / "Collaboration commerciale"
 *  BE  WER/CDE VI.17, JEP — "Publicité" / "Advertentie" / "Reclame" / "#ad"
 *  NL  Reclamecode Social Media & Influencer Marketing (RSM) — "#reclame" / "#advertentie" / "#ad"
 *  GB  CAP Code 2.1, CMA rehberi — "#ad" / "Ad" / "Advert" en başta
 *  US  FTC Endorsement Guides (16 CFR 255) — "#ad" / "Advertisement" / "Sponsored", açık ve göze çarpan
 */
export type CountryDisclosureRule = {
  country: string;
  law: string;
  /** Kabul edilen açıklama sözcükleri (küçük harf). */
  words: string[];
  /** Kural ilk unsur olmasını mı istiyor (TR) yoksa ilk bakışta görünmesini mi (diğerleri)? */
  mustBeFirst: boolean;
  /** Hashtag biçimi (#werbung) tek başına yeterli mi? */
  hashtagOk: boolean;
  /** Reklam verenin adı ilk bakışta zorunlu mu? */
  advertiserRequired: boolean;
  /** Arayüzde gösterilen kısa kural. */
  hint: string;
  /** Sesli/canlı içerik için sözlü açılış önerisi. */
  spoken: string;
};

export const COUNTRY_RULES: Record<string, CountryDisclosureRule> = {
  TR: { country: "TR", law: "Ticari Reklam Yönetmeliği md. 23/A", words: ["reklam", "tanıtım"], mustBeFirst: true, hashtagOk: false, advertiserRequired: true, hint: "İlk unsur “Reklam” veya “Tanıtım” + reklam verenin adı; hashtag tek başına yetmez.", spoken: "“[Marka] hakkında reklam içerir.”" },
  DE: { country: "DE", law: "UWG §5a(4), MStV §22", words: ["werbung", "anzeige"], mustBeFirst: false, hashtagOk: true, advertiserRequired: false, hint: "“Werbung” veya “Anzeige” ilk bakışta (ilk satır) görünmeli.", spoken: "“Dieses Video enthält Werbung für [Marke].”" },
  AT: { country: "AT", law: "UWG §2, MedienG §26", words: ["werbung", "anzeige", "bezahlte anzeige"], mustBeFirst: false, hashtagOk: true, advertiserRequired: false, hint: "“Werbung” veya “Anzeige” ilk bakışta görünmeli.", spoken: "“Enthält Werbung für [Marke].”" },
  CH: { country: "CH", law: "UWG Art. 3, SLK B.15", words: ["werbung", "anzeige", "publicité", "pubblicità", "sponsored"], mustBeFirst: false, hashtagOk: true, advertiserRequired: false, hint: "“Werbung”, “Anzeige” veya “Publicité” ilk bakışta görünmeli.", spoken: "“Enthält Werbung / contient de la publicité.”" },
  FR: { country: "FR", law: "Loi n° 2023-451 art. 5", words: ["publicité", "collaboration commerciale"], mustBeFirst: false, hashtagOk: true, advertiserRequired: false, hint: "“Publicité” veya “Collaboration commerciale” açık ve okunur biçimde, içeriğin tamamı boyunca.", spoken: "“Cette vidéo contient de la publicité pour [marque].”" },
  BE: { country: "BE", law: "CDE VI.17, JEP", words: ["publicité", "advertentie", "reclame", "ad", "werbung"], mustBeFirst: false, hashtagOk: true, advertiserRequired: false, hint: "“Publicité”, “Advertentie”, “Reclame” veya “#ad” ilk bakışta görünmeli.", spoken: "“Contient de la publicité / bevat reclame.”" },
  NL: { country: "NL", law: "Reclamecode Social Media (RSM)", words: ["reclame", "advertentie", "ad", "gesponsord"], mustBeFirst: false, hashtagOk: true, advertiserRequired: false, hint: "“#reclame”, “#advertentie” veya “#ad” ilk bakışta görünmeli.", spoken: "“Deze video bevat reclame voor [merk].”" },
  GB: { country: "GB", law: "CAP Code 2.1, CMA", words: ["ad", "advert", "advertisement", "advertising feature"], mustBeFirst: false, hashtagOk: true, advertiserRequired: false, hint: "“#ad” veya “Ad” en başta, ilk bakışta; “#sp”, “#collab” yeterli değil.", spoken: "“This video is an ad for [brand].”" },
  US: { country: "US", law: "FTC 16 CFR 255", words: ["ad", "advertisement", "sponsored", "paid partnership"], mustBeFirst: false, hashtagOk: true, advertiserRequired: false, hint: "“#ad”, “Advertisement” veya “Sponsored” açık ve göze çarpan şekilde, başta.", spoken: "“This is a sponsored video by [brand].”" },
};

export function ruleFor(country: string | null | undefined): CountryDisclosureRule {
  return COUNTRY_RULES[(country ?? "TR").toUpperCase()] ?? COUNTRY_RULES.TR!;
}

const esc = (w: string) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Açıklamanın ilk konumu (kelime ya da hashtag biçimi; yoksa -1) ve yalnız hashtag olarak mı geçtiği. */
export function findDisclosure(text: string, rule: CountryDisclosureRule): { index: number; hashtagOnly: boolean } {
  const t = text.toLocaleLowerCase(rule.country === "TR" ? "tr" : "en");
  let plainIdx = -1;
  let tagIdx = -1;
  for (const w of rule.words) {
    const plain = new RegExp(`(^|[^#\\p{L}])${esc(w)}(?![\\p{L}])`, "u").exec(t);
    if (plain) {
      const i = plain.index + plain[1]!.length;
      if (plainIdx < 0 || i < plainIdx) plainIdx = i;
    }
    const tag = new RegExp(`#${esc(w.replace(/\s+/g, ""))}(?![\\p{L}])`, "u").exec(t);
    if (tag && (tagIdx < 0 || tag.index < tagIdx)) tagIdx = tag.index;
  }
  const candidates = [plainIdx, tagIdx].filter((x) => x >= 0);
  return { index: candidates.length ? Math.min(...candidates) : -1, hashtagOnly: plainIdx < 0 && tagIdx >= 0 };
}
