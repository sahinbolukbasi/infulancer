import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@infulancer/core/db";
import { parseTargets } from "@infulancer/core/domain/campaign-score";
import { campaignSetup, type SetupStepKey } from "@infulancer/core/domain/campaign-setup";
import { contentTypeLabels, formatKurus, platformLabels } from "@infulancer/core/domain/labels";
import { SetupSteps } from "@/components/campaign/setup-steps";
import { RecommendButton } from "@/components/forms/agent-job-forms";
import { AssignmentForm } from "@/components/forms/assignment-form";
import { InfluencerPicker } from "@/components/campaign/influencer-picker";
import { pickerPool, toPickerInfluencers } from "@/lib/campaign-picker";
import { BriefForm } from "@/components/forms/brief-form";
import { CampaignForm } from "@/components/forms/campaign-form";
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
const tl = (k: number) => (k / 100).toFixed(2);

export default async function CampaignSetupPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ adim?: string }> }) {
  await requireActor("ADMIN");
  const { id } = await params;
  const { adim } = await searchParams;
  const setup = await campaignSetup(id);
  if (!setup) notFound();
  const firstOpen = setup.steps.find((s) => !s.done)?.key ?? "yayin";
  const active: SetupStepKey = STEP_KEYS.includes(adim as SetupStepKey) ? (adim as SetupStepKey) : firstOpen;
  const idx = STEP_KEYS.indexOf(active);
  const next = STEP_KEYS[idx + 1];
  const prev = STEP_KEYS[idx - 1];
  const step = setup.steps.find((s) => s.key === active)!;

  const [c, brands, pool, brief, suggestions] = await Promise.all([
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
    prisma.brand.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    pickerPool(id),
    prisma.campaignBrief.findFirst({ where: { campaignId: id }, orderBy: { version: "desc" } }),
    prisma.agentRun.findFirst({ where: { checkType: "INFLUENCER_ONERI", targetType: "Campaign", targetId: id }, orderBy: { createdAt: "desc" } }),
  ]);
  const editable = c.status === "TASLAK" || c.status === "AKTIF";
  const recs = (suggestions?.findings as { recommendations?: { influencerId: string; name: string; score: number; rationale: string }[] } | null)?.recommendations ?? [];
  const picker = toPickerInfluencers(pool, c.brand.id, new Map(recs.map((r) => [r.influencerId, r.rationale])));

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title={`${c.name} · kurulum`}
        description={`${setup.completed}/${setup.steps.length} adım tamam. Her adım kampanya sayfasındaki aynı bilgileri düzenler.`}
        actions={
          <ButtonLink href={`/admin/kampanyalar/${id}`} variant="secondary">
            Kampanya sayfası
          </ButtonLink>
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

        {active === "bilgiler" || active === "hedefler" ? (
          <CampaignForm
            brands={brands}
            returnTo={`/admin/kampanyalar/${id}/kurulum?adim=${active === "bilgiler" ? "hedefler" : "influencerlar"}`}
            campaign={{
              id: c.id,
              brandId: c.brandId,
              name: c.name,
              slug: c.slug,
              budget: tl(Number(c.budgetKurus)),
              brandTotalFee: tl(Number(c.brandTotalFeeKurus)),
              startsAt: localDay(c.startsAt, AGENCY_TZ),
              endsAt: localDay(c.endsAt, AGENCY_TZ),
              status: c.status,
              targets: parseTargets(c.targets),
            }}
          />
        ) : null}

        {active === "influencerlar" ? (
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <h3 className="text-sm text-fg">Kampanyadaki influencerlar ({c.assignments.length})</h3>
              {c.assignments.length ? (
                <ul className="flex flex-wrap gap-2">
                  {c.assignments.map((a) => (
                    <li key={a.id} className="flex items-center gap-2 rounded-full border border-border py-1 pr-3 pl-3 text-[13px]">
                      <Link href={`/admin/influencerlar/${a.influencer.id}`} className="hover:underline">
                        {a.influencer.name}
                      </Link>
                      <span className="tabular-nums text-fg-muted">{formatKurus(a.feeKurus)}</span>
                      <StatusDot tone={contractTone(a.contractStatus)}>{contractUiLabels[a.contractStatus]}</StatusDot>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[13px] text-fg-passive">Henüz influencer yok. Aşağıdan kategoriye göre toplu seçip tek seferde ekleyin.</p>
              )}
            </div>
            {editable ? (
              <>
                <div className="flex flex-col gap-4 rounded-[8px] border border-border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex flex-col gap-1">
                      <h3 className="text-sm text-fg">Influencer seç ve ekle</h3>
                      <p className="text-[13px] text-fg-muted">Kategori seçip “Tümünü seç” ile toplu işaretleyin, bedeli hepsine birden uygulayın. Eklenen herkese teklif gider; rakip markayla çakışanlar otomatik engellenir.</p>
                    </div>
                    <RecommendButton campaignId={id} />
                  </div>
                  <InfluencerPicker campaignId={id} influencers={picker} />
                </div>
                <details className="rounded-[8px] border border-border">
                  <summary className="cursor-pointer px-4 py-3 text-sm text-fg-muted hover:text-fg">Tekli atama (kupon, münhasırlık veya çakışma gerekçesiyle)</summary>
                  <div className="border-t border-border p-4">
                    <AssignmentForm campaignId={id} influencers={pool.map((i) => ({ id: i.id, name: i.name, category: i.category }))} />
                  </div>
                </details>
              </>
            ) : null}
          </div>
        ) : null}
        {active === "icerik" ? (
          c.assignments.length === 0 ? (
            <InfoNote>Önce influencer atayın; içerik planı influencer başına yapılır.</InfoNote>
          ) : (
            <div className="flex flex-col gap-6">
              {c.assignments.map((a) => {
                const tz = a.influencer.audienceTimezone;
                return (
                  <div key={a.id} className="flex flex-col gap-3 rounded-[8px] border border-border p-4">
                    <h3 className="text-sm text-fg">{a.influencer.name}</h3>
                    {a.deliverables.length ? (
                      <ul className="flex flex-col divide-y divide-border text-sm">
                        {a.deliverables.map((d) => (
                          <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 py-2">
                            <Link href={`/admin/teslimler/${d.id}`} className="inline-flex items-center gap-2 hover:underline">
                              <PlatformIcon platform={d.platform} size={14} title={platformLabels[d.platform]} />
                              {contentTypeLabels[d.contentType]}
                              {d.contentType === "STORY" ? ` · ${d.frameCount} kare` : ""}
                            </Link>
                            <span className="text-[13px] tabular-nums text-fg-muted">{fmtDateTime(d.plannedAt, tz)}</span>
                            <span className="text-[12px] text-fg-passive">
                              {d.usageRightsDays != null ? `Kullanım hakkı ${d.usageRightsDays} gün · ${d.usageRightsChannel === "PAID_DAHIL" ? "paid dahil" : "organik"} · ${d.usageRightsGeo.join(", ")}` : "Kullanım hakkı eksik"}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-[13px] text-fg-passive">Bu influencer için içerik yok.</p>
                    )}
                    {editable && a.contractStatus !== "RED" ? (
                      <details className="rounded-[8px] border border-border" open={a.deliverables.length === 0}>
                        <summary className="cursor-pointer px-4 py-3 text-sm text-fg-muted hover:text-fg">İçerik ekle (post, reels, story…)</summary>
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

        {active === "brief" ? <BriefForm campaignId={id} latest={brief ?? undefined} nextVersion={(brief?.version ?? 0) + 1} /> : null}

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
                <h3 className="text-sm text-fg">md. 23/A ve kullanım hakkı sorunları</h3>
                <ul className="flex list-disc flex-col gap-1 pl-5 text-[13px] text-fg-muted">
                  {step.issues.map((i) => (
                    <li key={i}>{i}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {c.status === "TASLAK" ? (
              setup.readyToActivate ? (
                <ActivateCampaignButton campaignId={id} />
              ) : (
                <InfoNote>Eksik adımlar tamamlanmadan kampanya yayına alınamaz. Etiketsiz içerikle yayın yasal olarak engellidir.</InfoNote>
              )
            ) : (
              <InfoNote>Kampanya {c.status === "AKTIF" ? "yayında" : "kapandı"}. Yeni içerik eklerseniz aynı kontroller içerik bazında uygulanır.</InfoNote>
            )}
          </div>
        ) : null}

        <div className="flex justify-between gap-3 border-t border-border pt-4">
          {prev ? (
            <ButtonLink href={`/admin/kampanyalar/${id}/kurulum?adim=${prev}`} variant="secondary" size="sm">
              ← Önceki adım
            </ButtonLink>
          ) : (
            <span />
          )}
          {next ? (
            <ButtonLink href={`/admin/kampanyalar/${id}/kurulum?adim=${next}`} size="sm">
              Sonraki adım →
            </ButtonLink>
          ) : null}
        </div>
      </Card>
    </div>
  );
}
