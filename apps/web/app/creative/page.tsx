import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@infulancer/core/db";
import { aiDisclosureChecklist } from "@infulancer/core/creative/c2pa";
import { ensureStarterCredits } from "@infulancer/core/creative/credits";
import { AGENCY_TENANT } from "@infulancer/core/creative/tenant";
import { ownTenant } from "@/lib/creative-tenant";
import { tenantCurrency } from "@infulancer/core/creative/tenant";
import { PhonePreviewButton } from "@/components/creative/phone-preview-button";
import { allowedDurations, modelSpec, supportedAspects } from "@infulancer/core/creative/adapters";
import { rateFromTry, creativePricing } from "@infulancer/core/creative/pricing";
import { reconcileStaleJobs } from "@infulancer/core/creative/fal";
import { PricingForm } from "@/components/creative/pricing-form";
import { CreditRequestForm } from "@/components/creative/credit-request-form";
import { StudioEditor, type StudioUpload } from "@/components/creative/studio-editor";
import { AssetThumb } from "@/components/creative/asset-thumb";
import { openAssetInStudioAction } from "@/lib/actions/creative-studio";
import { getConfig } from "@infulancer/core/config/store";
import { withUnverified } from "@infulancer/core/unverified";
import { CreativeComposer, type ComposerModel } from "@/components/creative/creative-composer";
import { KindIcon } from "@/components/creative/kind-icon";
import { PostBriefStudio } from "@/components/creative/post-brief-studio";
import { TopUpForm } from "@/components/forms/operations-forms";
import { ReelCard } from "@/components/landing/reel-card";
import { FilterTabs, Pill, SectionHead, StatStrip, type PillTone } from "@/components/luma/primitives";
import { DocLink } from "@/components/docs/doc-components";
import { UnverifiedBadge } from "@/components/ui/unverified";
import { requireActor } from "@/lib/auth-guard";
import { asKind, fmtTl, KIND_LABEL, modelName, needsReference, toneFor, type CreativeKind } from "@/lib/creative-models";
import { getLandingContent, toVideos } from "@/lib/landing-store";
import { fmtDateTime } from "@/lib/time";
import { cn } from "@/lib/cn";
export const metadata: Metadata = { title: "Creative" };
export const dynamic = "force-dynamic";
const usd = new Intl.NumberFormat("tr-TR", { style: "currency", currency: "USD", maximumFractionDigits: 4 });
const JOB_STATUS: Record<string, { label: string; tone: PillTone }> = {
  COMPLETED: { label: "Hazır", tone: "green" },
  FAILED: { label: "Başarısız", tone: "red" },
  REJECTED: { label: "Reddedildi", tone: "red" },
  HELD: { label: "Sırada", tone: "amber" },
  IN_QUEUE: { label: "Sırada", tone: "amber" },
  IN_PROGRESS: { label: "Üretiliyor", tone: "violet" },
  CANCELLED: { label: "İptal", tone: "gray" },
};
type Tab = "uret" | "studyo" | "galeri" | "metin" | "yonetim";
type SP = { sekme?: string; tur?: string; asset?: string; prompt?: string; hesap?: string; dosya?: string; hata?: string };
/** Creative: tüm roller için tek stüdyo (üret · galeri · post/brief · yönetim). */
export default async function CreativePage({ searchParams }: { searchParams: Promise<SP> }) {
  const actor = await requireActor();
  const sp = await searchParams;
  const isAdmin = actor.role === "ADMIN";
  // Herkes kendi hesabında çalışır: marka, influencer, ajans (yönetici başka hesabın bakiyesini harcamaz).
  const own = ownTenant(actor);
  const accCurrency = await tenantCurrency(own);
  // İlk kez açan marka/influencer'a tek seferlik hoş geldin bakiyesi (idempotent). Ajans hesabı yöneticiden yüklenir.
  if (!isAdmin) await ensureStarterCredits(own);
  const scope = { tenantId: own };
  const pendingCreditReq = !isAdmin && !!(await prisma.creditRequest.findFirst({ where: { tenantId: own, status: "BEKLIYOR" }, select: { id: true } }));
  // Webhook'u kaçan işleri arka planda sonuçlandır (bakiye bloke kalmasın).
  void reconcileStaleJobs().catch(() => {});
  const [pricing, ledger] = await Promise.all([
    creativePricing(),
    prisma.creditLedger.findMany({ where: isAdmin ? {} : { tenantId: own }, orderBy: { createdAt: "desc" }, take: isAdmin ? 60 : 30 }),
  ]);
  const [models, flags, brands, influencers, accounts, jobs, assets] = await Promise.all([
    prisma.modelRegistry.findMany({ orderBy: [{ kind: "asc" }, { creditsPerUnit: "asc" }] }),
    getConfig("features"),
    prisma.brand.findMany({ where: isAdmin ? {} : { id: actor.brandId ?? "-" }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.influencer.findMany({ where: isAdmin ? {} : { id: actor.influencerId ?? "-" }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.creditAccount.findMany({ where: isAdmin ? {} : scope }),
    prisma.creativeJob.findMany({ where: scope, orderBy: { createdAt: "desc" }, take: 40 }),
    prisma.generatedAsset.findMany({ where: scope, orderBy: { createdAt: "desc" }, take: 60 }),
  ]);
  const nameOf = new Map<string, string>([[AGENCY_TENANT, "Ajans (kendi hesabı)"], ...brands.map((b) => [b.id, b.name] as const), ...influencers.map((i) => [i.id, i.name] as const)]);
  const kindOf = new Map(models.map((m) => [m.key, asKind(m.kind)]));
  const avail = (tenantId: string) => {
    const a = accounts.find((x) => x.tenantId === tenantId);
    return a ? Number(a.balanceCredits) - Number(a.heldCredits) : 0;
  };
  // Yalnız istek gövdesi tanımlı (adapters) ve fal'da doğrulanmış modeller; ucuzdan pahalıya.
  const usable: ComposerModel[] = models
    .filter((m) => m.status === "active" && m.licenseStatus === "cleared" && (!m.featureFlag || flags[m.featureFlag]) && m.provider === "fal" && asKind(m.kind) && !needsReference(m.key) && modelSpec(m.key))
    .map((m) => ({ key: m.key, kind: asKind(m.kind)!, unit: m.unit, creditsPerUnit: Number(m.creditsPerUnit) * rateFromTry(pricing, accCurrency), maxUnits: m.maxUnits, durations: allowedDurations(m.key), aspects: supportedAspects(m.key) }));
  // Yönetici bakiye yüklemesi için hesap listesi (ajans hesabı dahil).
  const tenants = isAdmin
    ? [{ id: AGENCY_TENANT, name: "Ajans (kendi hesabı)", group: "Ajans" as const }, ...brands.map((b) => ({ id: b.id, name: b.name, group: "Markalar" as const })), ...influencers.map((i) => ({ id: i.id, name: i.name, group: "Influencerlar" as const }))]
    : [];
  const jobPrompt = new Map(jobs.map((j) => [j.id, j.prompt]));
  const missingJobIds = assets.map((a) => a.jobId).filter((id): id is string => !!id && !jobPrompt.has(id));
  if (missingJobIds.length) {
    for (const j of await prisma.creativeJob.findMany({ where: { id: { in: missingJobIds } }, select: { id: true, prompt: true } })) jobPrompt.set(j.id, j.prompt);
  }
  const adBase = actor.role === "ADMIN" ? "/admin/reklam" : actor.role === "BRAND" ? "/marka/reklam" : null;
  const tab: Tab = sp.sekme === "galeri" || sp.sekme === "metin" || sp.sekme === "studyo" || (sp.sekme === "yonetim" && isAdmin) ? (sp.sekme as Tab) : "uret";
  // Kitaplık: herkes kendi hesabının dosyaları (Üret sekmesinde referans olarak da seçilir).
  const library = tab === "studyo" || tab === "uret" ? await prisma.creativeUpload.findMany({ where: { tenantId: own }, orderBy: { createdAt: "desc" }, take: 120 }) : [];
  const studioUploads: StudioUpload[] =
    tab === "studyo"
      ? library.map((u) => ({
          id: u.id,
          kind: u.kind === "video" ? "video" : "image",
          name: u.name,
          mime: u.mime,
          sizeBytes: u.sizeBytes,
          source: u.source,
          durationSec: u.durationSec,
          createdAt: u.createdAt.toISOString(),
        }))
      : [];
  // Hesabın para birimi: model fiyatları (TL) USD kuru üzerinden bu birime çevrilerek FİYATLANIR; gösterimde çevrim yok.
  const currency = accCurrency;
  const rate = rateFromTry(pricing, currency);
  const minCharge = currency === "TRY" ? pricing.minTry : Math.ceil(pricing.minTry * rate * 100 - 1e-9) / 100;
  const priceOf = (key: string, fallback: number) => Number(models.find((m) => m.key === key)?.creditsPerUnit ?? fallback) * rate;
  const money = (n: number) => fmtTl(n, currency);
  const studioPrices = { currency, minTry: minCharge, promptEdit: priceOf("nano-banana-edit", 6), bgRemove: priceOf("bria-bg-remove", 3), upscale: priceOf("esrgan-upscale", 1), i2vPerSec: priceOf("kling-v2-5-i2v", 11), i2vEcoPerSec: priceOf("hailuo-02-fast-i2v", 3) };
  const available = avail(own);
  const completed = jobs.filter((j) => j.status === "COMPLETED").length;
  const description =
    actor.role === "BRAND"
      ? "Kampanyalarınız için görsel, video ve seslendirme üretin; tek tıkla post metni veya reklama dönüştürün."
      : actor.role === "INFLUENCER"
        ? "İçerikleriniz için görsel, video ve ses üretin; gönderi metnini de birlikte hazırlayalım."
        : "Marka ve influencerlar adına üretin; bakiye ve modelleri tek yerden yönetin.";
  const tabs = [
    { id: "uret", label: "Üret", href: "/creative" },
    { id: "studyo", label: "Stüdyo (yükle ve düzenle)", href: "/creative?sekme=studyo" },
    { id: "galeri", label: "Galeri", href: "/creative?sekme=galeri", count: assets.length },
    { id: "metin", label: "Post ve brief", href: "/creative?sekme=metin" },
    ...(isAdmin ? [{ id: "yonetim", label: "Bakiye ve modeller", href: "/creative?sekme=yonetim" }] : []),
  ];
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <header className="relative overflow-hidden rounded-3xl border border-line bg-surface px-6 py-7 sm:px-8">
        <div className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-gradient-to-br from-fuchsia-500/30 via-violet-500/20 to-sky-400/10 blur-3xl" aria-hidden />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex max-w-2xl flex-col gap-2">
            <span className="w-fit rounded-full border border-line px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wider text-fg-muted">AI stüdyo</span>
            <h1 className="text-title text-fg">Creative</h1>
            <p className="text-sm text-fg-muted">{description}</p>
          </div>
          <div className="flex flex-col items-start gap-1 sm:items-end">
            <span className="text-[12px] text-fg-muted">{isAdmin ? "Ajans hesabının bakiyesi" : "Kullanılabilir bakiyeniz"}</span>
            <span className="text-3xl font-semibold tabular-nums text-fg">{money(available)}</span>
            <span className="text-[11px] text-fg-passive">{isAdmin ? "Her üretim yalnız işlemi yapan hesabın bakiyesinden düşer." : "Bakiye yüklemek için “Bakiye talebi” gönderin."}</span>
          </div>
        </div>
      </header>
      {!isAdmin ? <CreditRequestForm pending={pendingCreditReq} currency={currency} /> : null}
      {!isAdmin && ledger.length ? (
        <details className="rounded-2xl border border-line bg-surface">
          <summary className="cursor-pointer px-4 py-3 text-[13px] font-medium text-fg">Bakiye hareketleri</summary>
          <LedgerList rows={ledger} currencyOf={() => currency} />
        </details>
      ) : null}
      <FilterTabs items={tabs} active={tab} />
      {tab === "uret" ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="flex min-w-0 flex-col gap-6">
            <CreativeComposer
              key={sp.prompt ?? ""}
              minTry={minCharge}
              currency={currency}
              models={usable}
              available={available}
              username={(nameOf.get(own) ?? "markaniz").split(" ")[0]!.toLocaleLowerCase("tr")}
              library={library.map((u) => ({ id: u.id, kind: u.kind === "video" ? "video" : "image", name: u.name }))}
              refPrices={{ imageEdit: priceOf("nano-banana-edit", 6), klingI2v: priceOf("kling-v2-5-i2v", 11), ecoI2v: priceOf("hailuo-02-fast-i2v", 3) }}
              initialPrompt={(sp.prompt ?? "").slice(0, 2000)}
            />
            <Inspiration />
          </div>
          <aside className="flex flex-col gap-4" aria-label="Son üretimler">
            <SectionHead title="Son üretimler" action={jobs.length ? <Link href="/creative?sekme=galeri" className="text-[12px] text-fg-muted hover:text-fg">Galeri →</Link> : null} />
            {jobs.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-line p-5 text-center text-[13px] text-fg-muted">Henüz üretim yok. İlk isteğinizi yazın; sonuç burada ve galeride görünür.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {jobs.slice(0, 6).map((j) => {
                  const st = JOB_STATUS[j.status] ?? { label: j.status, tone: "gray" as const };
                  const k = kindOf.get(j.modelKey) ?? "image";
                  return (
                    <li key={j.id} className="flex gap-3 rounded-2xl border border-line bg-surface p-3">
                      <span className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white", toneFor(k, j.id))}>
                        <KindIcon kind={k} size={18} />
                      </span>
                      <div className="flex min-w-0 flex-col gap-1">
                        <p className="line-clamp-2 text-[13px] text-fg">{j.prompt}</p>
                        <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-fg-passive">
                          <Pill tone={st.tone} className="px-2 text-[11px]">
                            {st.label}
                          </Pill>
                          <span>{modelName(j.modelKey)}</span>
                        </div>
                        {j.rejectReason ? <p className="text-[12px] text-critical">{j.rejectReason}</p> : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
            <div className="rounded-2xl border border-line p-4 text-[13px] text-fg-muted">
              <p className="mb-2 font-medium text-fg">Nasıl çalışır?</p>
              <ol className="flex list-decimal flex-col gap-1 pl-4">
                <li>Tür seçin, ne istediğinizi yazın.</li>
                <li>Format ve stili belirleyin; maliyet anında görünür.</li>
                <li>Hazır olan içerik galeriye düşer; post metni {adBase ? "veya reklam " : ""}tek tıkla.</li>
              </ol>
            </div>
          </aside>
        </div>
      ) : null}
      {tab === "galeri" && sp.hata ? <p role="alert" className="rounded-xl bg-red-500/10 px-3 py-2 text-[13px] text-critical">{sp.hata.slice(0, 200)}</p> : null}
      {tab === "galeri" ? <Gallery assets={assets} kindOf={kindOf} jobPrompt={jobPrompt} adBase={adBase} filter={sp.tur} completed={completed} /> : null}
      {tab === "studyo" ? (
        <div className="flex flex-col gap-4">

          <StudioEditor uploads={studioUploads} available={available} prices={studioPrices} isAdmin={isAdmin} initialSelected={sp.dosya} />
        </div>
      ) : null}
      {tab === "metin" ? (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-fg-muted">Galerideki bir içerikten veya serbest bir konudan yayına hazır post metni ve içerik üreticisine verilecek brief taslağı oluşturun.</p>
          <PostBriefStudio
            defaultAssetId={sp.asset}
            assets={assets.map((a) => {
              const k = kindOf.get(a.modelKey) ?? "image";
              const p = a.jobId ? jobPrompt.get(a.jobId) : undefined;
              return { id: a.id, label: `${KIND_LABEL[k]} · ${(p ?? modelName(a.modelKey)).slice(0, 48)}` };
            })}
          />
        </div>
      ) : null}
      {tab === "yonetim" && isAdmin ? (
        <div className="flex flex-col gap-6">
          <StatStrip
            stats={[
              { label: "Hesap", value: String(accounts.length) },
              { label: "Toplam bakiye (TL hesaplar)", value: fmtTl(accounts.filter((a) => a.currency === "TRY").reduce((s, a) => s + Number(a.balanceCredits), 0)) },
              { label: "Blokede (TL)", value: fmtTl(accounts.filter((a) => a.currency === "TRY").reduce((s, a) => s + Number(a.heldCredits), 0)) },
              { label: "Son işler", value: String(jobs.length) },
              { label: "Tamamlanan", value: String(completed) },
              { label: "Aktif model", value: String(usable.length) },
            ]}
          />
          <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-5">
              <SectionHead title="Fiyatlandırma" />
              <p className="text-[12px] text-fg-muted">
                Fiyat = sağlayıcı USD maliyeti × kur ({pricing.usdTry.toLocaleString("tr-TR")} TL{pricing.fxUpdatedAt ? `, ${fmtDateTime(new Date(pricing.fxUpdatedAt))}` : ""}) × {pricing.markup} · iş başına en az {fmtTl(pricing.minTry)}. Kur her açılışta güncellenir.
              </p>
              <PricingForm markup={pricing.markup} minTry={pricing.minTry} usdTry={pricing.usdTry} autoFx={pricing.autoFx} />
              <SectionHead title="Bakiye yükle" />
              <TopUpForm label="Hesap" brands={tenants.map((t) => ({ id: t.id, name: t.group === "Ajans" ? t.name : `${t.group === "Markalar" ? "Marka" : "Influencer"} · ${t.name}` }))} />
              <p className="text-[12px] text-fg-passive">Tutarlar TL cinsindendir. Yeni marka/influencer ilk girişte {fmtTl(Number(process.env.CREATIVE_STARTER_CREDITS ?? "250"))} hoş geldin bakiyesi alır.</p>
            </div>
            <div className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-5">
              <SectionHead title="Bakiyeler" />
              <ul className="flex max-h-72 flex-col divide-y divide-line overflow-y-auto text-sm">
                {accounts.length === 0 ? <li className="py-2 text-fg-muted">Henüz hesap yok.</li> : null}
                {accounts.map((a) => (
                  <li key={a.tenantId} className="flex justify-between gap-2 py-2">
                    <span className="truncate">{nameOf.get(a.tenantId) ?? a.tenantId.slice(-6)}</span>
                    <span className="shrink-0 tabular-nums text-fg-muted">
                      {fmtTl(Number(a.balanceCredits), a.currency)}{Number(a.heldCredits) ? ` · ${fmtTl(Number(a.heldCredits), a.currency)} blokede` : ""}
                    </span>
                  </li>
                ))}
              </ul>
              <DocLink slug="kredi-ve-maliyet" />
            </div>
          </section>
          {ledger.length ? (
            <section className="flex flex-col gap-3 rounded-2xl border border-line bg-surface">
              <div className="px-4 pt-4">
                <SectionHead title="Son bakiye hareketleri (tüm hesaplar)" />
              </div>
              <LedgerList currencyOf={(t) => accounts.find((a) => a.tenantId === t)?.currency ?? "TRY"} rows={ledger.map((r) => ({ ...r, note: `${nameOf.get(r.tenantId) ?? r.tenantId.slice(-6)}${r.note ? ` · ${r.note}` : ""}` }))} />
            </section>
          ) : null}
          <section className="flex flex-col gap-3">
            <SectionHead title="Model kaydı" action={<DocLink slug="model-kaydi-ve-lisans" />} />
            <div className="overflow-x-auto rounded-2xl border border-line">
              <table className="w-full min-w-[640px] text-sm">
                <caption className="sr-only">Model listesi ve fiyatları</caption>
                <thead className="bg-fg/[0.03]">
                  <tr className="text-left text-[12px] text-fg-muted">
                    <th className="px-4 py-2 font-medium">Model</th>
                    <th className="px-4 py-2 font-medium">Tür</th>
                    <th className="px-4 py-2 font-medium">Birim fiyat</th>
                    <th className="px-4 py-2 font-medium">Fiyat</th>
                    <th className="px-4 py-2 font-medium">Lisans</th>
                    <th className="px-4 py-2 font-medium">Durum</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {models.map((m) => (
                    <tr key={m.key} className="align-top">
                      <td className="px-4 py-2">
                        {modelName(m.key)}
                        <span className="block text-[11px] text-fg-passive">{m.modelId}</span>
                      </td>
                      <td className="px-4 py-2">{m.kind}</td>
                      <td className="px-4 py-2 tabular-nums">{withUnverified(`${usd.format(Number(m.unitPriceUsd))} / ${m.unit}`, m.priceVerified)}</td>
                      <td className="px-4 py-2 tabular-nums">{fmtTl(Number(m.creditsPerUnit))}</td>
                      <td className="px-4 py-2">
                        <Pill tone={m.licenseStatus === "cleared" ? "green" : "amber"}>{m.licenseStatus === "cleared" ? "Onaylı" : "Bekliyor"}</Pill>
                      </td>
                      <td className="px-4 py-2">
                        <span className="inline-flex items-center gap-1">
                          {m.status === "active" ? "Aktif" : m.status}
                          {m.replacementKey ? ` → ${m.replacementKey}` : ""}
                          {m.emitsC2pa == null ? <UnverifiedBadge title="Çıktının C2PA taşıyıp taşımadığı ampirik olarak test edilmedi." /> : null}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <section className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-5">
            <SectionHead title="AI açıklama kontrol listesi" action={<DocLink slug="ai-icerik-aciklamasi" />} />
            <ul className="flex list-disc flex-col gap-2 pl-5 text-sm text-fg-muted">
              {aiDisclosureChecklist.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </section>
        </div>
      ) : null}
    </div>
  );
}
/** Galeri: üretilen içerikler; tür filtresi ve hızlı eylemler. */
function Gallery({
  assets,
  kindOf,
  jobPrompt,
  adBase,
  filter,
  completed,
}: {
  assets: { id: string; tenantId: string; jobId: string | null; modelKey: string; c2paManifestId: string; createdAt: Date }[];
  kindOf: Map<string, CreativeKind | null>;
  jobPrompt: Map<string, string>;
  adBase: string | null;
  filter?: string;
  completed: number;
}) {
  const active: CreativeKind | "hepsi" = filter === "image" || filter === "video" || filter === "audio" ? filter : "hepsi";
  const list = assets.filter((a) => active === "hepsi" || (kindOf.get(a.modelKey) ?? "image") === active);
  const count = (k: CreativeKind) => assets.filter((a) => (kindOf.get(a.modelKey) ?? "image") === k).length;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <FilterTabs
          active={active}
          items={[
            { id: "hepsi", label: "Tümü", href: "/creative?sekme=galeri", count: assets.length },
            { id: "image", label: "Görsel", href: "/creative?sekme=galeri&tur=image", count: count("image") },
            { id: "video", label: "Video", href: "/creative?sekme=galeri&tur=video", count: count("video") },
            { id: "audio", label: "Ses", href: "/creative?sekme=galeri&tur=audio", count: count("audio") },
          ]}
        />
        <span className="text-[12px] text-fg-passive">{completed} tamamlanan üretim · hepsi C2PA &quot;AI ile üretildi&quot; etiketli</span>
      </div>
      {list.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-line px-6 py-14 text-center">
          <p className="text-base font-medium text-fg">Galeri boş</p>
          <p className="max-w-sm text-sm text-fg-muted">Ürettiğiniz görsel, video ve sesler burada toplanır.</p>
          <Link href="/creative" className="rounded-full bg-fg px-5 py-2 text-[13px] font-semibold text-bg hover:opacity-90">
            İlk içeriği üret
          </Link>
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {list.map((a) => {
            const k = kindOf.get(a.modelKey) ?? "image";
            const prompt = (a.jobId ? jobPrompt.get(a.jobId) : undefined) ?? "";
            const basePrompt = prompt.split(". Format:")[0]!.split(". Stil:")[0]!;
            return (
              <li key={a.id} className="group flex flex-col overflow-hidden rounded-2xl border border-line bg-surface transition-standard hover:border-fg/30">
                <div className={cn("relative flex aspect-[4/5] flex-col justify-between overflow-hidden bg-gradient-to-br p-3 text-white", toneFor(k, a.id))}>
                  <AssetThumb id={a.id} kind={k} alt={basePrompt || modelName(a.modelKey)} />
                  <div className="relative flex items-start justify-between">
                    <span className="inline-flex items-center gap-1 rounded-full bg-black/25 px-2 py-0.5 text-[11px] font-medium backdrop-blur">
                      <KindIcon kind={k} size={12} /> {KIND_LABEL[k]}
                    </span>
                    <span className="rounded-full bg-white/85 px-2 py-0.5 text-[10px] font-semibold text-black">AI</span>
                  </div>
                  <div className="relative flex justify-center opacity-80" aria-hidden>
                    <KindIcon kind={k} size={40} />
                  </div>
                  <p className="relative line-clamp-3 rounded-xl bg-black/30 p-2 text-[12px] leading-snug backdrop-blur">{basePrompt || modelName(a.modelKey)}</p>
                </div>
                <div className="flex flex-1 flex-col gap-2 p-3">
                  <div className="flex flex-col text-[11px] text-fg-passive">
                    <span className="truncate text-[12px] text-fg-muted">
                      {modelName(a.modelKey)}
                    </span>
                    <span>
                      {fmtDateTime(a.createdAt)} · C2PA {a.c2paManifestId.slice(0, 6)}
                    </span>
                  </div>
                  <div className="mt-auto flex flex-wrap gap-1.5">
                    {k !== "audio" ? <PhonePreviewButton src={`/api/creative/file/${a.id}?t=asset`} kind={k === "video" ? "video" : "image"} caption={basePrompt.slice(0, 120)} /> : null}
                    <Link href={`/creative?sekme=metin&asset=${a.id}`} className="rounded-full border border-line px-2.5 py-1 text-[11px] text-fg hover:border-fg/40">
                      Post yaz
                    </Link>
                    {adBase ? (
                      <Link href={`${adBase}?asset=${a.id}`} className="rounded-full border border-line px-2.5 py-1 text-[11px] text-fg hover:border-fg/40">
                        Reklam
                      </Link>
                    ) : null}
                    {k === "image" ? (
                      <form action={openAssetInStudioAction}>
                        <input type="hidden" name="assetId" value={a.id} />
                        <button type="submit" className="rounded-full border border-line px-2.5 py-1 text-[11px] text-fg hover:border-fg/40">
                          Stüdyoda düzenle
                        </button>
                      </form>
                    ) : null}
                    {basePrompt ? (
                      <Link href={`/creative?prompt=${encodeURIComponent(basePrompt)}`} className="rounded-full border border-line px-2.5 py-1 text-[11px] text-fg-muted hover:text-fg">
                        Benzerini üret
                      </Link>
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
/** İlham şeridi: örnek işlerden birine tıklayınca istek o tarzda doldurulur. */
async function Inspiration() {
  const examples = toVideos(await getLandingContent()).slice(0, 4);
  if (!examples.length) return null;
  return (
    <section className="flex flex-col gap-3" aria-label="İlham">
      <SectionHead title="İlham al" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {examples.map((v, i) => (
          <Link key={`${v.handle}-${i}`} href={`/creative?prompt=${encodeURIComponent(`${v.caption.replace(/#\S+/g, "").trim()}, ${v.platform} için dikey video, aynı tarzda`)}`} className="group" aria-label={`${v.caption}: bu tarzda üret`}>
            <ReelCard video={v} delay={i * 600} className="transition-transform group-hover:scale-[1.02]" />
            <span className="mt-1 block text-[11px] text-fg-muted group-hover:text-fg">Bu tarzda üret →</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
const LEDGER_LABEL: Record<string, string> = { STARTER: "Hoş geldin bakiyesi", TOPUP: "Yükleme", CHARGE: "Üretim", REFUND: "İade", ADJUST: "Düzeltme" };
/** Bakiye hareketleri: her yükleme ve tahsilat, işlem sonrası bakiyeyle. */
function LedgerList({ rows, currencyOf }: { rows: { id: string; tenantId?: string; kind: string; amount: unknown; balanceAfter: unknown; note: string | null; createdAt: Date }[]; currencyOf: (tenantId?: string) => string }) {
  return (
    <ul className="flex max-h-80 flex-col divide-y divide-line overflow-y-auto border-t border-line text-[13px]">
      {rows.map((r) => {
        const amt = Number(r.amount);
        return (
          <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-2">
            <span className="flex min-w-0 flex-col">
              <span className="text-fg">{LEDGER_LABEL[r.kind] ?? r.kind}</span>
              <span className="truncate text-[11px] text-fg-passive">
                {fmtDateTime(r.createdAt)}
                {r.note ? ` · ${r.note}` : ""}
              </span>
            </span>
            <span className="flex shrink-0 flex-col items-end tabular-nums">
              <span className={amt < 0 ? "text-fg" : "text-emerald-600"}>{amt > 0 ? "+" : "−"}{fmtTl(Math.abs(amt), currencyOf(r.tenantId))}</span>
              <span className="text-[11px] text-fg-passive">Bakiye {fmtTl(Number(r.balanceAfter), currencyOf(r.tenantId))}</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
