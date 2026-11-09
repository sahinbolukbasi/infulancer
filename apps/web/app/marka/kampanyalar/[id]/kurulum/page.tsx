import { getTT } from "@/lib/i18n/tt-server";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@infulancer/core/db";
import { campaignSetup, type SetupStepKey } from "@infulancer/core/domain/campaign-setup";
import { contentTypeLabels, formatKurus, platformLabels } from "@infulancer/core/domain/labels";
import { SetupSteps } from "@/components/campaign/setup-steps";
import { BulkPlanForm } from "@/components/campaign/bulk-plan-form";
import { CampaignMedia } from "@/components/campaign/campaign-media";
import { FileUploader } from "@/components/files/file-uploader";
import { countryName, OBJECTIVES, parseContentPlan, planTotal } from "@infulancer/core/domain/campaign-plan";
import { assetKindLabels } from "@infulancer/core/domain/labels";
import { InfluencerPicker } from "@/components/campaign/influencer-picker";
import { pickerPool, toPickerInfluencers } from "@/lib/campaign-picker";
import { BriefForm } from "@/components/forms/brief-form";
import { DeliverableForm } from "@/components/forms/deliverable-form";
import { ActivateCampaignButton } from "@/components/forms/small-forms";
import { PlatformIcon } from "@/components/platform-icon";
import { Card, CardTitle } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/form";
import { PageHeader } from "@/components/ui/layout";
import { StatusDot } from "@/components/ui/status";
import { InfoNote } from "@/components/ui/unverified";
import { requireActor } from "@/lib/auth-guard";
import { contractTone, contractUiLabels } from "@/lib/status-tone";
import { AGENCY_TZ, fmtDateTime, localDay, tzShort } from "@/lib/time";

export const metadata: Metadata = { title: "Kampanya kurulumu" };
export const dynamic = "force-dynamic";

const STEP_KEYS: SetupStepKey[] = ["bilgiler", "hedefler", "influencerlar", "icerik", "brief", "yayin"];
/** Toplu planın ilk günü: kampanya başlangıcı (geçmişteyse 3 gün sonrası). */
function defaultStartDay(startsAt: Date): string {
  const soon = new Date(Date.now() + 3 * 86_400_000);
  return localDay(startsAt > soon ? startsAt : soon, AGENCY_TZ);
}

export default async function CampaignSetupPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ adim?: string }> }) {
  const tt = await getTT();
  const actor = await requireActor("BRAND");
  const { id } = await params;
  const { adim } = await searchParams;
  // SELF modunda ve markanın kendi kampanyası olmalı; aksi halde kampanya sayfasına geri.
  const own = await prisma.campaign.findUnique({ where: { id }, select: { brandId: true, executionMode: true } });
  if (!own || own.brandId !== actor.brandId) notFound();
  if (own.executionMode !== "SELF") redirect(`/marka/kampanyalar/${id}`);
  const setup = await campaignSetup(id);
  if (!setup) notFound();
  const firstOpen = setup.steps.find((s) => !s.done)?.key ?? "yayin";
  const active: SetupStepKey = STEP_KEYS.includes(adim as SetupStepKey) ? (adim as SetupStepKey) : firstOpen;
  const idx = STEP_KEYS.indexOf(active);
  const next = STEP_KEYS[idx + 1];
  const prev = STEP_KEYS[idx - 1];
  const step = setup.steps.find((s) => s.key === active)!;

  const [c, pool, brief, suggestions] = await Promise.all([
    prisma.campaign.findUniqueOrThrow({
      where: { id },
      include: {
        brand: { select: { id: true, name: true } },
        assignments: {
          orderBy: { createdAt: "asc" },
          include: {
            influencer: { select: { id: true, name: true, audienceTimezone: true } },
            deliverables: { where: { status: { not: "IPTAL" } }, orderBy: { plannedAt: "asc" } },
          },
        },
      },
    }),
    pickerPool(id),
    prisma.campaignBrief.findFirst({ where: { campaignId: id }, orderBy: { version: "desc" } }),
    prisma.agentRun.findFirst({ where: { checkType: "INFLUENCER_ONERI", targetType: "Campaign", targetId: id }, orderBy: { createdAt: "desc" } }),
  ]);
  const editable = c.status === "TASLAK" || c.status === "AKTIF";
  const plan = parseContentPlan(c.contentPlan);
  const [media, shortlist] = await Promise.all([
    prisma.asset.findMany({ where: { campaignId: id, uploadStatus: "TAMAM" }, orderBy: { createdAt: "desc" }, include: { uploadedBy: { select: { name: true } } } }),
    c.shortlistInfluencerIds.length ? prisma.influencer.findMany({ where: { id: { in: c.shortlistInfluencerIds } }, select: { id: true, name: true } }) : Promise.resolve([]),
  ]);
  const brandRequest = (
    <div className="flex flex-col gap-3 rounded-[8px] border border-border p-4 text-[13px]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm text-fg">{c.submittedAt ? tt("Markanın kampanya talebi") : tt("Kampanya özeti")}</h3>
        <Link href={`/marka/kampanyalar/${id}/olustur?adim=ozet`} className="text-[12px] text-fg-muted underline-offset-4 hover:text-fg hover:underline">{" "}{tt("Sihirbazda düzenle")}</Link>
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
        <dt className="text-fg-passive">{tt("Amaç")}</dt>
        <dd>{OBJECTIVES.find((o) => o.id === c.objective)?.title ?? "—"}</dd>
        <dt className="text-fg-passive">{tt("Ülkeler")}</dt>
        <dd>{c.targetCountries.length ? c.targetCountries.map(countryName).join(", ") : "—"}</dd>
        <dt className="text-fg-passive">{tt("Platformlar")}</dt>
        <dd>{c.platforms.length ? c.platforms.map((p) => platformLabels[p]).join(", ") : "—"}</dd>
        <dt className="text-fg-passive">{tt("Kitle")}</dt>
        <dd>
          {c.audienceAgeMin ?? "?"}–{c.audienceAgeMax ?? "?"}{" "}{tt("yaş")}{c.audienceInterests.length ? ` · ${c.audienceInterests.join(", ")}` : ""}
        </dd>
        <dt className="text-fg-passive">{tt("İçerik planı")}</dt>
        <dd>{plan.length ? `${plan.map((p) => `${p.count}× ${contentTypeLabels[p.contentType]} (${platformLabels[p.platform]})`).join(", ")} · kişi başı ${planTotal(plan)}` : "—"}</dd>
        <dt className="text-fg-passive">{tt("Önerilen influencer")}</dt>
        <dd>{shortlist.length ? shortlist.map((s) => s.name).join(", ") : "—"}</dd>
      </dl>
      {c.description ? <p className="text-fg-muted whitespace-pre-line">{c.description}</p> : null}
    </div>
  );
  const mediaBlock = (
    <div className="flex flex-col gap-3 border-t border-border pt-5">
      <h3 className="text-sm text-fg">{tt("Kampanya fotoğraf ve videoları (")}{media.length})</h3>
      <CampaignMedia items={media.map((a) => ({ id: a.id, fileName: a.fileName, mime: a.mime, kind: a.kind, size: a.size, uploadedById: a.uploadedById, uploadedByName: a.uploadedBy.name }))} canDelete={() => c.status !== "KAPANDI"} />
      {editable ? (
        <FileUploader
          target={{ type: "campaign", id }}
          multiple
          label={tt("Fotoğraf veya video ekle")}
          accept="image/*,video/*,application/pdf"
          kinds={(["URUN_FOTO", "ORNEK_CEKIM", "MARKA_LOGO", "BRIEF_PDF", "ONAYLI_CAPTION", "DIGER"] as const).map((k) => ({ value: k, label: assetKindLabels[k] }))}
        />
      ) : null}
    </div>
  );
  const recs = (suggestions?.findings as { recommendations?: { influencerId: string; name: string; score: number; rationale: string }[] } | null)?.recommendations ?? [];
  const picker = toPickerInfluencers(pool, c.brand.id, new Map(recs.map((r) => [r.influencerId, r.rationale])));

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title={`${c.name} · kurulum`}
        description={`${setup.completed}/${setup.steps.length} adım tamam. Her adım kampanya sayfasındaki aynı bilgileri düzenler.`}
        actions={
          <ButtonLink href={`/marka/kampanyalar/${id}`} variant="secondary">{" "}{tt("Kampanya sayfası")}</ButtonLink>
        }
      />
      <SetupSteps campaignId={id} steps={setup.steps} active={active} />

      <Card interactive={false} className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle>
            {idx + 1}. {step.title}
          </CardTitle>
          <StatusDot tone={step.done ? "active" : step.issues.length ? "critical" : "muted"}>{step.summary}</StatusDot>
        </div>
        {step.issues.length && active !== "yayin" ? (
          <ul className="flex list-disc flex-col gap-1 pl-5 text-[13px] text-fg-muted">
            {step.issues.map((i) => (
              <li key={i}>{i}</li>
            ))}
          </ul>
        ) : null}

        {active === "bilgiler" ? brandRequest : null}
        {active === "bilgiler" || active === "hedefler" ? (
          <div className="flex flex-col gap-3 rounded-[8px] border border-border p-4 text-[13px]">
            <p className="text-fg-muted">{tt("Kampanya bilgileri, bütçe, hedef kitle ve KPI hedeflerini oluşturma sihirbazından düzenleyin.")}</p>
            <ButtonLink href={`/marka/kampanyalar/${id}/olustur?adim=ozet`} variant="secondary" size="sm">{tt("Sihirbazda düzenle")}</ButtonLink>
          </div>
        ) : null}

        {active === "influencerlar" ? (
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <h3 className="text-sm text-fg">{tt("Kampanyadaki influencerlar (")}{c.assignments.length})</h3>
              {c.assignments.length ? (
                <ul className="flex flex-wrap gap-2">
                  {c.assignments.map((a) => (
                    <li key={a.id} className="flex items-center gap-2 rounded-full border border-border py-1 pr-3 pl-3 text-[13px]">
                      <span>{a.influencer.name}</span>
                      <span className="tabular-nums text-fg-muted">{formatKurus(a.feeKurus)}</span>
                      <StatusDot tone={contractTone(a.contractStatus)}>{contractUiLabels[a.contractStatus]}</StatusDot>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[13px] text-fg-passive">{tt("Henüz influencer yok. Aşağıdan kategoriye göre toplu seçip tek seferde ekleyin.")}</p>
              )}
            </div>
            {editable ? (
              <>
                <div className="flex flex-col gap-4 rounded-[8px] border border-border p-4">
                  <div className="flex flex-col gap-1">
                    <h3 className="text-sm text-fg">{tt("Influencer seç ve ekle")}</h3>
                    <p className="text-[13px] text-fg-muted">{tt("Kategoriye göre süzün, “Tümünü seç” ile toplu işaretleyin, bedeli hepsine birden uygulayın. Eklediğiniz herkese teklif gider; rakip markayla çakışanlar otomatik engellenir.")}</p>
                  </div>
                  <InfluencerPicker campaignId={id} influencers={picker} preselected={c.shortlistInfluencerIds} hideCommission />
                </div>
              </>
            ) : null}
          </div>
        ) : null}
        {active === "icerik" ? (
          c.assignments.length === 0 ? (
            <InfoNote>{tt("Önce influencer atayın; içerik planı influencer başına yapılır.")}</InfoNote>
          ) : (
            <div className="flex flex-col gap-6">
              {editable ? (
                <div className="flex flex-col gap-4 rounded-[8px] border border-fg/30 p-4">
                  <div className="flex flex-col gap-1">
                    <h3 className="text-sm text-fg">{tt("Toplu içerik planı")}</h3>
                    <p className="text-[13px] text-fg-muted">{tt("Aynı planı seçilen tüm influencerlara tek seferde uygulayın. Saatler her kişinin kitle saat diliminde yorumlanır; sonra iş bazında düzenleyebilirsiniz.")}</p>
                  </div>
                  <BulkPlanForm
                    campaignId={id}
                    assignments={c.assignments.filter((a) => a.contractStatus !== "RED").map((a) => ({ id: a.id, name: a.influencer.name, tz: a.influencer.audienceTimezone, deliverables: a.deliverables.length }))}
                    plan={plan}
                    platforms={c.platforms}
                    defaults={{
                      hashtags: brief?.hashtags ?? [],
                      mentions: brief?.mentions ?? [],
                      geo: c.targetCountries,
                      startDay: defaultStartDay(c.startsAt),
                      disclosureRequired: brief?.disclosureRequired ?? true,
                    }}
                  />
                </div>
              ) : null}
              <h3 className="text-sm text-fg-muted">{tt("Kişi bazında içerikler")}</h3>
              {c.assignments.map((a) => {
                const tz = a.influencer.audienceTimezone;
                return (
                  <div key={a.id} className="flex flex-col gap-3 rounded-[8px] border border-border p-4">
                    <h3 className="text-sm text-fg">{a.influencer.name}</h3>
                    {a.deliverables.length ? (
                      <ul className="flex flex-col divide-y divide-border text-sm">
                        {a.deliverables.map((d) => (
                          <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 py-2">
                            <span className="inline-flex items-center gap-2">
                              <PlatformIcon platform={d.platform} size={14} title={platformLabels[d.platform]} />
                              {contentTypeLabels[d.contentType]}
                              {d.contentType === "STORY" ? ` · ${d.frameCount} kare` : ""}
                            </span>
                            <span className="text-[13px] tabular-nums text-fg-muted">{fmtDateTime(d.plannedAt, tz)}</span>
                            <span className="text-[12px] text-fg-passive">
                              {d.usageRightsDays != null ? `Kullanım hakkı ${d.usageRightsDays} gün · ${d.usageRightsChannel === "PAID_DAHIL" ? "paid dahil" : "organik"} · ${d.usageRightsGeo.join(", ")}` : tt("Kullanım hakkı eksik")}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-[13px] text-fg-passive">{tt("Bu influencer için içerik yok.")}</p>
                    )}
                    {editable && a.contractStatus !== "RED" ? (
                      <details className="rounded-[8px] border border-border" open={a.deliverables.length === 0}>
                        <summary className="cursor-pointer px-4 py-3 text-sm text-fg-muted hover:text-fg">{tt("İçerik ekle (post, reels, story…)")}</summary>
                        <div className="border-t border-border p-4">
                          <DeliverableForm
                            assignmentId={a.id}
                            tz={tz}
                            tzLabel={tz === AGENCY_TZ ? "İstanbul" : `${tz}, ${tzShort(tz)}`}
                            defaults={{ hashtags: brief?.hashtags ?? [], mentions: brief?.mentions ?? [], disclosureRequired: brief?.disclosureRequired ?? true, advertiser: c.brand.name }}
                          />
                        </div>
                      </details>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )
        ) : null}

        {active === "brief" ? (
          <>
            <BriefForm campaignId={id} latest={brief ?? undefined} nextVersion={(brief?.version ?? 0) + 1} />
            {mediaBlock}
          </>
        ) : null}

        {active === "yayin" ? (
          <div className="flex flex-col gap-4">
            <ul className="flex flex-col gap-2 text-sm">
              {setup.steps
                .filter((s) => s.key !== "yayin")
                .map((s) => (
                  <li key={s.key}>
                    <StatusDot tone={s.done ? "active" : "critical"}>
                      {s.title}: {s.summary}
                    </StatusDot>
                  </li>
                ))}
            </ul>
            {step.issues.length ? (
              <div className="flex flex-col gap-2">
                <h3 className="text-sm text-fg">{tt("md. 23/A ve kullanım hakkı sorunları")}</h3>
                <ul className="flex list-disc flex-col gap-1 pl-5 text-[13px] text-fg-muted">
                  {step.issues.map((i) => (
                    <li key={i}>{i}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {c.status === "TASLAK" ? (
              <div className="flex flex-col gap-3 rounded-[8px] border border-border p-4">
                <p className="text-[13px] text-fg-muted">{tt("Tüm adımlar girildiği anda kaydedildi. Kampanyayı taslak olarak bırakabilir ya da kontroller tamamsa yayına alabilirsiniz.")}</p>
                {!setup.readyToActivate ? (
                  <InfoNote>{tt("Eksik adımlar tamamlanmadan kampanya yayına alınamaz. Etiketsiz içerikle yayın yasal olarak engellidir.")}</InfoNote>
                ) : null}
                <div className="flex flex-wrap items-center gap-3">
                  {setup.readyToActivate ? <ActivateCampaignButton campaignId={id} /> : null}
                  <ButtonLink href={`/marka/kampanyalar/${id}?kaydedildi=1`} variant={setup.readyToActivate ? "secondary" : "primary"}>{" "}{tt("Taslak olarak kaydet ve çık")}</ButtonLink>
                </div>
              </div>
            ) : (
              <InfoNote>{tt("Kampanya")}{" "}{c.status === "AKTIF" ? tt("yayında") : tt("kapandı")}{tt(". Yeni içerik eklerseniz aynı kontroller içerik bazında uygulanır.")}</InfoNote>
            )}
          </div>
        ) : null}

        <div className="flex justify-between gap-3 border-t border-border pt-4">
          {prev ? (
            <ButtonLink href={`/marka/kampanyalar/${id}/kurulum?adim=${prev}`} variant="secondary" size="sm">{" "}{tt("← Önceki adım")}</ButtonLink>
          ) : (
            <span />
          )}
          {next ? (
            <ButtonLink href={`/marka/kampanyalar/${id}/kurulum?adim=${next}`} size="sm">{" "}{tt("Sonraki adım →")}</ButtonLink>
          ) : null}
        </div>
      </Card>
    </div>
  );
}
