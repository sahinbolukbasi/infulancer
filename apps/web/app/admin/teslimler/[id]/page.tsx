import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { audit } from "@infulancer/core/audit";
import { prisma } from "@infulancer/core/db";
import { allowedTargets, isBackward } from "@infulancer/core/domain/deliverable-status";
import {
  contentTypeLabels,
  contractStatusLabels,
  deliverableStatusLabels,
  metricSourceLabels,
  metricSourceTrust,
  metricStageLabels,
  platformLabels,
  reviewDecisionLabels,
  trustLevelLabels,
} from "@infulancer/core/domain/labels";
import { isStory } from "@infulancer/core/domain/platform-rules";
import { AgentRunList } from "@/components/agent/agent-run-list";
import { AssetList } from "@/components/files/asset-list";
import { FileUploader } from "@/components/files/file-uploader";
import { DeliverableForm, PlatformRulePanel } from "@/components/forms/deliverable-form";
import { BrandDataForm, TransitionPanel } from "@/components/forms/small-forms";
import { ExternalIcon } from "@/components/icons";
import { MetricEntryForm } from "@/components/metrics/metric-entry-form";
import { PlatformIcon } from "@/components/platform-icon";
import { Card, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { ButtonLink } from "@/components/ui/form";
import { PageHeader } from "@/components/ui/layout";
import { StatusDot } from "@/components/ui/status";
import { requireActor } from "@/lib/auth-guard";
import { isOverdue } from "@/lib/calendar";
import { num, pct1 } from "@/lib/format";
import { deliverableTone } from "@/lib/status-tone";
import { stripUtm } from "@/lib/strip-utm";
import { AGENCY_TZ, fmtDateTime, toLocalInput, tzShort } from "@/lib/time";

export const metadata: Metadata = { title: "Teslim" };

const auditLabels: Record<string, string> = {
  DELIVERABLE_CREATED: "İş oluşturuldu",
  DELIVERABLE_UPDATED: "Plan güncellendi",
  DELIVERABLE_RESCHEDULED: "Yeniden planlandı",
  DELIVERABLE_STATUS: "Durum değişti",
  METRIC_SUBMITTED: "Metrik girildi",
  BRAND_DATA_SUBMITTED: "Marka verisi girildi",
  LEDGER_HAKEDIS: "Hakediş yazıldı",
};

function auditDetail(action: string, data: Record<string, unknown>, tz: string): string {
  if (action === "DELIVERABLE_STATUS") {
    const from = deliverableStatusLabels[data.from as keyof typeof deliverableStatusLabels] ?? String(data.from ?? "—");
    const to = deliverableStatusLabels[data.to as keyof typeof deliverableStatusLabels] ?? String(data.to ?? "");
    return `${from} → ${to}${data.note ? ` · ${String(data.note)}` : ""}`;
  }
  if (action === "DELIVERABLE_RESCHEDULED" && typeof data.to === "string") return `Yeni zaman: ${fmtDateTime(new Date(data.to), tz)}`;
  if (action === "METRIC_SUBMITTED") return `${metricSourceLabels[data.source as keyof typeof metricSourceLabels] ?? ""}`;
  return "";
}

export default async function DeliverableDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireActor("ADMIN");
  const { id } = await params;
  const d = await prisma.deliverable.findUnique({
    where: { id },
    include: {
      assignment: {
        include: {
          influencer: { select: { id: true, name: true, audienceTimezone: true } },
          campaign: { select: { id: true, name: true, briefs: { orderBy: { version: "desc" }, take: 1 } } },
        },
      },
      statusChanges: { orderBy: { at: "asc" }, include: { byUser: { select: { name: true } } } },
      assets: { where: { uploadStatus: "TAMAM" }, orderBy: { createdAt: "desc" }, include: { uploadedBy: { select: { name: true } } } },
      metricSnapshots: { orderBy: { measuredAt: "desc" }, include: { enteredBy: { select: { name: true } }, screenshotAsset: { select: { id: true, fileName: true } } } },
      reviews: { orderBy: { createdAt: "desc" }, include: { brandUser: { select: { name: true } } } },
    },
  });
  if (!d) notFound();

  const [history, runs] = await Promise.all([
    audit.list({ entityType: "Deliverable", entityId: d.id, limit: 100 }).catch(() => []),
    prisma.agentRun.findMany({
      where: { targetType: "Deliverable", targetId: d.id },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      include: { resolvedBy: { select: { name: true } } },
    }),
  ]);
  const actorIds = [...new Set(history.map((h) => h.actorId).filter((x): x is string => !!x))];
  const actors = new Map(
    (await prisma.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, name: true } })).map((u) => [u.id, u.name]),
  );

  const { assignment } = d;
  const tz = assignment.influencer.audienceTimezone;
  const tzLabel = tz === AGENCY_TZ ? "İstanbul" : `${tz}, ${tzShort(tz)}`;
  const brief = assignment.campaign.briefs[0];
  const targets = allowedTargets("ADMIN", d.status).map((t) => ({ value: t, label: deliverableStatusLabels[t], backward: isBackward(d.status, t) }));
  const usedShots = new Set(d.metricSnapshots.map((m) => m.screenshotAssetId).filter(Boolean));
  const freeShots = d.assets.filter((a) => a.kind === "METRIK_SS" && !usedShots.has(a.id)).map((a) => ({ id: a.id, fileName: a.fileName }));
  const overdue = isOverdue(d);
  const canEdit = d.status !== "IPTAL" && d.status !== "TAMAMLANDI" && assignment.contractStatus !== "RED";
  const published = !!d.publishedAt && ["YAYINLANDI", "METRIK_BEKLIYOR", "TAMAMLANDI"].includes(d.status);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title={`${assignment.influencer.name} · ${platformLabels[d.platform]} ${contentTypeLabels[d.contentType]}`}
        description={
          <span className="inline-flex flex-wrap items-center gap-3">
            <StatusDot tone={deliverableTone(d.status, { overdue, violation: d.contractViolation })}>
              {deliverableStatusLabels[d.status]}
              {overdue ? " · gecikti" : ""}
              {d.contractViolation ? " · sözleşme ihlali" : ""}
            </StatusDot>
            <Link href={`/admin/kampanyalar/${assignment.campaign.id}`} className="hover:underline">
              {assignment.campaign.name}
            </Link>
            <span>Sözleşme: {contractStatusLabels[assignment.contractStatus]}</span>
          </span>
        }
        actions={
          <ButtonLink href={`/admin/takvim`} variant="secondary">
            Takvim
          </ButtonLink>
        }
      />

      <div className="grid-12">
        <Card interactive={false} className="flex flex-col gap-4 md:col-span-7">
          <CardTitle>Plan</CardTitle>
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
            <dt className="text-fg-passive">Paylaşım</dt>
            <dd className="tabular-nums">
              {fmtDateTime(d.plannedAt, tz)} ({tzLabel})
              {tz !== AGENCY_TZ ? <span className="text-fg-muted"> · İstanbul {fmtDateTime(d.plannedAt)}</span> : null}
            </dd>
            <dt className="text-fg-passive">Onay son tarihi</dt>
            <dd className="tabular-nums">
              {fmtDateTime(d.approvalDeadline, tz)}
              {tz !== AGENCY_TZ ? <span className="text-fg-muted"> · İstanbul {fmtDateTime(d.approvalDeadline)}</span> : null}
            </dd>
            <dt className="text-fg-passive">Yayın</dt>
            <dd>
              {d.postUrl ? (
                <a href={d.postUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:underline">
                  {d.publishedAt ? fmtDateTime(d.publishedAt, tz) : "Bağlantı"} <ExternalIcon size={12} />
                  <span className="sr-only">(yeni sekmede açılır)</span>
                </a>
              ) : (
                "—"
              )}
            </dd>
            <dt className="text-fg-passive">Caption</dt>
            <dd className="whitespace-pre-line">{d.caption || "—"}</dd>
            <dt className="text-fg-passive">Etiketler</dt>
            <dd>{[...d.hashtags, ...d.mentions].join(" ") || "—"}</dd>
            <dt className="text-fg-passive">UTM link</dt>
            <dd className="font-mono text-[12px] break-all text-fg-muted">{d.link ?? "—"}</dd>
            <dt className="text-fg-passive">Reklam ibaresi</dt>
            <dd>{d.disclosureRequired ? "Zorunlu" : "Zorunlu değil"}</dd>
          </dl>
          {canEdit ? (
            <details className="rounded-[8px] border border-border">
              <summary className="cursor-pointer px-4 py-3 text-sm text-fg-muted hover:text-fg">Planı düzenle</summary>
              <div className="border-t border-border p-4">
                <DeliverableForm
                  assignmentId={assignment.id}
                  tz={tz}
                  tzLabel={tzLabel}
                  defaults={{ hashtags: brief?.hashtags ?? [], mentions: brief?.mentions ?? [], disclosureRequired: brief?.disclosureRequired ?? true }}
                  deliverable={{
                    id: d.id,
                    platform: d.platform,
                    contentType: d.contentType,
                    plannedAt: toLocalInput(d.plannedAt, tz),
                    approvalDeadline: toLocalInput(d.approvalDeadline, tz),
                    caption: d.caption ?? "",
                    hashtags: d.hashtags,
                    mentions: d.mentions,
                    baseLink: d.link ? stripUtm(d.link) : "",
                    disclosureRequired: d.disclosureRequired,
                  }}
                />
              </div>
            </details>
          ) : null}
        </Card>
        <div className="flex flex-col gap-4 md:col-span-5">
          <Card interactive={false} className="flex flex-col gap-4">
            <CardTitle>Durum geçişi</CardTitle>
            <TransitionPanel deliverableId={d.id} targets={targets} role="ADMIN" currentPostUrl={d.postUrl} />
          </Card>
          <PlatformRulePanel platform={d.platform} contentType={d.contentType} />
        </div>
      </div>

      <div className="grid-12">
        <Card interactive={false} className="flex flex-col gap-4 md:col-span-6">
          <CardTitle>Durum geçmişi</CardTitle>
          <ol className="flex flex-col gap-3">
            {d.statusChanges.map((s) => (
              <li key={s.id} className="flex flex-col gap-0.5 border-l border-border pl-4">
                <span className="text-sm">
                  {s.from ? `${deliverableStatusLabels[s.from]} → ` : ""}
                  {deliverableStatusLabels[s.to]}
                </span>
                <span className="text-[12px] text-fg-passive">
                  {fmtDateTime(s.at)} · {s.byUser?.name ?? "Sistem"}
                  {s.note ? ` · ${s.note}` : ""}
                </span>
              </li>
            ))}
          </ol>
        </Card>
        <Card interactive={false} className="flex flex-col gap-4 md:col-span-6">
          <CardTitle>Audit kaydı</CardTitle>
          {history.length === 0 ? (
            <p className="text-sm text-fg-passive">Kayıt yok.</p>
          ) : (
            <ol className="flex max-h-96 flex-col gap-3 overflow-auto">
              {history.map((h) => (
                <li key={h.id} className="flex flex-col gap-0.5 border-l border-border pl-4">
                  <span className="text-sm">
                    {auditLabels[h.action] ?? h.action}
                    <span className="text-fg-muted"> {auditDetail(h.action, h.data, tz)}</span>
                  </span>
                  <span className="text-[12px] text-fg-passive">
                    {fmtDateTime(h.at)} · {h.actorId ? (actors.get(h.actorId) ?? h.actorRole) : "Sistem"} · <span className="font-mono">{h.hash.slice(0, 10)}</span>
                  </span>
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>

      <div className="grid-12">
        <Card interactive={false} className="flex flex-col gap-4 md:col-span-7">
          <CardTitle>Dosyalar</CardTitle>
          <AssetList editableRights assets={d.assets.map((a) => ({ ...a, uploadedByName: a.uploadedBy.name }))} emptyText="Bu işe dosya yüklenmedi." />
        </Card>
        <Card interactive={false} className="flex flex-col gap-4 md:col-span-5">
          <CardTitle>Dosya yükle</CardTitle>
          {d.status === "IPTAL" ? (
            <p className="text-sm text-fg-passive">İptal edilmiş işe dosya yüklenemez.</p>
          ) : (
            <FileUploader
              target={{ type: "deliverable", id: d.id }}
              kinds={[
                { value: "ONAYLI_CAPTION", label: "Onaylı caption" },
                { value: "ORNEK_CEKIM", label: "Örnek çekim" },
                { value: "URUN_FOTO", label: "Ürün fotoğrafı" },
                { value: "TASLAK", label: "Taslak içerik" },
                { value: "HAM_DOSYA", label: "Ham dosya" },
                { value: "METRIK_SS", label: "Metrik ekran görüntüsü" },
                { value: "DIGER", label: "Diğer" },
              ]}
            />
          )}
        </Card>
      </div>

      <Card interactive={false} className="flex flex-col gap-4">
        <CardTitle>Metrikler</CardTitle>
        <DataTable
          caption="Metrik ölçümleri"
          emptyText="Henüz metrik girilmedi."
          columns={[
            { key: "measuredAt", header: "Ölçüm", sortable: true },
            { key: "stage", header: "Aşama", sortable: true },
            { key: "source", header: "Kaynak / güven", sortable: true },
            { key: "reach", header: "Erişim", align: "right", sortable: true },
            { key: "impressions", header: "Gösterim", align: "right" },
            { key: "engagement", header: "Etkileşim", align: "right" },
            { key: "er", header: "ER", align: "right" },
            { key: "brand", header: "Tık / satış", align: "right" },
            { key: "by", header: "Giren" },
          ]}
          rows={d.metricSnapshots.map((m) => {
            const interactions = (m.likes ?? 0) + (m.comments ?? 0) + (m.saves ?? 0) + (m.shares ?? 0);
            return {
              id: m.id,
              cells: {
                measuredAt: { display: fmtDateTime(m.measuredAt, tz), sort: m.measuredAt.getTime() },
                stage: { display: metricStageLabels[m.stage], sort: m.stage },
                source: {
                  display: (
                    <span className="flex flex-col">
                      {metricSourceLabels[m.source]}
                      <span className="text-[12px] text-fg-passive">
                        {trustLevelLabels[metricSourceTrust[m.source]]}
                        {m.screenshotAsset ? (
                          <>
                            {" · "}
                            <a href={`/api/assets/${m.screenshotAsset.id}/download`} className="hover:underline">
                              görüntü
                            </a>
                          </>
                        ) : null}
                      </span>
                    </span>
                  ),
                  sort: m.source,
                },
                reach: { display: m.reach != null ? num.format(m.reach) : "—", sort: m.reach },
                impressions: m.impressions != null ? num.format(m.impressions) : "—",
                engagement: interactions ? num.format(interactions) : "—",
                er: m.reach ? pct1.format(interactions / m.reach) : "—",
                brand: m.clicks != null || m.sales != null ? `${num.format(m.clicks ?? 0)} / ${num.format(m.sales ?? 0)}` : "—",
                by: m.enteredBy?.name ?? "—",
              },
            };
          })}
        />
        {published ? (
          <details className="rounded-[8px] border border-border">
            <summary className="cursor-pointer px-4 py-3 text-sm text-fg-muted hover:text-fg">Metrik gir</summary>
            <div className="border-t border-border p-4">
              <MetricEntryForm deliverableId={d.id} platform={d.platform} isStory={isStory(d)} role="ADMIN" tzLabel={tzLabel} screenshots={freeShots} />
            </div>
          </details>
        ) : (
          <p className="text-[13px] text-fg-passive">Metrik girişi yayından sonra açılır.</p>
        )}
        <details className="rounded-[8px] border border-border">
          <summary className="cursor-pointer px-4 py-3 text-sm text-fg-muted hover:text-fg">Marka verisi gir (UTM tıklama, satış, ciro)</summary>
          <div className="border-t border-border p-4">
            <BrandDataForm deliverableId={d.id} />
          </div>
        </details>
      </Card>

      <div className="grid-12">
        <Card interactive={false} className="flex flex-col gap-4 md:col-span-7">
          <CardTitle>Agent bulguları</CardTitle>
          <AgentRunList runs={runs.map((r) => ({ ...r, resolvedByName: r.resolvedBy?.name }))} emptyText="Bu iş için agent bulgusu yok." />
        </Card>
        <Card interactive={false} className="flex flex-col gap-4 md:col-span-5">
          <CardTitle>Marka incelemeleri</CardTitle>
          {d.reviews.length === 0 ? (
            <p className="text-sm text-fg-passive">Marka henüz inceleme bırakmadı.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {d.reviews.map((r) => (
                <li key={r.id} className="flex flex-col gap-1 py-3">
                  <StatusDot tone={r.decision === "ONAY" ? "active" : "muted"}>{reviewDecisionLabels[r.decision]}</StatusDot>
                  <p className="text-sm">{r.note}</p>
                  <span className="text-[12px] text-fg-passive">
                    {r.brandUser.name} · {fmtDateTime(r.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="flex items-center gap-2 text-[12px] text-fg-passive">
            <PlatformIcon platform={d.platform} size={12} /> Durumu yalnız admin değiştirir; marka notları kuyruğa düşer.
          </p>
        </Card>
      </div>
    </div>
  );
}
