import type { Metadata } from "next";
import Link from "next/link";
import { LegalDoc } from "@/components/legal/legal-doc";
import { getLegalEntity } from "@/lib/legal";
export const metadata: Metadata = { title: "Gizlilik Politikası" };
export const dynamic = "force-dynamic";

/** Gizlilik politikası (Meta, TikTok ve Google platform politikaları gereği herkese açık). */
export default async function PrivacyPage() {
  const e = await getLegalEntity();
  return (
    <LegalDoc
      current="/gizlilik"
      entity={e}
      title="Gizlilik Politikası"
      intro={
        <p>
          {e.shortName}, influencer marketing kampanyalarını yöneten ajanslar, markalar ve içerik üreticileri için bir yazılım platformudur. Bu politika hangi verileri neden
          topladığımızı, nasıl koruduğumuzu ve haklarınızı açıklar. KVKK kapsamındaki ayrıntılı bilgi için{" "}
          <Link href="/kvkk" className="underline underline-offset-4">
            KVKK Aydınlatma Metni
          </Link>
          &apos;ni inceleyin.
        </p>
      }
      sections={[
        {
          id: "roller",
          title: "Roller ve kapsam",
          body: (
            <p>
              Platform hesapları, faturalama ve güvenlik kayıtları bakımından {e.shortName} <strong>veri sorumlusudur</strong>. Markaların WhatsApp/Instagram üzerinden kendi
              müşterileriyle yürüttüğü yazışmalarda ve kampanya alıcı listelerinde marka veri sorumlusu, {e.shortName} <strong>veri işleyendir</strong> ve verileri yalnız markanın
              talimatıyla işler.
            </p>
          ),
        },
        {
          id: "toplanan",
          title: "Topladığımız bilgiler",
          body: (
            <ul>
              <li>Hesap bilgileri: ad, e-posta, telefon, şirket/marka bilgileri, rol.</li>
              <li>İçerik üreticisi profili: kategoriler, şehir, fiyat listesi, IBAN ve vergi profili.</li>
              <li>Bağlanan sosyal hesaplar: kullanıcı adı, profil fotoğrafı, takipçi, gönderi ve etkileşim sayıları (resmî API&apos;lerden, sizin izninizle).</li>
              <li>Kampanya verileri: teklifler, brief&apos;ler, içerik taslakları, yayın bağlantıları, metrikler.</li>
              <li>Mesajlaşma: markanın bağladığı WhatsApp/Instagram kanallarındaki yazışmalar.</li>
              <li>Teknik veriler: IP, tarayıcı, oturum ve güvenlik kayıtları.</li>
            </ul>
          ),
        },
        {
          id: "platform-verisi",
          title: "Meta, Instagram, TikTok ve YouTube verileri",
          body: (
            <>
              <p>
                Platform API&apos;lerinden alınan veriler yalnız kampanya eşleştirme, performans ölçümü ve raporlama amacıyla kullanılır; satılmaz, reklam profili oluşturmak için
                kullanılmaz ve üçüncü taraf veri aracılarıyla paylaşılmaz.
              </p>
              <p>
                YouTube verileri için <a href="https://www.youtube.com/t/terms" className="underline underline-offset-4" target="_blank" rel="noopener noreferrer">YouTube Hizmet Şartları</a> ve{" "}
                <a href="https://policies.google.com/privacy" className="underline underline-offset-4" target="_blank" rel="noopener noreferrer">Google Gizlilik Politikası</a> geçerlidir.
                Bağlantıyı istediğiniz zaman ilgili platformun güvenlik ayarlarından kaldırabilirsiniz; kaldırıldığında yeni veri çekilmez.
              </p>
            </>
          ),
        },
        {
          id: "kullanim",
          title: "Bilgileri nasıl kullanırız",
          body: (
            <ul>
              <li>Hesabınızı oluşturmak, doğrulamak ve korumak,</li>
              <li>Markaların içerik üreticilerine teklif göndermesini ve iş birliklerinin yürütülmesini sağlamak,</li>
              <li>Ödemeleri, vergi kesintilerini ve faturalamayı yapmak,</li>
              <li>Reklam açıklaması ve ticari ileti mevzuatına uyumu denetlemek,</li>
              <li>Hizmeti geliştirmek ve kötüye kullanımı önlemek.</li>
            </ul>
          ),
        },
        {
          id: "yapay-zeka",
          title: "Yapay zekâ kullanımı",
          body: (
            <p>
              Asistan, brief kontrolü ve içerik üretimi özelliklerinde yapay zekâ modelleri (AWS Bedrock, fal.ai) kullanılır. Müşteri mesajlarının yapay zekâ ile işlenmesi, pazarlama
              onayından ayrı bir açık rızaya bağlıdır. Yapay zekâ ile üretilen görsel ve videolara &quot;AI ile üretildi&quot; bilgisi (C2PA) gömülür; gerçek bir kişinin yüzü veya
              sesiyle üretim yapılmaz.
            </p>
          ),
        },
        {
          id: "paylasim",
          title: "Paylaşım ve yurt dışı aktarım",
          body: (
            <p>
              Verileri yalnız hizmetin gerektirdiği taraflarla (iş birliği yaptığınız marka/ajans/içerik üreticisi, ödeme kuruluşları, altyapı sağlayıcıları ve yasal zorunlulukta
              yetkili makamlar) paylaşırız. Barındırma AWS Frankfurt bölgesindedir; mesajlar Meta tarafından iletilir. Yurt dışı aktarımlar KVKK md. 9 uyarınca standart sözleşme ile
              yapılır.
            </p>
          ),
        },
        {
          id: "guvenlik",
          title: "Güvenlik",
          body: (
            <ul>
              <li>Tüm trafik TLS ile şifrelenir; veritabanı ve dosyalar şifreli depolanır.</li>
              <li>API anahtarları ve erişim token&apos;ları AWS Secrets Manager&apos;da tutulur, kodda veya veritabanında açık saklanmaz.</li>
              <li>Rol tabanlı erişim: markalar ve içerik üreticileri yalnız kendi kayıtlarını görür.</li>
              <li>Tüm kritik işlemler değiştirilemez denetim kaydına yazılır.</li>
            </ul>
          ),
        },
        {
          id: "saklama",
          title: "Saklama ve silme",
          body: (
            <p>
              Hesap ve finans kayıtları yasal saklama süreleri boyunca, mesaj içerikleri markanın belirlediği süre (varsayılan 90 gün) boyunca saklanır. Hesabınızın silinmesini{" "}
              <strong>{e.kvkkEmail}</strong> adresinden talep edebilirsiniz; yasal saklama yükümlülüğü olmayan veriler 30 gün içinde silinir.
            </p>
          ),
        },
        {
          id: "cocuklar",
          title: "Çocukların gizliliği",
          body: <p>Platform 18 yaşından küçüklere yönelik değildir. 18 yaş altı içerik üreticileri yalnız veli/vasi onayıyla ve ajans aracılığıyla çalışabilir.</p>,
        },
        {
          id: "degisiklik",
          title: "Değişiklikler ve iletişim",
          body: (
            <p>
              Bu politikadaki önemli değişiklikleri yürürlükten önce platform içi bildirimle duyururuz. Sorularınız için <strong>{e.email}</strong> adresine yazabilirsiniz.
            </p>
          ),
        },
      ]}
    />
  );
}
