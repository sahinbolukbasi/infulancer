import type { Metadata } from "next";
import { LegalDoc } from "@/components/legal/legal-doc";
import { getLegalEntity } from "@/lib/legal";
export const metadata: Metadata = { title: "KVKK Aydınlatma Metni" };
export const dynamic = "force-dynamic";

/** 6698 sayılı KVKK md. 10 ve Aydınlatma Yükümlülüğü Tebliği kapsamında aydınlatma metni. */
export default async function KvkkPage() {
  const e = await getLegalEntity();
  return (
    <LegalDoc
      current="/kvkk"
      entity={e}
      title="KVKK Aydınlatma Metni"
      intro={
        <p>
          Bu metin, 6698 sayılı Kişisel Verilerin Korunması Kanunu (&quot;KVKK&quot;) md. 10 ve Aydınlatma Yükümlülüğünün Yerine Getirilmesinde Uyulacak Usul ve Esaslar Hakkında
          Tebliğ uyarınca, {e.shortName} platformunu kullanan ajans çalışanları, marka yetkilileri, içerik üreticileri ve ziyaretçiler için hazırlanmıştır.
        </p>
      }
      sections={[
        {
          id: "sorumlu",
          title: "Veri sorumlusu",
          body: (
            <p>
              Kişisel verileriniz, veri sorumlusu sıfatıyla <strong>{e.title}</strong> ({e.address}) tarafından işlenir. Markaların platform üzerinden yürüttüğü mesajlaşma ve
              kampanya faaliyetlerinde, kendi müşterilerine ait veriler bakımından ilgili marka veri sorumlusu; {e.shortName} ise veri işleyendir.
            </p>
          ),
        },
        {
          id: "veriler",
          title: "İşlenen kişisel veri kategorileri",
          body: (
            <ul>
              <li><strong>Kimlik:</strong> ad, soyad, T.C. kimlik / vergi numarası (ödeme ve fatura için).</li>
              <li><strong>İletişim:</strong> e-posta, telefon, adres.</li>
              <li><strong>Müşteri işlem:</strong> kampanya, teklif, teslim, onay ve yazışma kayıtları.</li>
              <li><strong>Finans:</strong> IBAN, hesap sahibi, hakediş, ödeme ve vergi profili bilgileri.</li>
              <li><strong>Sosyal medya:</strong> kullanıcı adı, herkese açık profil fotoğrafı, takipçi, gönderi ve etkileşim istatistikleri.</li>
              <li><strong>Görsel/işitsel:</strong> içerik taslakları, yayın görselleri, istatistik ekran görüntüleri.</li>
              <li><strong>İşlem güvenliği:</strong> oturum, IP adresi, cihaz ve tarayıcı bilgisi, denetim kayıtları.</li>
              <li><strong>Pazarlama:</strong> ticari elektronik ileti onay/ret kayıtları (İYS).</li>
            </ul>
          ),
        },
        {
          id: "amac",
          title: "İşleme amaçları",
          body: (
            <ul>
              <li>Üyelik, kimlik doğrulama ve hesap güvenliğinin sağlanması,</li>
              <li>Influencer kampanyalarının planlanması, teklif, sözleşme, teslim ve onay süreçlerinin yürütülmesi,</li>
              <li>Hakediş, ödeme, vergi kesintisi ve muhasebe işlemlerinin yapılması,</li>
              <li>Kampanya performansının ölçülmesi ve raporlanması,</li>
              <li>Reklam açıklaması (6502 sayılı Kanun ve Ticari Reklam Yönetmeliği md. 23/A) ve diğer mevzuata uyumun denetlenmesi,</li>
              <li>Destek taleplerinin yanıtlanması, bilgi güvenliği ve denetim kaydı tutulması,</li>
              <li>Yetkili kurum ve kuruluşların bilgi taleplerinin karşılanması.</li>
            </ul>
          ),
        },
        {
          id: "hukuki-sebep",
          title: "Hukuki sebepler",
          body: (
            <>
              <p>Kişisel verileriniz KVKK md. 5/2 kapsamında aşağıdaki hukuki sebeplere dayanılarak işlenir:</p>
              <ul>
                <li>Bir sözleşmenin kurulması veya ifasıyla doğrudan ilgili olması (md. 5/2-c),</li>
                <li>Veri sorumlusunun hukuki yükümlülüğünü yerine getirmesi (md. 5/2-ç) — vergi, ticari defter, reklam mevzuatı,</li>
                <li>Bir hakkın tesisi, kullanılması veya korunması (md. 5/2-e),</li>
                <li>İlgili kişinin temel hak ve özgürlüklerine zarar vermemek kaydıyla meşru menfaat (md. 5/2-f) — güvenlik, dolandırıcılık önleme, hizmet iyileştirme,</li>
                <li>İlgili kişinin kendisi tarafından alenileştirilmiş olması (md. 5/2-d) — herkese açık sosyal medya istatistikleri.</li>
              </ul>
              <p>Ticari elektronik ileti gönderimi ve mesaj içeriklerinin yapay zekâ ile işlenmesi, ayrı ayrı alınan onay/açık rızaya dayanır.</p>
            </>
          ),
        },
        {
          id: "aktarim",
          title: "Kişisel verilerin aktarılması",
          body: (
            <>
              <p>Kişisel verileriniz yukarıdaki amaçlarla sınırlı olarak;</p>
              <ul>
                <li>Kampanyada birlikte çalıştığınız marka, ajans veya içerik üreticisine (iş birliğinin gerektirdiği ölçüde),</li>
                <li>Ödeme kuruluşları, bankalar, mali müşavir ve denetçilere,</li>
                <li>Yetkili kamu kurum ve kuruluşlarına (yasal zorunluluk hâlinde),</li>
                <li>Hizmet aldığımız altyapı sağlayıcılarına aktarılabilir.</li>
              </ul>
              <p>
                <strong>Yurt dışına aktarım (KVKK md. 9):</strong> Platform verileri Amazon Web Services (Frankfurt, Almanya) altyapısında barındırılır; WhatsApp ve Instagram
                mesajları Meta Platforms tarafından iletilir. Bu aktarımlar, Kurul&apos;ca ilan edilen standart sözleşmeler imzalanarak ve imzadan itibaren 5 iş günü içinde Kurum&apos;a
                bildirilerek gerçekleştirilir.
              </p>
            </>
          ),
        },
        {
          id: "yontem",
          title: "Toplama yöntemi",
          body: (
            <p>
              Verileriniz; platformdaki formlar, davetli kayıt, dosya yükleme, mesaj kanalları, çerezler ve sizin onayınızla bağlanan sosyal medya hesaplarının resmî API&apos;leri
              (Instagram Graph API, YouTube Data API, TikTok Login Kit) aracılığıyla otomatik veya kısmen otomatik yollarla toplanır. Kazıma (scraping) yapılmaz.
            </p>
          ),
        },
        {
          id: "saklama",
          title: "Saklama süreleri",
          body: (
            <ul>
              <li>Hesap ve iş birliği kayıtları: üyelik süresince ve sona ermesinden itibaren 10 yıl (Türk Ticaret Kanunu, Vergi Usul Kanunu).</li>
              <li>Mesaj içerikleri: markanın belirlediği saklama süresi (varsayılan 90 gün); gönderen tarafından geri alınan mesajlar derhâl silinir.</li>
              <li>Denetim kayıtları: değiştirilemez şekilde 2 yıl.</li>
              <li>Süresi dolan veriler silinir, yok edilir veya anonim hâle getirilir.</li>
            </ul>
          ),
        },
        {
          id: "haklar",
          title: "KVKK md. 11 kapsamındaki haklarınız",
          body: (
            <ul>
              <li>Kişisel verilerinizin işlenip işlenmediğini öğrenme ve işlenmişse bilgi talep etme,</li>
              <li>İşlenme amacını ve amacına uygun kullanılıp kullanılmadığını öğrenme,</li>
              <li>Yurt içinde veya yurt dışında aktarıldığı üçüncü kişileri bilme,</li>
              <li>Eksik veya yanlış işlenmişse düzeltilmesini, KVKK md. 7 şartları oluştuğunda silinmesini veya yok edilmesini isteme ve bunların aktarılan kişilere bildirilmesini talep etme,</li>
              <li>Münhasıran otomatik sistemlerle analiz edilmesi sonucu aleyhinize bir sonuç çıkmasına itiraz etme,</li>
              <li>Kanuna aykırı işleme nedeniyle zarara uğramanız hâlinde zararın giderilmesini talep etme.</li>
            </ul>
          ),
        },
        {
          id: "basvuru",
          title: "Başvuru yöntemi",
          body: (
            <p>
              Haklarınıza ilişkin taleplerinizi, Veri Sorumlusuna Başvuru Usul ve Esasları Hakkında Tebliğ uyarınca kimliğinizi doğrulayan bilgilerle birlikte{" "}
              <strong>{e.kvkkEmail}</strong> adresine kayıtlı e-postanızdan{e.kep ? <>, <strong>{e.kep}</strong> KEP adresine</> : null} veya yazılı olarak {e.address} adresine
              iletebilirsiniz. Başvurular en geç 30 gün içinde ücretsiz sonuçlandırılır; işlemin ayrıca bir maliyet gerektirmesi hâlinde Kurul&apos;ca belirlenen tarife uygulanabilir.
            </p>
          ),
        },
      ]}
    />
  );
}
