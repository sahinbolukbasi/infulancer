import { getTT } from "@/lib/i18n/tt-server";
import type { Metadata } from "next";
import Link from "next/link";
import { LegalDoc } from "@/components/legal/legal-doc";
import { getLegalEntity } from "@/lib/legal";
export const metadata: Metadata = { title: "Kullanım Koşulları" };
export const dynamic = "force-dynamic";

export default async function TermsPage() {
  const tt = await getTT();
  const e = await getLegalEntity();
  return (
    <LegalDoc
      current="/kullanim-kosullari"
      entity={e}
      title={tt("Kullanım Koşulları")}
      intro={
        <p>{tt("Bu koşullar,")}{" "}{e.title}{" "}{tt("(\"")}{e.shortName}{tt("\") tarafından sunulan platformun ajanslar, markalar ve içerik üreticileri tarafından kullanımını düzenler. Platformu kullanarak bu koşulları kabul etmiş olursunuz.")}</p>
      }
      sections={[
        {
          id: "tanimlar",
          title: "Tanımlar",
          body: (
            <ul>
              <li><strong>{tt("Ajans:")}</strong>{" "}{tt("platformu kampanya operasyonu için kullanan ajans ve çalışanları.")}</li>
              <li><strong>{tt("Marka:")}</strong>{" "}{tt("içerik üreticileriyle iş birliği yapan işletme ve yetkilileri.")}</li>
              <li><strong>{tt("İçerik üreticisi:")}</strong>{" "}{tt("teklif alan ve içerik üreten influencer.")}</li>
              <li><strong>{tt("Teklif:")}</strong>{" "}{tt("markanın bir içerik üreticisine platform üzerinden ilettiği iş birliği önerisi.")}</li>
            </ul>
          ),
        },
        {
          id: "uyelik",
          title: "Üyelik",
          body: (
            <ul>
              <li>{tt("Üyelik davetle açılır ve ajans onayıyla etkinleşir. 18 yaşını doldurmuş olmanız gerekir.")}</li>
              <li>{tt("Verdiğiniz bilgilerin doğru ve güncel olmasından siz sorumlusunuz.")}</li>
              <li>{tt("Hesap bilgilerinizi kimseyle paylaşmayın; yetkisiz kullanımı derhâl bildirin.")}</li>
              <li>{e.shortName}{tt(", bu koşullara aykırılık hâlinde hesabı askıya alabilir veya kapatabilir.")}</li>
            </ul>
          ),
        },
        {
          id: "teklifler",
          title: "Teklifler ve iş birlikleri",
          body: (
            <ul>
              <li>{tt("İçerik üreticileri fiyat listelerini kendileri belirler; markalar bu fiyatlar üzerinden veya farklı bir bedelle teklif gönderebilir.")}</li>
              <li>{tt("Teklif, içerik üreticisi kabul ettiğinde bağlayıcı hâle gelir; kapsam (platform, içerik türü, tarih, kullanım hakkı) teklifte yazılı olandır.")}</li>
              <li>{tt("Taraflar, kabul edilen iş birliğini platform dışına taşıyarak komisyon veya ücret yükümlülüğünden kaçınamaz.")}</li>
              <li>{tt("İçerik üreticisi, brief'e uygun içerik üretmek ve onaylanan tarihte yayınlamakla; marka, onay sürelerine uymakla yükümlüdür.")}</li>
            </ul>
          ),
        },
        {
          id: "reklam",
          title: "Reklam açıklaması ve içerik kuralları",
          body: (
            <ul>
              <li>{tt("Tüm ücretli veya ürün karşılığı paylaşımlarda, Ticari Reklam ve Haksız Ticari Uygulamalar Yönetmeliği md. 23/A uyarınca \"#reklam\", \"#işbirliği\" gibi açık bir ibare ve platformun ücretli ortaklık etiketi kullanılmalıdır.")}</li>
              <li>{tt("Hukuka, genel ahlaka, fikri mülkiyet haklarına aykırı veya yanıltıcı içerik üretilemez.")}</li>
              <li>{tt("Platform, açıklaması eksik içerikle kampanyanın yayına alınmasını engelleyebilir.")}</li>
            </ul>
          ),
        },
        {
          id: "odeme",
          title: "Ödemeler",
          body: (
            <ul>
              <li>{tt("İçerik üreticisinin hakedişi, içeriğin yayınlanıp onaylanmasıyla oluşur ve bekleme süresi sonunda çekilebilir hâle gelir.")}</li>
              <li>{tt("Ödemeler, vergi profiline göre gerekli kesintiler yapılarak IBAN'a gönderilir. Yanlış IBAN bilgisinden doğan gecikmelerden içerik üreticisi sorumludur.")}</li>
              <li>{tt("Sözleşme ihlali (içeriğin süresinden önce silinmesi gibi) hâlinde hakediş kısmen veya tamamen düşebilir.")}</li>
            </ul>
          ),
        },
        {
          id: "mesajlasma",
          title: "Mesaj kanalları",
          body: (
            <p>{tt("WhatsApp ve Instagram kanallarını bağlayan marka; Meta'nın ticari şartlarına, 6563 sayılı Kanun ve İYS kurallarına uymaktan, alıcılardan gerekli onayları almaktan ve mesaj ücretlerinden sorumludur. Onaysız alıcıya ticari ileti gönderimi sistem tarafından engellenir.")}</p>
          ),
        },
        {
          id: "fikri",
          title: "Fikri mülkiyet",
          body: (
            <p>{tt("Platform yazılımı ve tasarımı")}{" "}{e.shortName}{tt("'a aittir. İçeriklerin kullanım hakkı, teklifte belirtilen süre ve kanallarla sınırlıdır; aksi yazılı olarak kararlaştırılmadıkça içeriğin telif hakkı içerik üreticisinde kalır.")}</p>
          ),
        },
        {
          id: "sorumluluk",
          title: "Sorumluluğun sınırlandırılması",
          body: (
            <p>
              {e.shortName}{tt(", taraflar arasındaki iş birliğine aracılık eden bir yazılım sağlayıcıdır; içeriklerin hukuka uygunluğundan içerik üreticisi ve marka sorumludur. Üçüncü taraf platformların (Meta, TikTok, Google) hizmet kesintilerinden ve API değişikliklerinden doğan aksaklıklardan sorumlu tutulamaz. Kanunen sınırlandırılamayan sorumluluklar saklıdır.")}</p>
          ),
        },
        {
          id: "veri",
          title: "Kişisel veriler",
          body: (
            <p>{tt("Kişisel verileriniz")}{" "}
              <Link href="/kvkk" className="underline underline-offset-4">{tt("KVKK Aydınlatma Metni")}</Link>,{" "}
              <Link href="/gizlilik" className="underline underline-offset-4">{tt("Gizlilik Politikası")}</Link>{" "}{tt("ve")}{" "}
              <Link href="/cerez-politikasi" className="underline underline-offset-4">{tt("Çerez Politikası")}</Link>{" "}{tt("uyarınca işlenir.")}</p>
          ),
        },
        {
          id: "uyusmazlik",
          title: "Değişiklik, uygulanacak hukuk ve uyuşmazlık",
          body: (
            <p>{tt("Koşullardaki değişiklikler platformda yayımlandığı tarihte yürürlüğe girer; önemli değişiklikler önceden bildirilir. Bu koşullara Türk hukuku uygulanır. Uyuşmazlıklarda İstanbul (Merkez) mahkemeleri ve icra daireleri yetkilidir; tüketici sıfatını taşıyan kullanıcılar için tüketici hakem heyetleri ve tüketici mahkemelerine ilişkin haklar saklıdır.")}</p>
          ),
        },
      ]}
    />
  );
}
