import { getTT } from "@/lib/i18n/tt-server";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Actor } from "@infulancer/core/access/actor";
import { prisma } from "@infulancer/core/db";
import { assertCanEditDraft, draftStatus } from "@infulancer/core/domain/campaign-draft";
import { isWizardStep, prevStep, WIZARD_STEPS, type WizardStepKey } from "@infulancer/core/domain/campaign-plan";
import { isDomainError } from "@infulancer/core/domain/errors";
import { CampaignMedia } from "@/components/campaign/campaign-media";
import { CheckIcon } from "@/components/icons";
import { pickAvatar } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/layout";
import { cn } from "@/lib/cn";
import { wizardBase } from "@/lib/campaign-wizard-paths";
import { AGENCY_TZ, fmtDateTime, localDay } from "@/lib/time";
import { countryLabel } from "@infulancer/core/i18n/regions";
import { AudienceStep, BasicsStep, BriefStep, ContentPlanStep, InfluencerStep, MediaStep, ScheduleStep, SubmitStep, type WizardInfluencer } from "./wizard-steps";

const tl = (k: bigint | number) => (Number(k) > 0 ? (Number(k) / 100).toLocaleString("tr-TR", { maximumFractionDigits: 2 }) : "");

/** Sihirbaz adım çubuğu: tamamlananlar işaretli, aktif adım vurgulu; taslak açılmadan diğer adımlar kilitli. */
async function Steps({ base, active, done }: { base: string | null; active: WizardStepKey; done: Set<string> }) {
  const tt = await getTT();
  const idx = WIZARD_STEPS.findIndex((s) => s.key === active);
  return (
    <nav aria-label={tt("Kampanya oluşturma adımları")}>
      <p className="mb-2 text-[12px] text-fg-passive tabular-nums">{tt("Adım")}{" "}{idx + 1} / {WIZARD_STEPS.length}
      </p>
      <ol className="grid grid-cols-4 gap-2 md:grid-cols-8">
        {WIZARD_STEPS.map((s, i) => {
          const cur = s.key === active;
          const inner = (
            <>
              <span className="flex items-center gap-2 text-[11px] text-fg-passive">
                <span className={cn("inline-flex h-5 w-5 items-center justify-center rounded-full border text-[10px]", done.has(s.key) ? "border-fg bg-fg text-bg" : cur ? "border-fg text-fg" : "border-line")} aria-hidden>
                  {done.has(s.key) ? <CheckIcon size={11} /> : i + 1}
                </span>
                <span className="hidden lg:inline">{done.has(s.key) ? tt("Tamam") : cur ? tt("Şu an") : ""}</span>
              </span>
              <span className="text-[13px] leading-tight text-fg">{s.title}</span>
            </>
          );
          const cls = cn("flex h-full flex-col gap-1 rounded-xl border px-2.5 py-2 transition-standard", cur ? "border-fg bg-fg/[0.04]" : "border-line", base ? "hover:border-fg/40" : "opacity-50");
          return (
            <li key={s.key}>
              {base ? (
                <Link href={`${base}?adim=${s.key}`} aria-current={cur ? "step" : undefined} className={cls}>
                  {inner}
                </Link>
              ) : (
                <span aria-current={cur ? "step" : undefined} aria-disabled={!cur} className={cls}>
                  {inner}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/**
 * Kampanya oluşturma sihirbazı (marka ve ajans aynı ekran). campaignId yoksa yalnız 1. adım açılır;
 * kaydedilince taslak oluşur ve diğer adımlara geçilir.
 */
export async function CampaignWizardPage({ actor, campaignId, step: stepRaw, defaultBrandId }: { actor: Actor; campaignId: string | null; step?: string; defaultBrandId?: string }) {
  const tt = await getTT();
  const isBrand = actor.role === "BRAND";
  if (!campaignId) {
    const brands = isBrand ? undefined : await prisma.brand.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } });
    return (
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <PageHeader title={tt("Yeni kampanya")} description={tt("8 adım: her adım kaydedilir, istediğiniz an çıkıp taslaktan devam edebilirsiniz.")} />
        <Steps base={null} active="temel" done={new Set()} />
        <Card interactive={false} className="flex flex-col gap-2">
          <h2 className="text-section">{tt("1. Temel bilgiler")}</h2>
          <BasicsStep brands={brands} values={defaultBrandId ? { name: "", objective: null, description: null, brandId: defaultBrandId } : undefined} />
        </Card>
      </div>
    );
  }
  try {
    await assertCanEditDraft(actor, campaignId);
  } catch (e) {
    if (isDomainError(e) && e.code === "BULUNAMADI") notFound();
    if (isDomainError(e)) {
      return (
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
          <PageHeader title={tt("Kampanya düzenlenemiyor")} description={e.message} />
          <Link href={isBrand ? `/marka/kampanyalar/${campaignId}` : `/admin/kampanyalar/${campaignId}`} className="text-sm underline underline-offset-4">{tt("Kampanyaya dön")}</Link>
        </div>
      );
    }
    throw e;
  }
  const step: WizardStepKey = isWizardStep(stepRaw) ? stepRaw : "temel";
  const base = wizardBase(actor.role, campaignId);
  const back = prevStep(step);
  const backHref = back ? `${base}?adim=${back}` : "";
  const { campaign: c, checks, ready, plan } = await draftStatus(campaignId);
  const done = new Set(checks.filter((x) => x.ok && (x.key !== "medya" || c._count.assets > 0) && (x.key !== "influencer" || c.shortlistInfluencerIds.length > 0)).map((x) => x.key));
  if (ready) done.add("ozet");
  const meta = WIZARD_STEPS.find((s) => s.key === step)!;
  const idx = WIZARD_STEPS.findIndex((s) => s.key === step);
  const brand = await prisma.brand.findUniqueOrThrow({ where: { id: c.brandId }, select: { name: true } });

  let body: React.ReactNode = null;
  if (step === "temel") {
    body = <BasicsStep id={c.id} values={{ name: c.name, objective: c.objective, description: c.description, brandId: c.brandId }} />;
  } else if (step === "kitle") {
    body = (
      <AudienceStep
        id={c.id}
        backHref={backHref}
        values={{ targetCountries: c.targetCountries, platforms: c.platforms, audienceAgeMin: c.audienceAgeMin, audienceAgeMax: c.audienceAgeMax, audienceGender: c.audienceGender, audienceInterests: c.audienceInterests }}
      />
    );
  } else if (step === "butce") {
    body = (
      <ScheduleStep
        id={c.id}
        backHref={backHref}
        isAdmin={!isBrand}
        values={{ startsAt: localDay(c.startsAt, AGENCY_TZ), endsAt: localDay(c.endsAt, AGENCY_TZ), brandTotalFee: tl(c.brandTotalFeeKurus), budget: tl(c.budgetKurus), currency: c.currency }}
      />
    );
  } else if (step === "icerik") {
    body = <ContentPlanStep id={c.id} backHref={backHref} plan={plan} platforms={c.platforms} />;
  } else if (step === "brief") {
    const b = await prisma.campaignBrief.findFirst({ where: { campaignId: c.id }, orderBy: { version: "desc" } });
    body = <BriefStep id={c.id} backHref={backHref} advertiser={brand.name} latest={b ? { text: b.text, dos: b.dos, donts: b.donts, hashtags: b.hashtags, mentions: b.mentions, disclosureRequired: b.disclosureRequired, version: b.version } : null} />;
  } else if (step === "medya") {
    const assets = await prisma.asset.findMany({ where: { campaignId: c.id, uploadStatus: "TAMAM" }, orderBy: { createdAt: "desc" }, include: { uploadedBy: { select: { name: true } } } });
    body = (
      <MediaStep
        id={c.id}
        backHref={backHref}
        gallery={
          <CampaignMedia
            items={assets.map((a) => ({ id: a.id, fileName: a.fileName, mime: a.mime, kind: a.kind, size: a.size, uploadedById: a.uploadedById, uploadedByName: a.uploadedBy.name }))}
            canDelete={(m) => !isBrand || m.uploadedById === actor.userId}
          />
        }
      />
    );
  } else if (step === "influencer") {
    const rows = await prisma.influencer.findMany({
      // Ülke ayrımı: yalnız kampanyanın hedef ülkelerinde kayıtlı influencerlar.
      where: { ...(isBrand ? { showcaseVisible: true } : {}), ...(c.targetCountries.length ? { country: { in: c.targetCountries } } : {}) },
      orderBy: { name: "asc" },
      take: 500,
      select: { id: true, name: true, category: true, city: true, country: true, avatarKey: true, socialAccounts: { select: { platform: true, followers: true, avatarUrl: true } } },
    });
    const list: WizardInfluencer[] = rows.map((i) => ({
      id: i.id,
      name: i.name,
      category: i.category,
      city: [i.city, countryLabel(i.country)].filter(Boolean).join(", "),
      avatarUrl: pickAvatar(i.socialAccounts, i.avatarKey),
      platforms: [...new Set(i.socialAccounts.map((s) => s.platform))],
      followers: i.socialAccounts.reduce((s, a) => s + a.followers, 0),
    }));
    body = (
      <InfluencerStep
        id={c.id}
        backHref={backHref}
        influencers={list}
        selected={c.shortlistInfluencerIds}
        note={
          isBrand
            ? `${c.targetCountries.map((x) => countryLabel(x)).join(", ")} kayıtlı influencerlar listelenir. Çalışmak istediğiniz influencerları toplu seçin; ajans uygunluk ve bedelleri kontrol edip tek seferde atar. Boş bırakırsanız ajans önerir.`
            : "Kısa liste: kurulumdaki toplu atama ekranında bu kişiler önceden seçili gelir."
        }
      />
    );
  } else {
    body = (
      <SubmitStep
        id={c.id}
        backHref={backHref}
        checks={checks}
        ready={ready}
        isBrand={isBrand}
        submittedAt={c.submittedAt ? fmtDateTime(c.submittedAt, AGENCY_TZ) : null}
        base={base}
      />
    );
  }
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <PageHeader
        title={c.name}
        description={`${isBrand ? "" : `${brand.name} · `}Taslak${c.submittedAt ? " · ajansa gönderildi" : ""}. Her adımın altındaki “Kaydet ve devam” bilgileri kaydeder.`}
      />
      <Steps base={base} active={step} done={done} />
      <Card interactive={false} className="flex flex-col gap-2">
        <div className="flex flex-col gap-1">
          <h2 className="text-section">
            {idx + 1}. {meta.title}
          </h2>
          <p className="text-[13px] text-fg-muted">{meta.hint}</p>
        </div>
        {body}
      </Card>
    </div>
  );
}
