import type { Metadata } from "next";

export const metadata: Metadata = { title: "Gizlilik politikası" };

/** Yayımlanmış gizlilik politikası (Meta ve TikTok platform politikaları gereği zorunlu). Hukuk incelemesinden geçirilmelidir. */
export default function PrivacyPage() {
  return (
    <article className="prose-sm flex max-w-none flex-col gap-5 leading-relaxed">
      <h1 className="text-[32px] font-semibold tracking-tight">Gizlilik politikası</h1>
      <p className="text-fg-muted">Son güncelleme: Kasım 2026. Bu metin taslaktır ve yayına alınmadan önce hukuk danışmanı tarafından incelenmelidir.</p>
      <h2 className="text-lg font-semibold">Roller</h2>
      <p>
        Kampanya, alıcı ve mesaj verileri bakımından müşterimiz olan marka (tenant) <strong>veri sorumlusu</strong>, Infulancer <strong>veri işleyendir</strong>. Platformun kendi
        kullanıcı hesapları, faturalama ve ürün telemetrisi bakımından Infulancer veri sorumlusudur.
      </p>
      <h2 className="text-lg font-semibold">Yurt dışına aktarım</h2>
      <p>
        Veriler iki ayrı yurt dışı aktarıma konu olur: (1) barındırma için Amazon Web Services eu-central-1 (Frankfurt), (2) WhatsApp, Instagram ve Messenger mesajlarının
        iletilmesi için Meta Platforms (alt-işleyen). Meta, mesaj içeriğini uluslararası veri merkezlerinde işleyebilir. Aktarımlar KVKK kapsamında standart sözleşme ile yapılır ve
        Kurul’a bildirilir; açık rızaya dayanılmaz.
      </p>
      <h2 className="text-lg font-semibold">İki ayrı onay</h2>
      <p>
        Pazarlama mesajı almaya onay (6563 sayılı Kanun / İYS) ile mesaj içeriğinin yapay zekâ ile işlenmesine açık rıza birbirinden ayrı alınır ve birbirine bağlanmaz.
      </p>
      <h2 className="text-lg font-semibold">Saklama ve silme</h2>
      <p>
        Mesaj içerikleri markanın belirlediği kısa saklama süresi sonunda silinir. Bir mesaj gönderen tarafından geri alındığında (unsend) mesaj, medyası, arama dizinindeki kaydı ve
        istatistik katkısı kalıcı olarak silinir. Yedeklerdeki kopyalar yedek saklama süresi (7 gün) sonunda düşer.
      </p>
      <h2 className="text-lg font-semibold">Yapay zekâ</h2>
      <p>
        Bir markanın mesajları başka bir markayla paylaşılmaz, başka markalar için kullanılmaz ve platformun kendi modellerini eğitmek için kullanılmaz. Yapay zekâ yanıtları markanın
        kendi bilgi tabanıyla sınırlıdır; kullanıcı istediğinde konuşma bir insan temsilciye aktarılır. Asistan kart veya hesap numarası istemez.
      </p>
      <h2 className="text-lg font-semibold">Haklarınız</h2>
      <p>KVKK md. 11 kapsamındaki talepleriniz için ilgili markaya veya kvkk@infulancer.example adresine başvurabilirsiniz.</p>
    </article>
  );
}
