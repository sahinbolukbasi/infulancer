/**
 * Platform asistanı (copilot) için kural tabanlı niyet motoru. LLM kapalıyken (mock) tek başına
 * çalışır; LLM açıkken modelin önerdiği eylemler de bu katalogla doğrulanır (serbest URL yok).
 */
export type CopilotRole = "ADMIN" | "BRAND" | "INFLUENCER";
export type CopilotForm = "campaign-start" | "campaign-request";
export type CopilotAction = { id: string; label: string; href: string };
export type CopilotReply = { reply: string; actions: string[]; form?: CopilotForm; intent: string };

/** Rol başına izinli eylemler. Asistan yalnız bunlara bağlantı verebilir. */
export const COPILOT_ACTIONS: Record<CopilotRole, CopilotAction[]> = {
  ADMIN: [
    { id: "new-campaign", label: "Yeni kampanya (tam form)", href: "/admin/kampanyalar/yeni" },
    { id: "campaigns", label: "Kampanyalar", href: "/admin/kampanyalar" },
    { id: "offers", label: "Teklifler", href: "/admin/teklifler" },
    { id: "active-campaigns", label: "Aktif kampanyalar", href: "/admin/kampanyalar?durum=AKTIF" },
    { id: "draft-campaigns", label: "Taslak kampanyalar", href: "/admin/kampanyalar?durum=TASLAK" },
    { id: "influencers", label: "Influencerlar", href: "/admin/influencerlar" },
    { id: "new-influencer", label: "Yeni influencer", href: "/admin/influencerlar/yeni" },
    { id: "brands", label: "Markalar", href: "/admin/markalar" },
    { id: "new-brand", label: "Yeni marka", href: "/admin/markalar/yeni" },
    { id: "calendar", label: "Yayın takvimi", href: "/admin/takvim" },
    { id: "finance", label: "Finans ve ödemeler", href: "/admin/finans" },
    { id: "invites", label: "Davetler ve başvurular", href: "/admin/davetler" },
    { id: "users", label: "Kullanıcılar", href: "/admin/kullanicilar" },
    { id: "agents", label: "Agent merkezi", href: "/admin/agent" },
    { id: "compliance", label: "Uyum (İYS, KVKK, 23/A)", href: "/admin/uyum" },
    { id: "channels", label: "Mesaj kanalları", href: "/admin/kanallar" },
    { id: "ads", label: "Reklam", href: "/admin/reklam" },
    { id: "creative", label: "Creative", href: "/admin/creative" },
    { id: "landing", label: "Tanıtım sayfası", href: "/admin/tanitim" },
    { id: "docs", label: "Dokümantasyon", href: "/docs" },
  ],
  BRAND: [
    { id: "campaigns", label: "Kampanyalarım", href: "/marka" },
    { id: "discover", label: "Influencer bul", href: "/marka/kesfet" },
    { id: "offers", label: "Tekliflerim", href: "/marka/teklifler" },
    { id: "inbox", label: "Gelen kutusu", href: "/marka/gelen-kutusu" },
    { id: "assistants", label: "Sohbet asistanları", href: "/marka/kanallar?sekme=asistan" },
    { id: "channels", label: "Kanallar", href: "/marka/kanallar" },
    { id: "compliance", label: "Uyum", href: "/marka/uyum" },
    { id: "docs", label: "Dokümantasyon", href: "/docs" },
  ],
  INFLUENCER: [
    { id: "jobs", label: "İşlerim", href: "/influencer" },
    { id: "offers", label: "Teklifler ve fiyat listem", href: "/influencer/teklifler" },
    { id: "payouts", label: "Ödemeler", href: "/influencer/odemeler" },
    { id: "accounts", label: "Sosyal hesaplarım", href: "/influencer/hesaplar" },
    { id: "invite", label: "Davet et", href: "/influencer/davet" },
    { id: "guide", label: "Influencer rehberi", href: "/docs/influencer/influencer-rehber" },
    { id: "metrics-guide", label: "Metrik ve ekran görüntüsü rehberi", href: "/docs/influencer/influencer-metrik-ve-ekran-goruntusu" },
  ],
};

/** Hızlı sorular (sohbet çipleri) */
export const COPILOT_SUGGESTIONS: Record<CopilotRole, string[]> = {
  ADMIN: ["Bugün ne yapmalıyım?", "Yeni kampanya başlat", "Kampanyaya influencer ekle", "Onay bekleyen taslaklar", "Ödemeler ne durumda?", "Yeni marka nasıl eklenir?"],
  BRAND: ["Bugün ne yapmalıyım?", "Teklif gönder", "Yeni kampanya talep et", "Onayımı bekleyen içerikler", "Kampanya sonuçları", "Gelen kutusu", "Reklam etiketi kuralları"],
  INFLUENCER: ["Bugün ne yapmalıyım?", "Fiyat listemi gir", "Yeni tekliflerim", "Ödememi nasıl alırım?", "Hesabımı nasıl bağlarım?", "Metrik nasıl girilir?", "Arkadaşımı davet et"],
};

const norm = (s: string) =>
  s
    .toLocaleLowerCase("tr")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .replace(/\s+/g, " ")
    .trim();
const has = (m: string, words: string[]) => words.some((w) => m.includes(norm(w)));

type Rule = { intent: string; when: string[]; reply: Partial<Record<CopilotRole, Omit<CopilotReply, "intent">>> };

const RULES: Rule[] = [
  {
    intent: "offers",
    when: ["teklif gonder", "teklif", "fiyat listesi", "fiyatim", "ucret", "influencer sec"],
    reply: {
      ADMIN: { reply: "Markaların gönderdiği teklifler Teklifler sayfasında. Kabul edilenleri tek tıkla kampanyaya ekleyin.", actions: ["offers", "campaigns"] },
      BRAND: { reply: "Influencer bul sayfasında içerik üreticilerini filtreleyip seçin, içerikleri belirleyin ve tek tıkla teklif gönderin. Yanıtlar Tekliflerim'e düşer.", actions: ["discover", "offers"] },
      INFLUENCER: { reply: "Teklifler sayfasında gelen teklifleri kabul veya reddedebilir, Fiyat listem sekmesinde içerik ücretlerinizi girebilirsiniz.", actions: ["offers"] },
    },
  },
  {
    intent: "campaign-start",
    when: ["kampanya baslat", "kampanya olustur", "yeni kampanya", "kampanya ac", "kampanya talep", "kampanya kur"],
    reply: {
      ADMIN: {
        reply: "Hemen bir taslak kampanya açalım. Markayı, adı, tarihleri ve bütçeyi girin; kaydedince kurulum sihirbazına geçersiniz (influencer seçimi → içerik planı → brief → yayın kontrolü).",
        actions: ["new-campaign", "draft-campaigns"],
        form: "campaign-start",
      },
      BRAND: {
        reply: "Kampanya talebinizi ajansınıza buradan iletebilirsiniz. Hedefinizi, tarih aralığını ve yaklaşık bütçenizi yazın; ajans ekibi taslağı hazırlayıp onayınıza sunar.",
        actions: ["campaigns"],
        form: "campaign-request",
      },
      INFLUENCER: {
        reply: "Kampanyaları ajans oluşturur ve size teklif olarak gelir. Yeni teklifleri İşlerim sayfasında kabul veya reddedebilirsiniz. Profilinizi güncel tutmak (bağlı hesaplar, kategoriler) daha çok teklif almanızı sağlar.",
        actions: ["jobs", "accounts"],
      },
    },
  },
  {
    intent: "add-influencer",
    when: ["influencer ekle", "influencer ata", "influencer bul", "influencer sec", "uretici ekle", "aday"],
    reply: {
      ADMIN: {
        reply: "Kampanyayı açıp Influencerlar sekmesinde kategori, platform ve takipçiye göre filtreleyin; birden çok kişiyi işaretleyip bedelleri girin ve tek tıkla teklif gönderin. Rakip marka çakışması olanlar otomatik engellenir. Önerilen adaylar için agent'ı çalıştırabilirsiniz.",
        actions: ["active-campaigns", "draft-campaigns", "influencers"],
      },
      BRAND: {
        reply: "Influencer seçimini ajansınız yapar; tercihlerinizi (kategori, şehir, takipçi aralığı, istemediğiniz isimler) kampanya talebinde belirtin. Atanan isimleri kampanya sayfanızda görürsünüz.",
        actions: ["campaigns"],
        form: "campaign-request",
      },
    },
  },
  {
    intent: "approvals",
    when: ["onay", "taslak", "incele", "revizyon", "bekleyen icerik"],
    reply: {
      ADMIN: {
        reply: "Onay bekleyen taslaklar Genel bakıştaki aksiyon kuyruğunda ve takvimde. Her teslimde md. 23/A kontrolü, story kareleri ve marka incelemesi görünür.",
        actions: ["calendar", "campaigns"],
      },
      BRAND: {
        reply: "Onayınızı bekleyen taslaklar Kampanyalarım sayfasının üstünde listelenir. Taslağı açıp onaylayın veya revizyon notu yazın; not içerik üreticisine iletilir.",
        actions: ["campaigns"],
      },
      INFLUENCER: {
        reply: "Revizyon istenen işler İşlerim sayfasında işaretlidir. Notu okuyup yeni taslağı yükleyin; #reklam/#işbirliği etiketini ve story karelerini unutmayın.",
        actions: ["jobs", "guide"],
      },
    },
  },
  {
    intent: "payments",
    when: ["odeme", "hakedis", "fatura", "tahsilat", "para", "iban", "cekim"],
    reply: {
      ADMIN: {
        reply: "Çekim talepleri ve ödeme listeleri Finans sayfasında. Marka tahsilatını kampanya sayfasındaki 'Marka ödemesi alındı' ile işaretleyin; marka profilinin Ödemeler sekmesi tahsil edilen/bekleyen tutarları gösterir.",
        actions: ["finance", "brands"],
      },
      BRAND: {
        reply: "Kampanya bedelleri ve faturalar ajansınızla yürütülür. Kampanya sayfanızda bütçe ve sonuçları görebilirsiniz; ödeme sorularınız için ajansa gelen kutusundan yazın.",
        actions: ["campaigns", "inbox"],
      },
      INFLUENCER: {
        reply: "Yayınlanıp onaylanan işler hakediş oluşturur. Ödemeler sayfasında kullanılabilir bakiyenizi görüp çekim talebi açabilirsiniz. IBAN ve vergi profiliniz eksikse önce onu tamamlayın.",
        actions: ["payouts"],
      },
    },
  },
  {
    intent: "reports",
    when: ["rapor", "skor", "sonuc", "performans", "erisim", "etkilesim", "roi"],
    reply: {
      ADMIN: {
        reply: "Her kampanyanın skoru ve KPI kırılımı kampanya sayfasında; marka bazında geçmiş ve brüt fark marka profilinde. Kampanya özet taslağını agent hazırlar, onaylayınca PDF rapora girer.",
        actions: ["campaigns", "brands", "agents"],
      },
      BRAND: {
        reply: "Kampanyalarım sayfasında her kampanyanın skoru, erişim ve etkileşimi görünür; kapanan kampanyalar için PDF raporu indirebilirsiniz.",
        actions: ["campaigns"],
      },
      INFLUENCER: {
        reply: "Yayından sonra metriklerinizi iş sayfasından girin veya ekran görüntüsü yükleyin; bağlı hesaplarınız otomatik güncellenir.",
        actions: ["jobs", "metrics-guide"],
      },
    },
  },
  {
    intent: "invites",
    when: ["davet", "uye", "kayit", "basvuru", "yeni kullanici"],
    reply: {
      ADMIN: {
        reply: "Davetler sayfasından marka veya influencer için kod üretin; gelen başvuruları aynı sayfada onaylayın. Kullanıcılar sayfasında rol, durum ve askıya alma işlemleri var.",
        actions: ["invites", "users"],
      },
      BRAND: { reply: "Yeni panel kullanıcısı için ajansınızdan davet isteyin.", actions: ["inbox"] },
      INFLUENCER: {
        reply: "Davet et sayfasından en fazla 5 aktif kod üretebilirsiniz (kod başına 3 kullanım, en çok 30 gün). Davet ettiğiniz kişi ajans onayından sonra katılır.",
        actions: ["invite"],
      },
    },
  },
  {
    intent: "brand",
    when: ["marka ekle", "yeni marka", "musteri ekle", "sirket ekle"],
    reply: {
      ADMIN: {
        reply: "Yeni marka formunda vergi bilgileri, yetkili, kategoriler ve rakip markaları girin. Sonra marka profilinden panel kullanıcısı ekleyip ilk kampanyayı başlatabilirsiniz.",
        actions: ["new-brand", "brands"],
      },
    },
  },
  {
    intent: "calendar",
    when: ["takvim", "yayin tarihi", "ne zaman", "gecik", "plan"],
    reply: {
      ADMIN: { reply: "Haftalık yayın takvimi ve gecikmeler Takvim sayfasında; geciken işler kırmızı işaretlidir.", actions: ["calendar"] },
      BRAND: { reply: "Kampanya sayfanızdaki yayın takvimi planlanan paylaşımları gösterir.", actions: ["campaigns"] },
      INFLUENCER: { reply: "Yayın tarihleriniz İşlerim sayfasında kitlenizin saat dilimine göre görünür.", actions: ["jobs"] },
    },
  },
  {
    intent: "inbox",
    when: ["mesaj", "whatsapp", "dm", "gelen kutusu", "sohbet", "asistan"],
    reply: {
      ADMIN: { reply: "Kanal bağlantıları ve sağlık kontrolü Kanallar sayfasında; marka gelen kutuları marka panelinde.", actions: ["channels"] },
      BRAND: {
        reply: "WhatsApp ve Instagram DM konuşmaları Gelen kutusunda. AI sohbet asistanlarınızı Asistanlar sayfasından açıp bilgi tabanını yönetebilirsiniz.",
        actions: ["inbox", "assistants", "channels"],
      },
    },
  },
  {
    intent: "compliance",
    when: ["uyum", "iys", "kvkk", "reklam etiketi", "23/a", "23a", "yasal", "isbirligi etiketi"],
    reply: {
      ADMIN: { reply: "İYS onayları, KVKK makbuzları ve md. 23/A bulguları Uyum sayfasında. Etiketsiz içerikli kampanya canlıya alınamaz.", actions: ["compliance", "docs"] },
      BRAND: { reply: "Uyum sayfanızda İYS ve KVKK durumunuz görünür. Reklam içeriklerinde #reklam veya #işbirliği etiketi ve platform açıklama ayarı zorunludur.", actions: ["compliance", "docs"] },
      INFLUENCER: { reply: "Her reklam içeriğinde başta #reklam/#işbirliği etiketi olmalı; story'de her karede görünmeli. Rehberde örnekler var.", actions: ["guide"] },
    },
  },
  {
    intent: "accounts",
    when: ["hesap bagla", "takipci", "instagram", "tiktok", "youtube", "senkron"],
    reply: {
      ADMIN: { reply: "Influencer profillerinde sosyal hesapları ve son senkron zamanını görebilirsiniz; senkron her 6 saatte bir resmî API'lerden çalışır.", actions: ["influencers", "agents"] },
      INFLUENCER: {
        reply: "Sosyal hesaplarım sayfasından kullanıcı adınızı ekleyin; YouTube ve Instagram Business/Creator hesapları otomatik güncellenir, TikTok için hesabınızla giriş yapın.",
        actions: ["accounts"],
      },
    },
  },
];

const FALLBACK: Record<CopilotRole, Omit<CopilotReply, "intent">> = {
  ADMIN: {
    reply: "Kampanya başlatma, influencer ekleme, onaylar, ödemeler, raporlar, davetler ve uyum konularında yardımcı olabilirim. Aşağıdaki kısayollardan birini seçin veya ne yapmak istediğinizi yazın.",
    actions: ["campaigns", "influencers", "finance", "invites"],
  },
  BRAND: {
    reply: "Kampanya talebi, içerik onayı, sonuçlar, gelen kutusu ve uyum konularında yardımcı olabilirim. Ne yapmak istediğinizi yazın.",
    actions: ["campaigns", "inbox", "compliance"],
  },
  INFLUENCER: {
    reply: "Teklifler, teslimler, ödemeler, hesap bağlama ve davet konularında yardımcı olabilirim. Ne yapmak istediğinizi yazın.",
    actions: ["jobs", "payouts", "accounts"],
  },
};

const SUMMARY_WORDS = ["ne yapmaliyim", "bugun", "ozet", "merhaba", "selam", "yardim", "nereden baslamaliyim", "neler yapabilirim", "basla"];

/** Mesajı niyete eşler. "Bugün ne yapmalıyım" gibi özet istekleri `summary` döner (yanıtı çağıran, anlık verilerle kurar). */
export function matchIntent(role: CopilotRole, message: string): CopilotReply {
  const m = norm(message);
  if (has(m, SUMMARY_WORDS) && !RULES.some((r) => r.reply[role] && has(m, r.when))) return { intent: "summary", reply: "", actions: [] };
  for (const r of RULES) {
    const rep = r.reply[role];
    if (rep && has(m, r.when)) return { intent: r.intent, ...rep };
  }
  return { intent: "fallback", ...FALLBACK[role] };
}

/** LLM veya istemciden gelen eylem kimliklerini rol kataloğuyla süzer. */
export function allowedActions(role: CopilotRole, ids: unknown): CopilotAction[] {
  if (!Array.isArray(ids)) return [];
  const byId = new Map(COPILOT_ACTIONS[role].map((a) => [a.id, a]));
  return [...new Set(ids.filter((x): x is string => typeof x === "string"))].map((id) => byId.get(id)).filter((a): a is CopilotAction => !!a).slice(0, 4);
}
