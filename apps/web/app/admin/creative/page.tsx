import type { Metadata } from "next";
import { prisma } from "@infulancer/core/db";
import { aiDisclosureChecklist } from "@infulancer/core/creative/c2pa";
import { withUnverified } from "@infulancer/core/unverified";
import { Card, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/layout";
import { StatusDot } from "@/components/ui/status";
import { UnverifiedBadge } from "@/components/ui/unverified";
import { requireActor } from "@/lib/auth-guard";
import { DocLink } from "@/components/docs/doc-components";
import { CreativeStudio } from "@/components/creative/creative-studio";
import { PostBriefStudio } from "@/components/creative/post-brief-studio";
import { getLandingContent, toVideos } from "@/lib/landing-store";
import { TopUpForm } from "@/components/forms/operations-forms";
import { getConfig } from "@infulancer/core/config/store";
import { fmtDateTime } from "@/lib/time";

export const metadata: Metadata = { title: "Creative" };

const usd = new Intl.NumberFormat("tr-TR", { style: "currency", currency: "USD", maximumFractionDigits: 4 });

export default async function AdminCreativePage() {
  await requireActor("ADMIN");
  const [models, jobs, accounts, brands, assets, flags] = await Promise.all([
    prisma.modelRegistry.findMany({ orderBy: [{ kind: "asc" }, { key: "asc" }] }),
    prisma.creativeJob.findMany({ orderBy: { createdAt: "desc" }, take: 30 }),
    prisma.creditAccount.findMany(),
    prisma.brand.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.generatedAsset.findMany({ orderBy: { createdAt: "desc" }, take: 12 }),
    getConfig("features"),
  ]);
  const landing = await getLandingContent();
  const brandName = new Map(brands.map((b) => [b.id, b.name]));
  const usable = models
    .filter((m) => m.status === "active" && m.licenseStatus === "cleared" && (!m.featureFlag || flags[m.featureFlag]) && m.provider === "fal")
    .map((m) => ({ key: m.key, label: `${m.key} · ${m.kind}`, kind: String(m.kind), unit: m.unit, creditsPerUnit: Number(m.creditsPerUnit), maxUnits: m.maxUnits }));
  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Creative" description="Yazın, üretilsin. Her çıktıya AI etiketi gömülür." />
      {usable.length ? (
        <CreativeStudio
          brands={brands}
          models={usable}
          examples={toVideos(landing)}
          jobs={jobs.map((j) => ({
            id: j.id,
            prompt: j.prompt,
            brand: brandName.get(j.tenantId) ?? "—",
            modelKey: j.modelKey,
            status: j.status,
            at: fmtDateTime(j.createdAt),
            units: Number(j.units),
            reject: j.rejectReason,
            c2pa: assets.find((x) => x.jobId === j.id)?.c2paManifestId ?? null,
            assetId: assets.find((x) => x.jobId === j.id)?.id ?? null,
          }))}
        />
      ) : (
        <p className="text-sm text-fg-passive">Kullanılabilir model yok.</p>
      )}
      <PostBriefStudio assets={assets.map((a) => ({ id: a.id, label: `${brandName.get(a.tenantId) ?? "Marka"} · ${a.modelKey}` }))} />
      <details className="rounded-3xl border border-line px-5 py-4">
        <summary className="cursor-pointer text-sm text-fg-muted hover:text-fg">Kredi, model kaydı ve ayrıntılar</summary>
        <div className="mt-4 flex flex-col gap-6">
          <Card interactive={false} className="flex flex-col gap-3">
            <CardTitle>Kredi yükle</CardTitle>
            <TopUpForm brands={brands} />
            <p className="text-[12px] text-fg-passive">
              {accounts.length} marka hesabı · 1 kredi ≈ 0,05 $ ham maliyet.
            </p>
          </Card>
      {assets.length ? (
        <Card interactive={false} className="flex flex-col gap-3">
          <CardTitle>Son üretilen varlıklar</CardTitle>
          <ul className="flex flex-col divide-y divide-border text-sm">
            {assets.map((a) => (
              <li key={a.id} className="flex flex-wrap justify-between gap-2 py-2">
                <span>
                  {brandName.get(a.tenantId) ?? a.tenantId} · {a.modelKey}
                </span>
                <span className="text-[12px] text-fg-muted">C2PA {a.c2paManifestId.slice(0, 8)}… · AI üretimi</span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
      <DocLink slug="model-kaydi-ve-lisans" />

      <Card interactive={false} className="flex flex-col gap-4">
        <CardTitle>Model kaydı</CardTitle>
        <table className="w-full text-sm">
          <caption className="sr-only">Model listesi ve fiyatları</caption>
          <thead>
            <tr className="border-b border-border text-left text-fg-muted">
              <th className="py-2 font-normal">Model</th>
              <th className="py-2 font-normal">Tür</th>
              <th className="py-2 font-normal">Birim fiyat</th>
              <th className="py-2 font-normal">Kredi</th>
              <th className="py-2 font-normal">Lisans</th>
              <th className="py-2 font-normal">Durum</th>
            </tr>
          </thead>
          <tbody>
            {models.map((m) => (
              <tr key={m.key} className="border-b border-border align-top">
                <td className="py-2">
                  {m.key}
                  <span className="block text-[12px] text-fg-passive">{m.modelId}</span>
                </td>
                <td className="py-2">{m.kind}</td>
                <td className="py-2 tabular-nums">
                  {withUnverified(`${usd.format(Number(m.unitPriceUsd))} / ${m.unit}`, m.priceVerified)}
                </td>
                <td className="py-2 tabular-nums">{Number(m.creditsPerUnit)}</td>
                <td className="py-2">
                  <StatusDot tone={m.licenseStatus === "cleared" ? "active" : "critical"}>{m.licenseStatus}</StatusDot>
                </td>
                <td className="py-2">
                  {m.status}
                  {m.replacementKey ? ` → ${m.replacementKey}` : ""}
                  {m.emitsC2pa == null ? <UnverifiedBadge title="Çıktının C2PA taşıyıp taşımadığı ampirik olarak test edilmedi." /> : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card interactive={false} className="flex flex-col gap-3">
          <CardTitle>Kredi bakiyeleri</CardTitle>
          <ul className="flex flex-col divide-y divide-border text-sm">
            {accounts.map((a) => (
              <li key={a.tenantId} className="flex justify-between py-2">
                <span>{brandName.get(a.tenantId) ?? a.tenantId.slice(-6)}</span>
                <span className="tabular-nums">
                  {Number(a.balanceCredits)} kredi · {Number(a.heldCredits)} blokede
                </span>
              </li>
            ))}
          </ul>
          <DocLink slug="kredi-ve-maliyet" />
        </Card>
        <Card interactive={false} className="flex flex-col gap-3">
          <CardTitle>AI açıklama kontrol listesi</CardTitle>
          <ul className="flex list-disc flex-col gap-2 pl-5 text-sm text-fg-muted">
            {aiDisclosureChecklist.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
          <DocLink slug="ai-icerik-aciklamasi" />
        </Card>
      </section>

      <Card interactive={false} className="flex flex-col gap-3">
        <CardTitle>Son işler</CardTitle>
        {jobs.length === 0 ? (
          <p className="text-sm text-fg-passive">Henüz üretim yok.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border text-sm">
            {jobs.map((j) => (
              <li key={j.id} className="flex flex-wrap justify-between gap-2 py-2">
                <span>
                  {j.modelKey} · {fmtDateTime(j.createdAt)}
                </span>
                <StatusDot tone={j.status === "COMPLETED" ? "active" : j.status === "REJECTED" || j.status === "FAILED" ? "critical" : "muted"}>{j.status}</StatusDot>
                {j.rejectReason ? <span className="w-full text-[13px] text-fg-muted">{j.rejectReason}</span> : null}
              </li>
            ))}
          </ul>
        )}
      </Card>
        </div>
      </details>
    </div>
  );
}
