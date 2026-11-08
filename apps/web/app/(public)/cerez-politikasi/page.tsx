import { getTT } from "@/lib/i18n/tt-server";
import type { Metadata } from "next";
import { CookiePreferencesButton } from "@/components/legal/cookie-banner";
import { LegalDoc } from "@/components/legal/legal-doc";
import { getLegalEntity } from "@/lib/legal";
export const metadata: Metadata = { title: "Çerez Politikası" };
export const dynamic = "force-dynamic";

const ROWS = [
  { name: "authjs.session-token", type: "Zorunlu", purpose: "Oturumunuzu açık tutar ve hesabınızı doğrular.", duration: "Oturum / 30 gün" },
  { name: "authjs.csrf-token", type: "Zorunlu", purpose: "Form gönderimlerini sahte isteklere karşı korur.", duration: "Oturum" },
  { name: "authjs.callback-url", type: "Zorunlu", purpose: "Girişten sonra doğru sayfaya dönmenizi sağlar.", duration: "Oturum" },
  { name: "infl-theme", type: "İşlevsel", purpose: "Açık/koyu tema tercihinizi hatırlar.", duration: "1 yıl" },
  { name: "infl-cookie-consent", type: "Zorunlu", purpose: "Çerez tercihinizi kaydeder.", duration: "1 yıl" },
  { name: "infl-copilot (oturum deposu)", type: "İşlevsel", purpose: "Asistan sohbet geçmişini sekme kapanana kadar tutar.", duration: "Sekme süresince" },
];

export default async function CookiePolicyPage() {
  const tt = await getTT();
  const e = await getLegalEntity();
  return (
    <LegalDoc
      current="/cerez-politikasi"
      entity={e}
      title={tt("Çerez Politikası")}
      intro={
        <p>{tt("Bu politika,")}{" "}{e.shortName}{" "}{tt("web sitesinde ve panelinde kullanılan çerezleri ve benzeri teknolojileri (yerel depolama) açıklar. Reklam veya üçüncü taraf takip çerezi kullanmıyoruz.")}</p>
      }
      sections={[
        {
          id: "nedir",
          title: "Çerez nedir?",
          body: <p>{tt("Çerezler, ziyaret ettiğiniz site tarafından tarayıcınıza kaydedilen küçük metin dosyalarıdır. Oturum açma, güvenlik ve tercihlerin hatırlanması için kullanılır.")}</p>,
        },
        {
          id: "liste",
          title: "Kullandığımız çerezler",
          body: (
            <div className="overflow-x-auto rounded-2xl border border-line">
              <table className="w-full text-[14px]">
                <caption className="sr-only">{tt("Çerez listesi")}</caption>
                <thead className="bg-surface text-left text-fg">
                  <tr>
                    <th scope="col" className="px-4 py-2 font-medium">{tt("Ad")}</th>
                    <th scope="col" className="px-4 py-2 font-medium">{tt("Tür")}</th>
                    <th scope="col" className="px-4 py-2 font-medium">{tt("Amaç")}</th>
                    <th scope="col" className="px-4 py-2 font-medium">{tt("Süre")}</th>
                  </tr>
                </thead>
                <tbody>
                  {ROWS.map((r) => (
                    <tr key={r.name} className="border-t border-line align-top">
                      <td className="px-4 py-2 font-mono text-[12px] text-fg">{r.name}</td>
                      <td className="px-4 py-2">{r.type}</td>
                      <td className="px-4 py-2">{r.purpose}</td>
                      <td className="px-4 py-2 whitespace-nowrap">{r.duration}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ),
        },
        {
          id: "hukuki",
          title: "Hukuki sebep",
          body: (
            <p>{tt("Zorunlu çerezler, hizmetin sunulması ve güvenliği için gereklidir ve KVKK md. 5/2-c ile 5/2-f kapsamında rıza aranmadan kullanılır. İşlevsel çerezler yalnız tercihlerinizi hatırlar. İleride analitik veya pazarlama çerezi eklenirse yalnız açık rızanızla etkinleşir.")}</p>
          ),
        },
        {
          id: "yonetim",
          title: "Çerezleri nasıl yönetirsiniz?",
          body: (
            <>
              <p>{tt("Tercihinizi aşağıdaki düğmeyle istediğiniz zaman değiştirebilirsiniz. Tarayıcı ayarlarınızdan çerezleri silebilir veya engelleyebilirsiniz; zorunlu çerezler engellenirse giriş yapılamaz.")}</p>
              <CookiePreferencesButton />
            </>
          ),
        },
      ]}
    />
  );
}
