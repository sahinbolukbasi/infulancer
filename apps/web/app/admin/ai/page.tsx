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
      <PageHeader title="AI sağlayıcıları" description="Asistan ve Creative için Bedrock ve fal.ai modellerini buradan yönetin." />
      <StatusCards
        items={[
          { title: "Asistan (metin)", state: llm === "bedrock" ? "ok" : "warn", value: llm === "bedrock" ? "Bedrock · canlı" : "Mock", text: llm === "bedrock" ? "Yanıtlar Amazon Bedrock modelinden üretiliyor." : "Kural tabanlı çalışıyor; gerçek LLM için LLM_PROVIDER=bedrock.", href: "#saglayici", action: "Nasıl açılır" },
          { title: "Creative · fal.ai", state: falMode === "http" ? "ok" : "warn", value: falMode === "http" ? "Canlı" : "Mock", text: falMode === "http" ? "Görsel/video gerçek üretiliyor." : "Çıktı simüle ediliyor; FAL_KEY gerekiyor.", href: "#saglayici", action: "Nasıl açılır" },
          { title: "Creative · Bedrock görsel", state: features["creative.bedrockImage"] ? "ok" : "warn", value: features["creative.bedrockImage"] ? "Açık" : "Erişim bekliyor", text: "Nova Canvas / Titan. Bölge erişimi açılınca kullanılabilir.", href: "#bayraklar", action: "Bayrağı aç" },
          { title: "Creative · Bedrock video", state: features["creative.bedrockVideo"] ? "ok" : "warn", value: features["creative.bedrockVideo"] ? "Açık" : "Erişim bekliyor", text: "Nova Reel. Bölge erişimi açılınca kullanılabilir.", href: "#bayraklar", action: "Bayrağı aç" },
        ]}
      />
      <Card interactive={false} id="bayraklar" className="flex scroll-mt-24 flex-col gap-4">
        <CardTitle>Özellik bayrakları</CardTitle>
        <p className="text-[13px] text-fg-muted">Deneysel veya bölge/erişim bekleyen model gruplarını açıp kapatın. Kapalıyken bu modeller Creative&apos;de listelenmez.</p>
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
        <CardTitle>Model kaydı ({models.length})</CardTitle>
        <p className="text-[13px] text-fg-muted">Lisansı onaylı modeller müşteri işinde kullanılabilir. Bir modeli engellemek için lisansı &quot;Kısıtlı&quot; yapın.</p>
        <div className="overflow-x-auto rounded-2xl border border-line">
          <table className="w-full text-[13px]">
            <caption className="sr-only">AI modelleri</caption>
            <thead className="bg-surface text-left text-fg-muted">
              <tr>
                <th scope="col" className="px-3 py-2 font-medium">Model</th>
                <th scope="col" className="px-3 py-2 font-medium">Sağlayıcı</th>
                <th scope="col" className="px-3 py-2 font-medium">Tür</th>
                <th scope="col" className="px-3 py-2 font-medium">Birim fiyat</th>
                <th scope="col" className="px-3 py-2 font-medium">Durum</th>
                <th scope="col" className="px-3 py-2 font-medium">Yönet</th>
              </tr>
            </thead>
            <tbody>
              {models.map((m) => (
                <tr key={m.key} className="border-t border-line align-top">
                  <td className="px-3 py-2">
                    <span className="font-medium">{m.key}</span>
                    <span className="block font-mono text-[11px] text-fg-passive">{m.modelId}</span>
                    {m.featureFlag ? <span className="text-[11px] text-fg-passive">bayrak: {m.featureFlag}{features[m.featureFlag] ? "" : " (kapalı)"}</span> : null}
                  </td>
                  <td className="px-3 py-2 uppercase">{m.provider}</td>
                  <td className="px-3 py-2">{kindTr[m.kind] ?? m.kind}</td>
                  <td className="px-3 py-2 tabular-nums">{usd.format(Number(m.unitPriceUsd))}/{m.unit}</td>
                  <td className="px-3 py-2">
                    <StatusDot tone={m.status === "deprecated" ? "passive" : m.licenseStatus === "cleared" ? "active" : m.licenseStatus === "restricted" ? "critical" : "muted"}>
                      {m.status === "deprecated" ? "Kullanımdan kalktı" : licenseTr[m.licenseStatus]}
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
        <CardTitle>Entegrasyon durumu</CardTitle>
        <p className="text-[13px] text-fg-muted">Tüm dış servislerin canlı / mock durumu. Mock olanlar anahtar eklenince gerçek moda geçer; gizli değerler burada gösterilmez.</p>
        <div className="overflow-x-auto rounded-2xl border border-line">
          <table className="w-full text-[13px]">
            <caption className="sr-only">Entegrasyon durumu</caption>
            <thead className="bg-surface text-left text-fg-muted">
              <tr>
                <th scope="col" className="px-3 py-2 font-medium">Servis</th>
                <th scope="col" className="px-3 py-2 font-medium">Durum</th>
                <th scope="col" className="px-3 py-2 font-medium">Açıklama</th>
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
                    {i.nextStep ? <span className="mt-1 block text-[12px] text-fg-passive">Sonraki adım: {i.nextStep}</span> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card interactive={false} id="saglayici" className="flex scroll-mt-24 flex-col gap-3">
        <CardTitle>Sağlayıcıyı canlıya alma</CardTitle>
        <ol className="flex list-decimal flex-col gap-2 pl-5 text-[13px] text-fg-muted">
          <li>fal.ai için <code className="font-mono">FAL_KEY</code> anahtarını <code className="font-mono">infulancer-prod/integrations</code> sırrına ekleyin, sonra <code className="font-mono">FAL_MODE=http</code> ile deploy edilir.</li>
          <li>Asistanı gerçek LLM&apos;e almak için <code className="font-mono">LLM_PROVIDER=bedrock</code> ve bölgede model erişimi gerekir (eu-central-1&apos;de 55 model açık).</li>
          <li>Bedrock görsel/video için ilgili bölgede Nova Canvas/Reel erişimini açın, sonra yukarıdaki bayrağı açın.</li>
          <li>Meta/TikTok reklam için <code className="font-mono">META_ADS_ACCESS_TOKEN</code> / <code className="font-mono">TIKTOK_ACCESS_TOKEN</code> ekleyin; eklenene kadar reklam taslakları yalnız onay kuyruğunda kalır.</li>
        </ol>
        <p className="text-[12px] text-fg-passive">Anahtarları ekledikten sonra &quot;ekledim&quot; deyin; gerçek moda alıp deploy edilir.</p>
      </Card>
    </div>
  );
}
