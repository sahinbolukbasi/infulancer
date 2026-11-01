# Influencer Ajans Yönetim Platformu — Ürün ve Tasarım Spesifikasyonu

Nov 1, 2026 · @Şahin Bölükbaşı

## Ürün özeti ve roller

Platform üç tarafı tek operasyonda birleştirir: ajans kampanyayı kurar, influencer işi teslim eder, marka sonucu izler. Ajansın asıl değeri burada otomasyon değil, **doğrulanmış teslim ve ölçüm** — yani "influencer işi yaptı mı, zamanında mı, hedefe ulaştı mı" sorusunun kanıtlanabilir cevabı.

**Roller ve yetkiler**

| Rol | Ne yapar | Göremez |
| --- | --- | --- |
| Admin (ajans) | Kampanya kurar, influencer atar, içerik onaylar, ödeme gönderir, tüm veriyi görür | — |
| Marka | Kendi kampanyalarını, takvimi, raporu ve onay bekleyen içeriği görür | Influencer bedelleri, ajans komisyonu, diğer markalar |
| Influencer | Atandığı işleri, brief'i, dosyaları, teslim takvimini, bakiyesini görür | Marka bütçesi, diğer influencerlar, komisyon |
| Agent (sistem) | Kontrol çalıştırır, uyarı üretir, metrik doğrular | Yazma yetkisi yok — sadece öneri/uyarı üretir |

Kritik tasarım kararı: agent'lar **karar vermez, işaretler**. Otomatik red/onay koyarsan ilk yanlış pozitifte influencer ilişkisi bozulur. Agent çıktısı admin kuyruğuna düşer, admin tek tıkla onaylar veya ezer.

## Veri modeli

Tüm ürünün omurgası `Deliverable` tablosu. Kampanya değil, **tek bir paylaşım** atömik birim: brief, dosya, planlanan saat, teslim, metrik ve ödeme hep ona bağlı. Bunu kampanya seviyesinde tutarsan çok platformlu kampanyada her şey bulanır.

| Entity | Ana alanlar | Notlar |
| --- | --- | --- |
| `Brand` | ad, vergi bilgisi, iletişim, sözleşme | marka kullanıcıları buna bağlı |
| `Influencer` | ad, platform hesapları, kategori, ödeme bilgisi, vergi durumu | fatura kesebiliyor mu alanı zorunlu |
| `SocialAccount` | influencer\_id, platform, handle, takipçi, ER, demografi snapshot | platform başına ayrı kayıt |
| `Campaign` | brand\_id, ad, bütçe, tarih aralığı, hedef KPI'lar, durum | hedefler JSON: reach, ER, click, satış |
| `CampaignBrief` | campaign\_id, metin, do/don't, hashtag, mention, etiket zorunluluğu | versiyonlu |
| `Assignment` | campaign\_id, influencer\_id, bedel, komisyon, sözleşme durumu | influencer'ın kampanyaya kabulü burada |
| `Deliverable` | assignment\_id, platform, içerik tipi, planlanan tarih-saat, durum, post\_url | **atömik birim** |
| `Asset` | deliverable\_id veya campaign\_id, dosya, tip, yön (ajans→influencer / influencer→ajans) | S3 + imzalı URL |
| `MetricSnapshot` | deliverable\_id, ölçüm zamanı, reach, impression, like, comment, save, share, click, kaynak | kaynak: manuel / ekran görüntüsü / API |
| `AgentRun` | hedef tip+id, kontrol tipi, bulgu, severity, durum | admin kuyruğunu besler |
| `LedgerEntry` | influencer\_id, tutar, yön, sebep, referans | **bakiye hesaplanmaz, yazılmaz — türetilir** |
| `PayoutRequest` | influencer\_id, tutar, durum, IBAN snapshot, admin notu | çekim talebi |

İki şey baştan doğru kurulmalı: **bakiye** hiçbir yerde kolon olarak tutulmaz, `LedgerEntry` toplamından türetilir (çift kayıt mantığı, mutabakat için tek doğru yöntem). **Metrikler** üstüne yazılmaz, snapshot olarak biriktirilir — 24. saat, 7. gün, 30. gün ayrı kayıt; büyüme eğrisini ancak böyle gösterirsin.

## Kampanya yaşam döngüsü

&#91;embedded content: kampanya yaşam döngüsü · 8 adım, 2 karar noktası\]

Sözleşme reddi influencer'ı kampanyadan çıkarır, seçim adımına döner; taslak reddi revizyon döngüsüne girer ve yayın saatini kaydırmaz — revizyon süresi brief'teki deadline'a dahildir.

Her durum geçişi `Deliverable.status` üzerinde tutulur ve audit log'a yazılır. Durum kümesi: `taslak`, `atandı`, `brief_gönderildi`, `içerik_yüklendi`, `revizyon`, `onaylandı`, `yayınlandı`, `metrik_bekliyor`, `tamamlandı`, `iptal`. Geriye dönüş yalnızca admin yetkisiyle mümkün — influencer kendi işini "yayınlandı"dan geri alamaz.

## İçerik planlama, takvim ve dosya paylaşımı

Takvim ekranı platformun kalbi: haftalık görünümde satırlar influencer, kolonlar gün, hücrelerde planlanan paylaşımlar platform ikonuyla. Sürükle-bırak ile saat/gün değişir, değişiklik influencer'a bildirim olarak gider.

**Paylaşım planı alanları** (her `Deliverable` için): platform, içerik tipi, planlanan tarih-saat (influencer'ın kitle saat dilimiyle), caption/açıklama metni, hashtag seti, mention'lar, link (UTM'li), işbirliği etiketi zorunluluğu, teslim deadline'ı (yayından önce onay için).

**Platform bazlı kurallar — ayrı şema gerekir.** Üç platformun içerik tipi, teknik kısıtı ve ölçüm metriği aynı değil; tek bir jenerik "post" modeli kurarsan raporlama baştan çöker.

|  | Instagram | TikTok | YouTube |
| --- | --- | --- | --- |
| İçerik tipleri | Reels, Story, Carousel, Feed, Live | Video, Photo, LIVE | Video, Shorts, Community post |
| Süre/format kısıtı | Story 24s ömürlü, Reels 9:16 | 9:16, hook ilk 3 sn | Shorts 9:16 / long-form 16:9 |
| Zorunlu etiket | Reklam İşbirliği (paid partnership) | Branded content toggle | Paid promotion disclosure |
| Ana metrikler | reach, saves, shares, profil tıklama | views, watch time, completion rate | views, AVD, CTR, abone değişimi |
| Link yerleşimi | Story sticker / bio | bio / Spark Ads | açıklama + pinned comment |
| Kritik kısıt | Story metriği 24 saatte kaybolur → **zorunlu SS** | silinme sık → arşiv zorunlu | metrik 48-72 saat oturmaz |

Story için 24 saat içinde ekran görüntüsü alınmazsa veri kalıcı kaybolur. Bu yüzden Story deliverable'ında sistem yayından 20 saat sonra influencer'a zorunlu hatırlatma atar ve metrik girişi yapılmadan iş "tamamlandı" olmaz.

**Dosya paylaşımı iki yönlü.** Ajans→influencer: brief PDF, marka logo/font, örnek çekimler, ürün fotoları, onaylı caption. Influencer→ajans: çekim öncesi taslak (onaya), yayın sonrası ham dosya (markanın kendi reklamında kullanması için), metrik ekran görüntüleri. Depolama S3, erişim presigned URL (15 dk TTL), büyük dosya için multipart upload. Ham video dosyaları 60 gün sonra Glacier'a geçsin — maliyet kalemin burada patlar.

**Kullanım haklarını veri modeline koy.** Her `Asset` için: kullanım süresi, mecra (sadece organik / paid reklam dahil), coğrafya. Sözleşmede yazıp sistemde tutmazsan marka süre bitince reklamda kullanmaya devam eder, fatura sana döner.

## Analitik: giriş, doğrulama, hedef hesabı

Metrik girişinde üç kaynak var ve güvenilirlikleri farklı. Veri modelinde `source` alanı bunu taşır, raporda güven seviyesi olarak gösterilir.

1. **Manuel giriş + ekran görüntüsü** — MVP'de tek yol. Influencer formu doldurur, SS yükler. Agent SS'teki sayıları okuyup forma girilen değerle karşılaştırır, uyuşmazsa işaretler.
2. **Resmi API'ler** — Instagram Graph API (Creator/Business hesap + izin akışı gerekir), TikTok Display API, YouTube Data API. Her biri influencer'ın OAuth onayına bağlı; influencer'ların önemli kısmı bunu vermez, o yüzden manuel yol hiç kapanmaz.
3. **Marka tarafı veri** — UTM + kupon kodu üzerinden tıklama ve satış. En değerlisi bu, çünkü kurumsal müşteriye ROAS göstermenin tek yolu.

Scraping'i planlama: platformların ToS'una aykırı, kırılgan, ve kurumsal müşteriye veri kaynağını açıklayamazsın.

**Hedefe ulaşıldı mı hesabı.** `Campaign.targets` içinde her KPI için hedef, ağırlık ve ölçüm penceresi tutulur (örn. reach 500.000, ağırlık 0.3, pencere 30 gün). Kampanya skoru ağırlıklı gerçekleşme oranı; ekranda tek yüzde + KPI başına kırılım gösterilir.

Eşikler: %100+ ulaşıldı, %85-100 kısmen, %85 altı ulaşılamadı. Pencere kapanmadan "ulaşılamadı" yazmamak önemli — YouTube'da metrik 72 saatte oturmaz, erken karar yanlış alarm üretir. Pencere içindeyken durum "ölçülüyor" kalır ve projeksiyon gösterilir.

Snapshot kademesi: yayın + 24 saat, + 7 gün, + 30 gün. Üç nokta hem büyüme eğrisi çizmeye hem de "içerik silindi mi" kontrolüne yeter.

## Agent katmanı

Agent'lar deterministik kontrollerle LLM kontrollerinin karışımı. Kuralı şu: **sayılabilen şey kodla, yorum gerektiren şey modelle** kontrol edilir. Her şey için LLM çağırmak hem pahalı hem güvenilmez.

| Agent | Tetikleyici | Ne kontrol eder | Tip | Çıktı |
| --- | --- | --- | --- | --- |
| Brief uyum | Taslak içerik yüklenince | Hashtag, mention, zorunlu cümle, yasaklı ifade, işbirliği etiketi | Kod + LLM | Eksik listesi, admin kuyruğu |
| Yayın kontrol | Planlanan saat + 30 dk | Post URL girildi mi, canlı mı | Kod | Gecikme uyarısı |
| Silinme kontrol | Günlük, 30 gün boyunca | İçerik hâlâ erişilebilir mi | Kod | Kritik uyarı + sözleşme ihlali bayrağı |
| Metrik tutarlılık | Metrik girişinde | SS'teki sayı = forma girilen sayı; ER mantıklı aralıkta mı | LLM (vision) + kod | Uyuşmazlık işareti |
| Sahte etkileşim | Influencer eklenince, aylık | ER/takipçi oranı, yorum kalitesi, takipçi artış eğrisi | Kod + LLM | Risk skoru |
| Hedef projeksiyon | Günlük | Mevcut eğriyle hedefe varılır mı | Kod | Erken uyarı "hedefin %60'ında" |
| Kampanya özeti | Kampanya kapanınca | Tüm veriyi marka raporu metnine çevirir | LLM | Rapor taslağı |
| Influencer öneri | Kampanya kurulurken | Kategori, demografi, geçmiş performans, müsaitlik, marka çakışması | Kod (skorlama) + LLM (gerekçe) | Sıralı aday listesi |

Marka çakışması kontrolü ticari olarak en kritik olanı: influencer son 30 günde rakip markayla çalışmışsa kurumsal müşteri bunu ihlal sayar. Sözleşmedeki münhasırlık süresi `Assignment` içinde tutulur ve agent atama öncesi bloklar.

**Mimari.** Her agent idempotent bir job; EventBridge (zamanlı) veya SQS (olay) tetikler, Lambda koşturur, sonuç `AgentRun` olarak yazılır. LLM gerektirenler Bedrock üzerinden — vision işi (SS okuma) için multimodal model, metin kontrolü için küçük ve hızlı model yeter. Her `AgentRun` prompt versiyonunu ve model adını saklar; aksi halde üç ay sonra "bu uyarı neden çıktı" sorusunu cevaplayamazsın.

## Finans modülü

Bakiye `LedgerEntry` kayıtlarının toplamı; güncellenen bir bakiye kolonu yok. Influencer ekranında üç ayrı rakam gösterilir — bunları tek rakama indirmek en sık yapılan hata:

- **Hakedilen** — iş teslim edildi, kampanya kapanmadı; henüz çekilemez
- **Çekilebilir** — kampanya kapandı, marka ödemesi alındı, hak ettirici süre (örn. 14 gün) geçti
- **İşlemde** — çekim talebi açılmış, ödeme henüz gönderilmemiş

Hak ettirici süre şart: içerik yayından sonra silinirse veya metrik doğrulanamazsa ödemeyi tutmanın tek yolu bu. Para çıktıktan sonra influencer'dan geri istemek pratikte yürümez.

**Çekim talebi akışı.** Influencer talep açar (tutar, kayıtlı IBAN) → sistem çekilebilir bakiyeyi ve minimum tutarı doğrular → talep admin kuyruğuna düşer → admin onaylar → ödeme listesine girer → ödeme gönderilir, çıkış kaydı yazılır, talep kapanır. Her adım audit log'a düşer.

**Admin ödeme paneli.** Onaylanmış talepler toplu listede: influencer, tutar, IBAN, vergi durumu, seçim kutuları. Seçilenler için banka formatında toplu transfer dosyası (CSV/XML) üretilir.

Platformdan doğrudan para gönderme kurgulama — ödeme hizmeti saklama/transfer işi lisansa tabi. Platform **ödeme talimatı üretir**, transferi banka yapar. Bu hem hukuki hem de en hızlı MVP yolu.

**Vergi tarafı.** Influencer fatura kesebiliyorsa gider belgesi onun faturası; kesemiyorsa günlük/serbest meslek makbuzu veya stopajlı ödeme gerekir. `Influencer.vergi_durumu` alanı ödeme ekranında uyarı üretir, aksi halde yıl sonunda gider yazamadığın ödemelerle kalırsın. Mali müşavirle netleştirilmesi gereken bir konu.

## Dashboardlar

Üç ayrı giriş, üç ayrı ana ekran. Hepsinde aynı bileşen kütüphanesi, farklı veri ve yetki.

**Admin — operasyon merkezi.** Üst satırda dört KPI: aktif kampanya, bekleyen onay, geciken teslim, ödenecek tutar. Altında **aksiyon kuyruğu** — platformun en önemli ekranı: onay bekleyen içerikler, agent uyarıları, çekim talepleri, geciken işler tek listede severity sıralı. Yanında haftalık takvim özeti. Admin gününe bu ekrandan başlar; "neye bakmam gerekiyor" sorusunu tek ekranda cevaplamayan panel kullanılmaz.

**Marka ekranı.** Kampanya skoru (tek yüzde, büyük), KPI kırılımı, yayın takvimi, influencer bazlı performans tablosu, içerik galerisi (yayınlanmış postların önizlemesi + linkleri), onay bekleyen taslaklar. Altında indirilebilir rapor. Marka bedel görmez — sadece kendi ödediği toplam ve sonuç.

**Influencer ekranı.** Atanan işler (durum etiketleriyle), bu haftanın teslim takvimi, brief ve dosyalar, metrik giriş formu, üç bakiye rakamı ve çekim butonu, geçmiş ödemeler. Mobil-first tasarlanmalı — influencer'ların tamamı telefondan girer.

**Influencer takip ekranı (admin).** Havuzdaki her influencer için: platform hesapları ve ER trendi, tamamlanan kampanya sayısı, zamanında teslim oranı, ortalama performans, risk skoru, münhasırlık durumu, toplam ödenen. Zamanında teslim oranı ve risk skoru ikilisi kime iş vereceğine karar verdiğin yer — takipçi sayısı değil.

## Teknik mimari

&#91;embedded content: teknik mimari · 5 katman, AWS\]

Stack önerisi mevcut AWS + Terraform deneyimine dayanıyor: Next.js (tek uygulama, rol bazlı üç arayüz), API için ECS Fargate veya tek başlangıçta Lambda, Postgres (RDS), dosyalar S3 + CloudFront, zamanlı işler EventBridge, agent'lar Lambda + Bedrock. Tümü Terraform ile.

Faz 1'de ECS'e gerek yok — Lambda + API Gateway tek kişilik ekipte hem ucuz hem bakımsız. Trafik ve cold start problem olunca Fargate'e geçilir.

Ayrı tutulması gereken iki şey: **audit log** uygulama veritabanından bağımsız yazılır (finans hareketleri ve durum geçişleri için değiştirilemez kayıt gerekir), ve **dosya erişimi** uygulama üzerinden proxy'lenmez — presigned URL ile doğrudan S3'ten verilir, aksi halde video trafiği API'yi boğar.

## MVP kapsamı ve faz planı

Tek kişilik ekiple bunun tamamını yazmak aylar alır ve o sürede ajansın gelir üretmez. Sıralama bu yüzden "müşteriye gösterilebilir olan" önce.

| Faz | Kapsam | Neden burada |
| --- | --- | --- |
| **Faz 0** — yazılım yok | Notion/Airtable + Drive + sözleşme şablonu | İlk 2-3 kampanyayı manuel yürüt, gerçek acıyı gör. Yazdığın şey ancak bundan sonra doğru olur |
| **Faz 1** — çekirdek | Auth + rol, kampanya/assignment/deliverable CRUD, takvim, dosya yükleme, manuel metrik girişi, kampanya skoru | Markaya gösterilebilir ilk ürün. Burada bile ajans tam çalışır |
| **Faz 2** — güven | Marka dashboard'u, PDF rapor üretimi, influencer takip ekranı | Kurumsal satışın bileti; case study buradan çıkar |
| **Faz 3** — finans | Ledger, bakiye, çekim talebi, admin ödeme listesi | Influencer sayısı 15-20'yi geçince manuel takip çöker |
| **Faz 4** — agent | Brief uyum, yayın/silinme kontrolü, metrik tutarlılık, kampanya özeti | Operasyon hacmi varken anlamlı; öncesinde çözüm arayışında problem yok |
| **Faz 5** — entegrasyon | Platform API'leri (OAuth), otomatik metrik çekme | En zor, en kırılgan, en az acil |

Faz 1'i 4-6 hafta içinde tek başına çıkarabilirsin. Faz 5'i hiç yapmasan da ajans yürür — manuel giriş + doğrulama agent'ı pratikte yeterli.

Dikkat: bu platform **iç operasyon aracı** olarak başlıyor, SaaS olarak değil. İkisini aynı anda kovalamak tek kişilik ekipte ikisini de bitirmemek demek. Ürünleştirme kararı, ajans 10+ kampanya yürüttükten ve araç gerçekten işe yaradıktan sonra verilir.

## Tasarım promptu

Aşağıdaki blok olduğu gibi kopyalanıp bir tasarım/kod üretim aracına verilebilir. Tek ekran isteyeceksen son satırdaki ekran listesini kendi istediğin ekrana indir — hepsini birden isteyince kalite düşer.

```markdown
Bir influencer pazarlama ajansı yönetim panelinin arayüzünü tasarla.

GÖRSEL DİL
Tamamen siyah-beyaz, renk yok. Tek vurgu rengi beyazın kendisi.
Durum bildirimi renkle değil tipografi, nokta işareti ve opaklıkla yapılır.
Arka plan #0A0A0A, yüzeyler #141414, kenarlıklar #262626 (1px).
Birincil metin #FAFAFA, ikincil #A1A1A1, pasif #525252.
Köşe yarıçapı 8px, kart içi boşluk 24px, grid aralığı 16px.
Gölge yok; derinlik kenarlık ve yüzey tonu farkıyla kurulur.
Tipografi: Inter veya Geist. Başlık 32/600, bölüm 18/600, gövde 14/400,
etiket 12/500 harf aralığı 0.02em büyük harf. Sayılar tabular-nums.
Büyük metrik rakamları 48/600, sıkı satır aralığı.
İkonlar ince çizgi (1.5px stroke), dolgu yok.
Bol negatif alan. Kalabalık değil, sakin ve pahalı duracak.

ANİMASYON
Tüm geçişler 200ms cubic-bezier(0.4, 0, 0.2, 1).
Sayfa girişi: içerik blokları 8px aşağıdan yukarı kayarak ve opaklık 0→1,
60ms gecikmeli zincir (stagger).
Kart hover: kenarlık #262626→#404040, 1px yukarı ötelenme.
Metrik sayıları: ilk yüklemede 0'dan hedefe sayarak artar (600ms).
Progress bar ve skor halkası: soldan sağa / saat yönünde çizilerek dolar.
Tablo satırı hover: arka plan #141414→#1A1A1A.
Modal: 96% → 100% ölçek + opaklık, arkada backdrop blur.
Yükleme durumu: spinner yerine skeleton shimmer (soldan sağa açık gri dalga).
Sekme değişimi: altçizgi aktif sekmeye kayarak geçer.
Takvimde sürükle-bırak: sürüklenen kart 2° eğilir ve hafif büyür,
hedef hücre kesikli kenarlıkla belirir.
Tercih edilen hareket az ise (prefers-reduced-motion) tüm animasyonlar kapanır.

YERLEŞİM
Sol sabit kenar çubuğu 240px, daraltılabilir 64px'e.
Üstte 64px başlık çubuğu: arama, bildirim, hesap.
İçerik alanı maksimum 1440px, ortalanmış.
12 kolon grid. Mobilde tek kolon, kenar çubuğu alt sekme çubuğuna dönüşür.

BİLEŞENLER
Metrik kartı: etiket, büyük rakam, küçük değişim göstergesi (↑↓ ok + yüzde),
altında minik sparkline (tek çizgi, dolgu yok).
Veri tablosu: zebra yok, sadece ince ayraklar; başlık satırı sticky;
sıralama oku; satır sonunda açılır menü.
Durum etiketi: pill değil, 6px içi dolu nokta + metin.
Kampanya skoru: kalın halka grafik, ortada yüzde, altında hedef kırılımı.
Takvim: 7 kolon haftalık ızgara, hücrelerde kompakt içerik kartları,
her kartın üstünde platform ikonu ve saat.
Aksiyon kuyruğu: sol kenarında 2px dikey çizgi olan liste öğeleri,
önem derecesi çizginin parlaklığıyla verilir.
Dosya yükleme: kesikli kenarlıklı bölge, sürükleyince içi dolar.
Boş durum: ince çizgi illüstrasyon + tek cümle + tek buton.

EKRANLAR
1. Admin genel bakış: 4 metrik kartı, aksiyon kuyruğu, haftalık takvim özeti
2. Kampanya detayı: skor halkası, KPI kırılımı, influencer tablosu, içerik galerisi
3. İçerik takvimi: sürükle-bırak haftalık ızgara, platform filtreleri
4. Influencer profili: hesap kartları, performans grafikleri, geçmiş kampanyalar
5. Finans: bakiye kartları, çekim talepleri tablosu, toplu ödeme ekranı

Dil Türkçe. Gerçekçi örnek veri kullan, lorem ipsum kullanma.
```

Promptta bilinçli olarak renk yasağı var ama durum bildirimi için bir kaçış kapısı bırakmak isteyebilirsin: tamamen renksiz arabirimde "kritik uyarı" ile "bilgi" ayrımı zayıf kalır. Pratik çözüm, siyah-beyazı koruyup yalnız kritik durum için tek bir kırmızı ton (#EF4444) eklemek — tasarım dilini bozmaz, güvenliği arttırır.
