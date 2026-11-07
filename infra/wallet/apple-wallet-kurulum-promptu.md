# APPLE WALLET KURULUM PROMPTU (bir AI asistanına verilecek)

Aşağıdaki metnin tamamını ChatGPT/Claude gibi bir asistana yapıştır. Asistan seni
adım adım yönlendirir ve sonunda 5 değeri verir (hepsi Secrets Manager'a girecek).
Çıkan değerleri bana (Kiro'ya) geri getir; AWS'ye koyup canlıya alacağım.

NOT: Apple, PassKit sertifikasını yalnızca Apple Developer portalından MANUEL verir
(API/CLI yok). Ücretli Apple Developer Program üyeliği ($99/yıl) gerekir.

---

Sen bir Apple Wallet (PassKit) entegrasyon uzmanısın. "Nordvow" adlı influencer
pazarlama platformu için Apple Wallet'a bilet/kupon (.pkpass) ekleme kuruyoruz.
Backend kodu HAZIR ve test edildi (.pkpass'i openssl ile PKCS#7 imzalayıp zip'liyorum,
test sertifikasıyla geçerli pkpass ürettim). Eksik olan: Apple tarafındaki sertifikalar
ve 5 ortam değeri. Beni adım adım, ekran ekran, Türkçe yönlendir.

BAĞLAM:
- Apple Developer hesabım VAR (ücretli üyelik aktif).
- macOS kullanıyorum; openssl ve Keychain erişimim var.
- Pass Type Identifier olarak "pass.com.nordvow" kullanmak istiyorum (uygunsa).
- Site: https://nordvow.com

KODUN BEKLEDİĞİ ORTAM DEĞERLERİ (tam olarak bu 5 anahtar):
- APPLE_WALLET_CERT           → Pass Type ID sertifikası + ÖZEL ANAHTAR içeren .p12
                                dosyasının BASE64 metni
- APPLE_WALLET_CERT_PASSWORD  → .p12 dosyasının parolası
- APPLE_WALLET_WWDR           → Apple WWDR ara sertifikası (.pem veya .cer) BASE64
- APPLE_WALLET_TEAM_ID        → Apple Team ID (Membership sayfasında, 10 karakter)
- APPLE_WALLET_PASS_TYPE_ID   → pass.com.nordvow (yukarıda seçtiğim Pass Type Identifier)

SENDEN İSTEDİĞİM ADIMLAR:
1. developer.apple.com → Certificates, Identifiers & Profiles → Identifiers'tan
   "Pass Type IDs" altında yeni bir Pass Type ID (pass.com.nordvow) oluşturmayı anlat.
2. Bu Pass Type ID için bir sertifika üretimini anlat. CSR (Certificate Signing
   Request) üretmem gerekiyor. Bana macOS'ta openssl ile CSR üretme komutunu ver
   (Keychain Access ile uğraşmak istemiyorum). Örn:
     openssl req -new -newkey rsa:2048 -nodes -keyout nordvow.key -out nordvow.csr -subj "/..."
   Doğru -subj alanlarını ve sonraki adımları (CSR'yi portala yükle, .cer indir) ver.
3. İndirdiğim .cer (DER) sertifikasını, özel anahtarla (nordvow.key) birleştirip
   PAROLALI bir .p12 üretme openssl komutlarını ver. Örn .cer → .pem → .p12 zinciri.
   Sonra .p12'nin BASE64'ünü almayı göster (ör. `base64 -i nordvow.p12`).
4. Apple WWDR ara sertifikasını (Worldwide Developer Relations - G4) nereden
   indireceğimi (apple.com/certificateauthority) ve BASE64'ünü nasıl alacağımı anlat.
5. Team ID'yi developer.apple.com Membership sayfasından nasıl bulacağımı göster.
6. SONUÇ: 5 değeri bir arada, kopyalanabilir biçimde toplamamı hatırlat:
     APPLE_WALLET_CERT=<p12 base64>
     APPLE_WALLET_CERT_PASSWORD=<parola>
     APPLE_WALLET_WWDR=<wwdr base64>
     APPLE_WALLET_TEAM_ID=<team id>
     APPLE_WALLET_PASS_TYPE_ID=pass.com.nordvow

KURALLAR / UYARILAR:
- .pkpass imzası için sertifikanın Pass Type ID için üretilmiş olması ŞART; normal
  "Apple Development/Distribution" sertifikası ÇALIŞMAZ. Bunu vurgula.
- .p12 hem sertifikayı HEM özel anahtarı içermeli (yoksa imza olmaz).
- WWDR sürümü önemli: sertifikayı imzalayan zincire uygun WWDR (genelde G4) gerekir;
  yanlış WWDR'de iPhone pass'i açmaz. Hangi WWDR'yi indireceğimi netleştir.
- .p12 ve .key dosyalarını kimseyle paylaşmamam gerektiğini, yalnız benim altyapıma
  (Secrets Manager) gireceğini hatırlat.
- openssl eski .p12 formatı uyarısı verebilir; gerekirse -legacy / -keypbe / -certpbe
  bayraklarını açıkla (benim sunucum hem -legacy hem normal okuyacak şekilde yazıldı).
```
