import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { toInfluencerAssignmentView } from "@infulancer/core/access/dto";
import { assertDeliverableAccess } from "@infulancer/core/access/ownership";
import { prisma } from "@infulancer/core/db";
import { allowedTargets } from "@infulancer/core/domain/deliverable-status";
import {
  contentTypeLabels,
  deliverableStatusLabels,
  metricSourceLabels,
  metricStageLabels,
  platformLabels,
  trustLevelLabels,
  metricSourceTrust,
} from "@infulancer/core/domain/labels";
import { isStory, platformRules } from "@infulancer/core/domain/platform-rules";
import { BriefPanel } from "@/components/brief-panel";
import { AssetList } from "@/components/files/asset-list";
import { FileUploader } from "@/components/files/file-uploader";
import { ContractDecision, TransitionPanel } from "@/components/forms/small-forms";
import { ChevronLeftIcon } from "@/components/icons";
import { MetricEntryForm } from "@/components/metrics/metric-entry-form";
import { PlatformIcon } from "@/components/platform-icon";
import { Card, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/layout";
import { StatusDot } from "@/components/ui/status";
import { requireActor } from "@/lib/auth-guard";
import { PostUrlForm } from "@/components/forms/post-url-form";
import { isOverdue } from "@/lib/calendar";
import { num } from "@/lib/format";
import { deliverableTone } from "@/lib/status-tone";
import { AGENCY_TZ, fmtDateTime, tzShort } from "@/lib/time";

export const metadata: Metadata = { title: "İş detayı" };

export default async function InfluencerJobPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requireActor("INFLUENCER");
  const { id } = await params;
  // Başka influencer'ın işi (veya olmayan iş) → 404.
  try {
    await assertDeliverableAccess(prisma, actor, id);
  } catch {
    notFound();
  }
  const row = await prisma.deliverable.findUnique({
    where: { id },
    include: {
      assignment: {
        include: {
          influencer: { select: { audienceTimezone: true } },
          campaign: {
            include: {
              brand: { select: { name: true } },
              briefs: { orderBy: { version: "desc" }, take: 1 },
              assets: { where: { uploadStatus: "TAMAM", direction: "AJANS_TO_INFLUENCER" }, orderBy: { createdAt: "desc" } },
            },
          },
        },
      },
      assets: { where: { uploadStatus: "TAMAM" }, orderBy: { createdAt: "desc" } },
      statusChanges: { where: { to: "REVIZYON" }, orderBy: { at: "desc" } },
      metricSnapshots: { where: { source: { not: "MARKA" } }, orderBy: { measuredAt: "desc" } },
    },
  });
  if (!row || row.assignment.influencerId !== actor.influencerId) notFound();

  const { assignment } = row;
  // Ekrana giden kampanya/iş verisi DTO'dan (bütçe, komisyon, marka bedeli yok).
  const view = toInfluencerAssignmentView({ ...assignment, deliverables: [row] });
  const d = view.deliverables[0]!;
  const campaign = view.campaign;
  const brief = assignment.campaign.briefs[0];
  const tz = assignment.influencer.audienceTimezone;
  const tzLabel = tz === AGENCY_TZ ? "İstanbul" : `${tz}, ${tzShort(tz)}`;
  const rule = platformRules[d.platform];
  const story = isStory(d);
  const rejected = view.contractStatus === "RED";
  const closed = d.status === "IPTAL" || d.status === "TAMAMLANDI" || rejected;
  const published = ["YAYINLANDI", "METRIK_BEKLIYOR", "TAMAMLANDI"].includes(d.status) && !!d.publishedAt;
  const targets = allowedTargets("INFLUENCER", d.status)
    .filter((t) => t === "YAYINLANDI")
    .map((t) => ({ value: t, label: "Yayınlandı olarak işaretle", backward: false }));
  const agencyFiles = [...assignment.campaign.assets, ...row.assets.filter((a) => a.direction === "AJANS_TO_INFLUENCER")];
  const myFiles = row.assets.filter((a) => a.direction === "INFLUENCER_TO_AJANS");
  const usedShots = new Set(row.metricSnapshots.map((m) => m.screenshotAssetId).filter(Boolean));
  const freeShots = myFiles.filter((a) => a.kind === "METRIK_SS" && !usedShots.has(a.id)).map((a) => ({ id: a.id, fileName: a.fileName }));
  const canUploadDraft = !closed && view.contractStatus === "KABUL" && ["BRIEF_GONDERILDI", "REVIZYON", "ICERIK_YUKLENDI", "ONAYLANDI", "ATANDI"].includes(d.status);
  const overdue = isOverdue(d);

  return (
    <div className="flex flex-col gap-6">
      <Link href="/influencer" className="inline-flex items-center gap-1 text-[13px] text-fg-muted hover:text-fg">
        <ChevronLeftIcon size={14} /> İşlerim
      </Link>
      <PageHeader
        title={`${platformLabels[d.platform]} ${contentTypeLabels[d.contentType]}`}
        description={
          <span className="inline-flex flex-wrap items-center gap-3">
            <StatusDot tone={deliverableTone(d.status, { overdue, violation: d.contractViolation })}>
              {deliverableStatusLabels[d.status]}
              {overdue ? " · gecikti" : ""}
            </StatusDot>
            <span>
              {campaign.name} · {campaign.brandName}
            </span>
          </span>
        }
      />

      {view.contractStatus === "TEKLIF" ? (
        <Card interactive={false} className="flex flex-col gap-3">
          <CardTitle>Sözleşme teklifi</CardTitle>
          <p className="text-sm text-fg-muted">Brief&apos;i inceleyip teklifi kabul ya da reddedin. Red durumunda işler iptal edilir.</p>
          <ContractDecision assignmentId={view.id} />
        </Card>
      ) : null}
      {rejected ? (
        <Card interactive={false}>
          <p className="text-sm text-fg-muted">Bu teklifi reddettiniz; iş iptal edildi.</p>
        </Card>
      ) : null}
      {d.contractViolation ? (
        <Card interactive={false} className="border-critical/40">
          <p className="text-sm text-critical">Paylaşım erişilemiyor: sözleşme ihlali olarak işaretlendi. Ajansla iletişime geçin.</p>
        </Card>
      ) : null}

      <div className="grid-12">
        <Card interactive={false} className="flex flex-col gap-4 md:col-span-7">
          <CardTitle>Plan</CardTitle>
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
            <dt className="text-fg-passive">Paylaşım</dt>
            <dd className="tabular-nums">
              {fmtDateTime(d.plannedAt, tz)} <span className="text-fg-muted">({tzLabel})</span>
            </dd>
            <dt className="text-fg-passive">Taslak son tarihi</dt>
            <dd className="tabular-nums">{fmtDateTime(d.approvalDeadline, tz)}</dd>
            <dt className="text-fg-passive">Caption</dt>
            <dd className="whitespace-pre-line">{d.caption || "—"}</dd>
            <dt className="text-fg-passive">Etiketler</dt>
            <dd>{[...d.hashtags, ...d.mentions].join(" ") || "—"}</dd>
            <dt className="text-fg-passive">Bağlantı</dt>
            <dd className="font-mono text-[12px] break-all text-fg-muted">{d.link ?? "—"}</dd>
            <dt className="text-fg-passive">Reklam ibaresi</dt>
            <dd>{d.disclosureRequired ? `Zorunlu — ${rule.disclosureLabel}` : "Zorunlu değil"}</dd>
            {view.couponCode ? (
              <>
                <dt className="text-fg-passive">Kupon</dt>
                <dd className="font-mono">{view.couponCode}</dd>
              </>
            ) : null}
            {d.postUrl || published ? (
              <>
                <dt className="text-fg-passive">Paylaşım</dt>
                <dd>
                  <PostUrlForm deliverableId={d.id} current={d.postUrl} editable={published} />
                </dd>
              </>
            ) : null}
          </dl>
        </Card>
        <Card interactive={false} className="flex flex-col gap-3 md:col-span-5">
          <CardTitle className="flex items-center gap-2">
            <PlatformIcon platform={d.platform} size={18} /> Platform kuralları
          </CardTitle>
          <ul className="flex flex-col gap-2 text-[13px] text-fg-muted">
            <li>Format: {rule.formatConstraints.join(" · ")}</li>
            <li>Link yeri: {rule.linkPlacement}</li>
            <li className="text-fg">{rule.criticalConstraint}</li>
            {story ? <li className="text-fg">Story: yayından sonra 24 saat dolmadan istatistik ekran görüntüsünü yükleyin.</li> : null}
            {d.platform === "TIKTOK" ? <li className="text-fg">TikTok: ham video dosyasını arşiv için yükleyin.</li> : null}
          </ul>
        </Card>
      </div>

      {row.statusChanges.length > 0 ? (
        <Card interactive={false} className="flex flex-col gap-3">
          <CardTitle>Revizyon notları</CardTitle>
          <ul className="flex flex-col gap-3">
            {row.statusChanges.map((s) => (
              <li key={s.id} className="flex flex-col gap-0.5 border-l border-border pl-4">
                <span className="text-sm">{s.note ?? "Revizyon istendi"}</span>
                <span className="text-[12px] text-fg-passive">{fmtDateTime(s.at, tz)}</span>
              </li>
            ))}
          </ul>
          <p className="text-[12px] text-fg-passive">Revizyon paylaşım zamanını değiştirmez.</p>
        </Card>
      ) : null}

      <Card interactive={false} className="flex flex-col gap-4">
        <CardTitle>Brief</CardTitle>
        {brief ? <BriefPanel brief={brief} disclosureLabel={rule.disclosureLabel} /> : <p className="text-sm text-fg-passive">Brief henüz paylaşılmadı.</p>}
      </Card>

      <div className="grid-12">
        <Card interactive={false} className="flex flex-col gap-4 md:col-span-6">
          <CardTitle>Ajans dosyaları</CardTitle>
          <AssetList assets={agencyFiles} emptyText="Ajans henüz dosya paylaşmadı." />
        </Card>
        <Card interactive={false} className="flex flex-col gap-4 md:col-span-6">
          <CardTitle>Yüklediklerim</CardTitle>
          <AssetList assets={myFiles} emptyText="Henüz dosya yüklemediniz." />
          {canUploadDraft ? (
            <FileUploader
              target={{ type: "deliverable", id: d.id }}
              kinds={[
                { value: "TASLAK", label: "Taslak içerik (onaya gönderilir)" },
                { value: "HAM_DOSYA", label: "Ham dosya (arşiv)" },
              ]}
              label="Taslak veya ham dosya yükle"
            />
          ) : null}
        </Card>
      </div>

      {!closed && targets.length > 0 ? (
        <Card interactive={false} className="flex flex-col gap-4">
          <CardTitle>Yayın bağlantısı</CardTitle>
          <p className="text-[13px] text-fg-muted">İçerik onaylandı. Paylaştıktan sonra bağlantıyı girin.</p>
          <TransitionPanel deliverableId={d.id} targets={targets} role="INFLUENCER" currentPostUrl={d.postUrl} />
        </Card>
      ) : null}

      {published && !rejected ? (
        <Card interactive={false} className="flex flex-col gap-4">
          <CardTitle>Metrikler</CardTitle>
          {row.metricSnapshots.length > 0 ? (
            <ul className="flex flex-col divide-y divide-border text-sm">
              {row.metricSnapshots.map((m) => (
                <li key={m.id} className="flex flex-wrap justify-between gap-2 py-2">
                  <span>
                    {metricStageLabels[m.stage]} · {fmtDateTime(m.measuredAt, tz)}
                  </span>
                  <span className="text-fg-muted tabular-nums">
                    {m.reach != null ? `${num.format(m.reach)} erişim · ` : ""}
                    {metricSourceLabels[m.source]} ({trustLevelLabels[metricSourceTrust[m.source]]})
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-fg-muted">Henüz metrik girmediniz. 24. saat, 7. gün ve 30. gün ölçümlerini girin.</p>
          )}
          {d.status !== "TAMAMLANDI" ? (
            <MetricEntryForm deliverableId={d.id} platform={d.platform} isStory={story} role="INFLUENCER" tzLabel={tzLabel} screenshots={freeShots} />
          ) : null}
        </Card>
      ) : null}
    </div>
  );
}
