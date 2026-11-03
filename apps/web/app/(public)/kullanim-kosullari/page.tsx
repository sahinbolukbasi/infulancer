import type { Metadata } from "next";

export const metadata: Metadata = { title: "Kullanım koşulları" };

/** Kullanım koşulları (taslak; hukuk incelemesi gerekir). */
export default function TermsPage() {
  return (
    <article className="flex flex-col gap-5 leading-relaxed">
      <h1 className="text-[32px] font-semibold tracking-tight">Kullanım koşulları</h1>
      <p className="text-fg-muted">Son güncelleme: Kasım 2026. Taslak metindir; yayına alınmadan önce hukuk danışmanı tarafından incelenmelidir.</p>
      <h2 className="text-lg font-semibold">Yasaklı ve kısıtlı faaliyetler</h2>
      <p>
        Siyasi parti ve politikacılar WhatsApp Business Platform’u bu hizmet üzerinden kullanamaz. Silah, alkol ve tütün, uyuşturucu, medikal ürünler, gerçek parayla kumar,
        yetişkin ürünleri, flört hizmetleri, çok katlı pazarlama ve payday/borç tahsilat kredisi kısıtlıdır; düzenlenmiş dikeylerde 18 yaş altına mesaj gönderilemez. Beyan edilmemiş
        yasaklı faaliyet tespit edilirse hesap askıya alınabilir.
      </p>
      <h2 className="text-lg font-semibold">Ticari ileti ve İYS</h2>
      <p>
        Ticari elektronik iletiler yalnız İYS’de onayı bulunan alıcılara gönderilir. Ret (RET) kayıtları kalıcıdır ve panelden veya içe aktarma ile kaldırılamaz. Herhangi bir
        promosyon unsuru içeren mesaj bütünüyle ticari ileti sayılır.
      </p>
      <h2 className="text-lg font-semibold">Reklam açıklaması</h2>
      <p>
        Influencer içeriklerinde “Reklam” veya “Tanıtım” ifadesi ve reklam verenin adı ilk unsur olarak yer almalıdır. Bu şartı karşılamayan içerikle kampanya yayına alınamaz.
        Reklam veren ve influencer ayrı ayrı sorumludur.
      </p>
      <h2 className="text-lg font-semibold">Yapay zekâ ile üretilen içerik</h2>
      <p>
        Gerçek bir kişinin yapay zekâ ile üretilmiş kopyası, o kişi ürünü kullanıyor veya öneriyormuş izlenimi verecek şekilde üretilemez (Ticari Reklam Yönetmeliği md. 27/12). Üretilen
        tüm varlıklar C2PA içerik kimlik bilgisi taşır; bu bilgileri silen bir özellik sunulmaz.
      </p>
      <h2 className="text-lg font-semibold">Ödemeler</h2>
      <p>Platform ödeme talimatı üretir; transferi banka yapar. 20/B istisna belgeli içerik üreticilerine yalnız belirlenmiş IBAN’a ödeme yapılır.</p>
    </article>
  );
}
