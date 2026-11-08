import { getTT } from "@/lib/i18n/tt-server";
import type { Metadata } from "next";
import { prisma } from "@infulancer/core/db";
import { getConfig } from "@infulancer/core/config/store";
import { envStr } from "@infulancer/core/env";
import { integrationStatuses, modeLabel } from "@infulancer/core/integrations/status";
import { FeatureToggle, ModelControls } from "@/components/ai/ai-model-controls";
import { StatusCards } from "@/components/ui/status-cards";
import { Card, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/layout";
import { StatusDot } from "@/components/ui/status";
import { requireAdmin } from "@/lib/auth-guard";
export const metadata: Metadata = { title: "AI sağlayıcıları" };
export const dynamic = "force-dynamic";
const usd = new Intl.NumberFormat("tr-TR", { style: "currency", currency: "USD", maximumFractionDigits: 4 });
const kindTr: Record<string, string> = { image: "Görsel", video: "Video", audio: "Ses", edit: "Düzenleme", tryon: "Giydirme", training: "Eğitim" };
const licenseTr: Record<string, string> = { cleared: "Onaylı", pending: "Beklemede", restricted: "Kısıtlı" };
/** AI sağlayıcıları ve model yönetimi: Bedrock (asistan + görsel/video) ve fal.ai durumu, modeller, özellik bayrakları. */
export default async function AdminAiPage() {
  const tt = await getTT();
  await requireAdmin();
  const [models, features, integrations] = await Promise.all([
    prisma.modelRegistry.findMany({ orderBy: [{ provider: "asc" }, { kind: "asc" }, { key: "asc" }] }),
    getConfig("features"),
    integrationStatuses(),
  ]);
  const llm = envStr("LLM_PROVIDER", "mock");
  const falMode = envStr("FAL_MODE", "mock");
  const flagList = Object.entries(features).filter(([k]) => k.startsWith("creative."));
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={tt("AI sağlayıcıları")} description={tt("Asistan ve Creative için Bedrock ve fal.ai modellerini buradan yönetin.")} />
      <StatusCards
        items={[
          { title: "Asistan (metin)", state: llm === "bedrock" ? "ok" : "warn", value: llm === "bedrock" ? "Bedrock · canlı" : "Mock", text: llm === "bedrock" ? "Yanıtlar Amazon Bedrock modelinden üretiliyor." : "Kural tabanlı çalışıyor; gerçek LLM için LLM_PROVIDER=bedrock.", href: "#saglayici", action: "Nasıl açılır" },
          { title: "Creative · fal.ai", state: falMode === "http" ? "ok" : "warn", value: falMode === "http" ? "Canlı" : "Mock", text: falMode === "http" ? "Görsel/video gerçek üretiliyor." : "Çıktı simüle ediliyor; FAL_KEY gerekiyor.", href: "#saglayici", action: "Nasıl açılır" },
          { title: "Creative · Bedrock görsel", state: features["creative.bedrockImage"] ? "ok" : "warn", value: features["creative.bedrockImage"] ? "Açık" : "Erişim bekliyor", text: "Nova Canvas / Titan. Bölge erişimi açılınca kullanılabilir.", href: "#bayraklar", action: "Bayrağı aç" },
          { title: "Creative · Bedrock video", state: features["creative.bedrockVideo"] ? "ok" : "warn", value: features["creative.bedrockVideo"] ? "Açık" : "Erişim bekliyor", text: "Nova Reel. Bölge erişimi açılınca kullanılabilir.", href: "#bayraklar", action: "Bayrağı aç" },
        ]}
      />
      <Card interactive={false} id="bayraklar" className="flex scroll-mt-24 flex-col gap-4">
        <CardTitle>{tt("Özellik bayrakları")}</CardTitle>
        <p className="text-[13px] text-fg-muted">{tt("Deneysel veya bölge/erişim bekleyen model gruplarını açıp kapatın. Kapalıyken bu modeller Creative'de listelenmez.")}</p>
        <ul className="flex flex-col divide-y divide-line">
          {flagList.map(([flag, on]) => (
            <li key={flag} className="flex items-center justify-between gap-3 py-3">
              <span className="font-mono text-[13px]">{flag}</span>
              <FeatureToggle flag={flag} on={on} />
            </li>
          ))}
        </ul>
      </Card>
      <Card interactive={false} className="flex flex-col gap-4">
        <CardTitle>{tt("Model kaydı (")}{models.length})</CardTitle>
        <p className="text-[13px] text-fg-muted">{tt("Lisansı onaylı modeller müşteri işinde kullanılabilir. Bir modeli engellemek için lisansı \"Kısıtlı\" yapın.")}</p>
        <div className="overflow-x-auto rounded-2xl border border-line">
          <table className="w-full text-[13px]">
            <caption className="sr-only">{tt("AI modelleri")}</caption>
            <thead className="bg-surface text-left text-fg-muted">
              <tr>
                <th scope="col" className="px-3 py-2 font-medium">{tt("Model")}</th>
                <th scope="col" className="px-3 py-2 font-medium">{tt("Sağlayıcı")}</th>
                <th scope="col" className="px-3 py-2 font-medium">{tt("Tür")}</th>
                <th scope="col" className="px-3 py-2 font-medium">{tt("Birim fiyat")}</th>
                <th scope="col" className="px-3 py-2 font-medium">{tt("Durum")}</th>
                <th scope="col" className="px-3 py-2 font-medium">{tt("Yönet")}</th>
              </tr>
            </thead>
            <tbody>
              {models.map((m) => (
                <tr key={m.key} className="border-t border-line align-top">
                  <td className="px-3 py-2">
                    <span className="font-medium">{m.key}</span>
                    <span className="block font-mono text-[11px] text-fg-passive">{m.modelId}</span>
                    {m.featureFlag ? <span className="text-[11px] text-fg-passive">{tt("bayrak:")}{" "}{m.featureFlag}{features[m.featureFlag] ? "" : tt(" (kapalı)")}</span> : null}
                  </td>
                  <td className="px-3 py-2 uppercase">{m.provider}</td>
                  <td className="px-3 py-2">{kindTr[m.kind] ?? m.kind}</td>
                  <td className="px-3 py-2 tabular-nums">{usd.format(Number(m.unitPriceUsd))}/{m.unit}</td>
                  <td className="px-3 py-2">
                    <StatusDot tone={m.status === "deprecated" ? "passive" : m.licenseStatus === "cleared" ? "active" : m.licenseStatus === "restricted" ? "critical" : "muted"}>
                      {m.status === "deprecated" ? tt("Kullanımdan kalktı") : licenseTr[m.licenseStatus]}
                    </StatusDot>
                  </td>
                  <td className="px-3 py-2">
                    <ModelControls modelKey={m.key} license={m.licenseStatus} status={m.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card interactive={false} id="entegrasyon" className="flex scroll-mt-24 flex-col gap-4">
        <CardTitle>{tt("Entegrasyon durumu")}</CardTitle>
        <p className="text-[13px] text-fg-muted">{tt("Tüm dış servislerin canlı / mock durumu. Mock olanlar anahtar eklenince gerçek moda geçer; gizli değerler burada gösterilmez.")}</p>
        <div className="overflow-x-auto rounded-2xl border border-line">
          <table className="w-full text-[13px]">
            <caption className="sr-only">{tt("Entegrasyon durumu")}</caption>
            <thead className="bg-surface text-left text-fg-muted">
              <tr>
                <th scope="col" className="px-3 py-2 font-medium">{tt("Servis")}</th>
                <th scope="col" className="px-3 py-2 font-medium">{tt("Durum")}</th>
                <th scope="col" className="px-3 py-2 font-medium">{tt("Açıklama")}</th>
              </tr>
            </thead>
            <tbody>
              {integrations.map((i) => (
                <tr key={i.key} className="border-t border-line align-top">
                  <td className="px-3 py-2 font-medium">{i.name}</td>
                  <td className="px-3 py-2">
                    <StatusDot tone={i.mode === "canli" ? "active" : i.mode === "erisim_bekliyor" ? "passive" : "muted"}>{modeLabel(i.mode)}</StatusDot>
                  </td>
                  <td className="px-3 py-2 text-fg-muted">
                    {i.detail}
                    {i.nextStep ? <span className="mt-1 block text-[12px] text-fg-passive">{tt("Sonraki adım:")}{" "}{i.nextStep}</span> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card interactive={false} id="saglayici" className="flex scroll-mt-24 flex-col gap-3">
        <CardTitle>{tt("Sağlayıcıyı canlıya alma")}</CardTitle>
        <ol className="flex list-decimal flex-col gap-2 pl-5 text-[13px] text-fg-muted">
          <li>{tt("fal.ai için")}{" "}<code className="font-mono">{tt("FAL_KEY")}</code>{" "}{tt("anahtarını")}{" "}<code className="font-mono">{tt("infulancer-prod/integrations")}</code>{" "}{tt("sırrına ekleyin, sonra")}{" "}<code className="font-mono">{tt("FAL_MODE=http")}</code>{" "}{tt("ile deploy edilir.")}</li>
          <li>{tt("Asistanı gerçek LLM'e almak için")}{" "}<code className="font-mono">{tt("LLM_PROVIDER=bedrock")}</code>{" "}{tt("ve bölgede model erişimi gerekir (eu-central-1'de 55 model açık).")}</li>
          <li>{tt("Bedrock görsel/video için ilgili bölgede Nova Canvas/Reel erişimini açın, sonra yukarıdaki bayrağı açın.")}</li>
          <li>{tt("Meta/TikTok reklam için")}{" "}<code className="font-mono">{tt("META_ADS_ACCESS_TOKEN")}</code> / <code className="font-mono">{tt("TIKTOK_ACCESS_TOKEN")}</code>{" "}{tt("ekleyin; eklenene kadar reklam taslakları yalnız onay kuyruğunda kalır.")}</li>
        </ol>
        <p className="text-[12px] text-fg-passive">{tt("Anahtarları ekledikten sonra \"ekledim\" deyin; gerçek moda alıp deploy edilir.")}</p>
      </Card>
    </div>
  );
}
