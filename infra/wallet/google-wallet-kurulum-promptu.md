# GOOGLE WALLET KURULUM PROMPTU (bir AI asistanına verilecek)

Aşağıdaki metnin tamamını ChatGPT/Claude gibi bir asistana yapıştır. Asistan seni
adım adım yönlendirir ve sonunda 2 değeri verir: `GOOGLE_WALLET_ISSUER_ID` ve
`GOOGLE_WALLET_SA_KEY`. Bu iki değeri bana (Kiro'ya) geri getir; ben AWS Secrets
Manager'a koyup canlıya alacağım.

---

Sen bir Google Wallet entegrasyon uzmanısın. "Nordvow" adlı bir influencer pazarlama
platformu için Google Wallet'a bilet ve kupon ekleme özelliğini kuruyoruz. Backend
kodu HAZIR ve test edildi; sadece Google tarafındaki hesap kurulumu + 2 ortam değeri
eksik. Beni adım adım, ekran ekran yönlendir. Türkçe anlat.

BAĞLAM (bende zaten var):
- Google Cloud projesi: mapsbridge-508010
- Google Wallet API: ETKİNLEŞTİRİLDİ
- Servis hesabı: nordvow-wallet@mapsbridge-508010.iam.gserviceaccount.com (OLUŞTURULDU)
- Servis hesabı JSON anahtarı: İNDİRİLDİ (elimde, dosya olarak)
- Google hesabım: sahinbolukbasii@gmail.com

KODUN BEKLEDİĞİ "GENERIC" PASS YAPISI (değiştiremem, bilgi olsun):
- genericClasses + genericObjects kullanıyorum (generic pass).
- Her pass: cardTitle="Nordvow", header=başlık, subheader=alt başlık,
  barcode=QR_CODE, hexBackgroundColor=marka rengi, 4 adete kadar textModulesData.
- JWT RS256 ile servis hesabı özel anahtarıyla imzalanıyor, origins=["https://nordvow.com"].
- Sınıf kimliği biçimi: "<ISSUER_ID>.nordvow_ticket" ve "<ISSUER_ID>.nordvow_coupon".

SENDEN İSTEDİĞİM ADIMLAR:
1. pay.google.com/business/console'a nasıl kaydolacağımı anlat; Issuer (yayıncı)
   hesabı oluşturma ekranını tarif et. Sonunda aldığım 19 haneli ISSUER ID'yi nereden
   kopyalayacağımı göster.
2. Aynı konsolda, oluşturduğum servis hesabını (yukarıdaki e-posta) "Users/Access"
   bölümünden nasıl ekleyeceğimi ve hangi rolü (Developer/Admin) vereceğimi anlat.
   Bu adım şart: servis hesabı yetkili olmadan pass oluşturulamaz.
3. Generic pass için ayrıca bir "class" konsolda elle oluşturmam gerekiyor mu, yoksa
   JWT içinde genericClasses göndermem yeterli mi? (Benim kodum JWT içinde gönderiyor.)
   Net söyle; gerekiyorsa class oluşturma adımlarını ver.
4. Test: "Save to Google Wallet" linkini telefonda nasıl deneyeceğimi anlat.
5. SONUÇ: Bana tam olarak şu 2 değeri toplamamı hatırlat ve formatını söyle:
   - GOOGLE_WALLET_ISSUER_ID  (ör. 3388000000022xxxxxx — 19 hane)
   - GOOGLE_WALLET_SA_KEY     (servis hesabı JSON dosyasının TAM içeriği, tek satıra sıkıştırılmış)

KURALLAR:
- Gerçek bir ücret/iş onayı gerekiyorsa uyar.
- Güvenlik: servis hesabı JSON'unu kimseyle paylaşmamam gerektiğini hatırlat (yalnız
  benim altyapıma, Secrets Manager'a girecek).
- Her adımda hangi URL'de, hangi butona basacağımı net yaz.
```
