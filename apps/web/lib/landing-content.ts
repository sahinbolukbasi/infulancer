/**
 * Tanıtım sayfası içeriği. Tek yerden düzenlenir.
 *
 * Videolar: `src` dolu ise gerçek video oynar (MP4/WebM, dikey 9:16, sessiz döngü). Dosyayı
 * `apps/web/public/landing/` altına koyup `/landing/dosya.mp4` yazın ya da herkese açık bir CDN
 * adresi verin. `src` boşsa aynı kart animasyonlu "reel" görünümüyle gösterilir.
 *
 * Referanslar: `sample: true` olanlar örnek çalışmadır ve sayfada "Örnek çalışma" etiketiyle
 * gösterilir. Gerçek müşteri izni alınan referanslarla değiştirip `sample: false` yapın.
 */
export type LandingVideo = {
  src?: string;
  poster?: string;
  creator: string;
  handle: string;
  platform: "Instagram" | "TikTok" | "YouTube";
  caption: string;
  metric: string;
  /** Video yokken kullanılan degrade (Tailwind sınıfları) */
  tone: string;
  /** Reklam/işbirliği içeriği: kartta "Reklam" etiketi */
  sponsored?: boolean;
};
export type LandingReference = {
  brand: string;
  sector: string;
  quote: string;
  person: string;
  results: { label: string; value: string }[];
  sample: boolean;
};

export const LANDING_VIDEOS: LandingVideo[] = [
  {
    creator: "Güzellik içerik üreticisi",
    handle: "@guzellik.rutini",
    platform: "Instagram",
    caption: "Sabah rutinimde yeni serum · #işbirliği",
    metric: "412B görüntülenme",
    tone: "from-rose-500/70 via-fuchsia-600/50 to-indigo-700/70",
  },
  {
    creator: "Teknoloji yorumcusu",
    handle: "@tekno.kutu",
    platform: "YouTube",
    caption: "Kutu açılımı: 30 günlük kullanım · #reklam",
    metric: "1,2M izlenme",
    tone: "from-sky-500/70 via-cyan-600/50 to-emerald-700/70",
  },
  {
    creator: "Yemek üreticisi",
    handle: "@mutfakta.bir.gun",
    platform: "TikTok",
    caption: "15 dakikada akşam yemeği · #işbirliği",
    metric: "%8,4 etkileşim",
    tone: "from-amber-500/70 via-orange-600/50 to-red-700/70",
  },
  {
    creator: "Spor koçu",
    handle: "@hareket.et",
    platform: "Instagram",
    caption: "Ev antrenmanı serisi, 3. gün · #reklam",
    metric: "2.300 kupon kullanımı",
    tone: "from-lime-500/70 via-green-600/50 to-teal-700/70",
  },
];

export const LANDING_REFERENCES: LandingReference[] = [
  {
    brand: "Kozmetik markası",
    sector: "Güzellik",
    quote: "Influencer seçiminden ödeme listesine kadar her şey tek ekranda. Rakip marka çakışmalarını artık atamadan önce görüyoruz.",
    person: "Pazarlama müdürü",
    results: [
      { label: "Erişim", value: "3,1M" },
      { label: "Ort. etkileşim", value: "%6,2" },
      { label: "Kampanya süresi", value: "21 gün" },
    ],
    sample: true,
  },
  {
    brand: "E-ticaret markası",
    sector: "Perakende",
    quote: "Kupon kodu bazlı satış takibi sayesinde hangi içerik üreticisinin gerçekten satış getirdiğini ölçebiliyoruz.",
    person: "Büyüme ekibi lideri",
    results: [
      { label: "Kupon satışı", value: "4.800" },
      { label: "ROAS", value: "5,4x" },
      { label: "Influencer", value: "18" },
    ],
    sample: true,
  },
  {
    brand: "Yiyecek-içecek markası",
    sector: "FMCG",
    quote: "Reklam açıklaması kontrolleri otomatik; yayın öncesi uyum hatalarını sıfıra indirdik.",
    person: "Marka yöneticisi",
    results: [
      { label: "Yayın", value: "64 içerik" },
      { label: "Uyum hatası", value: "0" },
      { label: "Zamanında teslim", value: "%97" },
    ],
    sample: true,
  },
];

export const LANDING_STEPS = [
  { title: "Brief ve hedef", text: "Kampanya hedeflerini, bütçeyi ve KPI ağırlıklarını girin; brief sürümlenir." },
  { title: "Doğru influencer", text: "Kategori, platform, takipçi ve etkileşim filtresiyle seçin; çakışmalar otomatik engellenir." },
  { title: "Onay ve yayın", text: "Taslak, revizyon ve yayın takvimi tek akışta; md. 23/A reklam açıklaması kontrol edilir." },
  { title: "Ölçüm ve ödeme", text: "Erişim, etkileşim ve kupon satışı skora dönüşür; hakediş ve ödeme listesi hazırlanır." },
];

export const LANDING_FEATURES = [
  { title: "Kampanya yönetimi", text: "Çoklu influencer ataması, teklif ve sözleşme takibi, haftalık yayın takvimi." },
  { title: "Gerçek metrikler", text: "Instagram, TikTok ve YouTube hesaplarından resmi API ile takipçi ve etkileşim senkronu." },
  { title: "Uyum", text: "Reklam açıklaması (md. 23/A), İYS onayları, KVKK yurt dışı aktarım kayıtları." },
  { title: "Mesaj kanalları", text: "WhatsApp ve Instagram DM gelen kutusu, AI asistan ve insan devri." },
  { title: "Finans", text: "Hakediş defteri, çekim talepleri, marka tahsilatı ve brüt fark raporu." },
  { title: "Raporlama", text: "Kampanya skoru, KPI kırılımı ve marka için PDF rapor." },
];

/** Kayan içerik üreticisi şeridi (örnek profiller; gerçek isimlerle değiştirin). */
export const LANDING_CREATORS: { handle: string; niche: string; followers: string; tone: string; platform: "Instagram" | "TikTok" | "YouTube"; city: string; engagement: string }[] = [
  { handle: "@guzellik.rutini", niche: "Güzellik", followers: "412B", tone: "from-rose-400 to-fuchsia-500", platform: "Instagram", city: "İstanbul", engagement: "%6,8" },
  { handle: "@tekno.kutu", niche: "Teknoloji", followers: "1,2M", tone: "from-sky-400 to-cyan-500", platform: "YouTube", city: "Ankara", engagement: "%4,1" },
  { handle: "@mutfakta.bir.gun", niche: "Yemek", followers: "860B", tone: "from-amber-400 to-orange-500", platform: "TikTok", city: "İzmir", engagement: "%9,2" },
  { handle: "@hareket.et", niche: "Spor", followers: "540B", tone: "from-lime-400 to-emerald-500", platform: "Instagram", city: "Antalya", engagement: "%7,5" },
  { handle: "@gezgin.not", niche: "Seyahat", followers: "320B", tone: "from-teal-400 to-sky-500", platform: "Instagram", city: "Muğla", engagement: "%5,9" },
  { handle: "@anne.gunlugu", niche: "Aile", followers: "275B", tone: "from-pink-400 to-rose-500", platform: "Instagram", city: "Bursa", engagement: "%11,3" },
  { handle: "@oyun.masasi", niche: "Oyun", followers: "980B", tone: "from-violet-400 to-indigo-500", platform: "TikTok", city: "İstanbul", engagement: "%8,0" },
  { handle: "@stil.defteri", niche: "Moda", followers: "690B", tone: "from-fuchsia-400 to-purple-500", platform: "Instagram", city: "İstanbul", engagement: "%6,2" },
];
