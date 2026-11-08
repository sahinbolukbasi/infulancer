import { getTT } from "@/lib/i18n/tt-server";
import type { Metadata } from "next";
import Link from "next/link";
import { prisma, type AgentCheck, type AgentRunStatus, type Severity } from "@infulancer/core/db";
import { agentGroupLabels, agentOverview, type AgentGroup } from "@infulancer/core/agents/catalog";
import { agentCheckLabels, agentRunStatusLabels, severityLabels } from "@infulancer/core/domain/labels";
import { AgentRunList } from "@/components/agent/agent-run-list";
import { AssistantForm, AuditAgentControls } from "@/components/agent/agent-forms";
import { Card, CardTitle } from "@/components/ui/card";
import { Button, ButtonLink, Select } from "@/components/ui/form";
import { PageHeader } from "@/components/ui/layout";
import { StatusDot } from "@/components/ui/status";
import { InfoNote } from "@/components/ui/unverified";
import { assistantsFor } from "@/lib/assistants";
import { requireActor } from "@/lib/auth-guard";
import { TrackerGallery, TrackerList } from "@/components/agent/tracker-ui";
import { loadTrackerViews, templateViews, trackerTargets } from "@/lib/trackers";
import { cn } from "@/lib/cn";
import { fmtDateTime } from "@/lib/time";

export const metadata: Metadata = { title: "Agent merkezi" };
export const dynamic = "force-dynamic";

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const SECTIONS = [
  { id: "takip", label: "Takip agent'ları" },
  { id: "agentlar", label: "Denetim agent'ları" },
  { id: "bulgular", label: "Bulgular" },
  { id: "asistanlar", label: "Sohbet asistanları" },
] as const;

export default async function AgentCenterPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const tt = await getTT();
  await requireActor("ADMIN");
  const sp = await searchParams;
  const section = SECTIONS.find((s) => s.id === one(sp.bolum))?.id ?? "takip";
  const openCount = await prisma.agentRun.count({ where: { status: "ACIK" } });

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title={tt("Agent merkezi")}
        description={tt("Şablondan takipçi kurun; kampanya, story, influencer ve markayı sizin yerinize izlesin.")}
      />
      <nav aria-label={tt("Agent merkezi bölümleri")} className="flex flex-wrap gap-2 border-b border-border">
        {SECTIONS.map((s) => (
          <Link
            key={s.id}
            href={`/admin/agent?bolum=${s.id}`}
            aria-current={section === s.id ? "page" : undefined}
            className={cn("-mb-px border-b-2 px-3 py-2 text-sm", section === s.id ? "border-fg text-fg" : "border-transparent text-fg-muted hover:text-fg")}
          >
            {s.label}
            {s.id === "bulgular" && openCount ? ` (${openCount} açık)` : ""}
          </Link>
        ))}
      </nav>
      {section === "takip" ? <Trackers /> : section === "agentlar" ? <AuditAgents /> : section === "bulgular" ? <Findings sp={sp} /> : <Assistants sp={sp} />}
    </div>
  );
}

async function Trackers() {
  const tt = await getTT();
  const [trackers, targets] = await Promise.all([loadTrackerViews(), trackerTargets()]);
  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3" aria-labelledby="trk-new">
        <h2 id="trk-new" className="text-section">{" "}{tt("Hazır şablonlar")}</h2>
        <TrackerGallery templates={templateViews()} targets={targets} />
      </section>
      <section className="flex flex-col gap-3" aria-labelledby="trk-list">
        <h2 id="trk-list" className="text-section">{" "}{tt("Kurulu takipçiler (")}{trackers.length})
        </h2>
        <TrackerList trackers={trackers} emptyText={tt("Henüz takipçi yok. Yukarıdan bir şablon seçin; yeni kampanyalara kampanya ve story takibi otomatik eklenir.")} />
      </section>
    </div>
  );
}
async function AuditAgents() {
  const tt = await getTT();
  const agents = await agentOverview();
  const groups = Object.keys(agentGroupLabels) as AgentGroup[];
  return (
    <div className="flex flex-col gap-8">
      {groups.map((g) => {
        const list = agents.filter((a) => a.group === g);
        if (!list.length) return null;
        return (
          <section key={g} className="flex flex-col gap-3" aria-labelledby={`grp-${g}`}>
            <div>
              <h2 id={`grp-${g}`} className="text-section">
                {agentGroupLabels[g].title}
              </h2>
              <p className="text-[13px] text-fg-muted">{agentGroupLabels[g].description}</p>
            </div>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {list.map((a) => (
                <Card key={a.job} interactive={false} className="flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-3">
                    <CardTitle>{a.name}</CardTitle>
                    <StatusDot tone={a.enabled ? "active" : "passive"}>{a.enabled ? tt("Açık") : tt("Kapalı")}</StatusDot>
                  </div>
                  <p className="text-sm text-fg-muted">{a.does}</p>
                  <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[13px]">
                    <dt className="text-fg-passive">{tt("Ne zaman")}</dt>
                    <dd>{a.when}</dd>
                    <dt className="text-fg-passive">{tt("Sonuç")}</dt>
                    <dd>{a.output}</dd>
                    <dt className="text-fg-passive">{tt("Son çalışma")}</dt>
                    <dd>
                      {a.lastRun ? (
                        <span className={a.lastRun.ok ? "" : "text-critical"}>
                          {fmtDateTime(a.lastRun.startedAt)} · {a.lastRun.ok ? `${a.lastRun.created} yeni kayıt` : `hata: ${a.lastRun.error ?? "?"}`}
                          {a.lastRun.trigger === "manual" ? tt(" (elle)") : ""}
                        </span>
                      ) : (
                        tt("Henüz çalışmadı")
                      )}
                    </dd>
                    {a.checkType ? (
                      <>
                        <dt className="text-fg-passive">{tt("Açık bulgu")}</dt>
                        <dd>
                          <Link href={`/admin/agent?bolum=bulgular&kontrol=${a.checkType}`} className="underline-offset-4 hover:underline">
                            {a.openFindings}{" "}{tt("bulgu →")}</Link>
                        </dd>
                      </>
                    ) : null}
                  </dl>
                  {a.risk && a.enabled ? <p className="text-[12px] text-fg-passive">{tt("Not:")}{" "}{a.risk}</p> : null}
                  <AuditAgentControls job={a.job} enabled={a.enabled} required={a.required} />
                </Card>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

async function Findings({ sp }: { sp: Record<string, string | string[] | undefined> }) {
  const tt = await getTT();
  const checks = Object.keys(agentCheckLabels) as AgentCheck[];
  const severities = Object.keys(severityLabels) as Severity[];
  const statuses = Object.keys(agentRunStatusLabels) as AgentRunStatus[];
  const check = checks.find((c) => c === one(sp.kontrol));
  const severity = severities.find((s) => s === one(sp.onem));
  const rawStatus = one(sp.durum);
  const status = rawStatus === "TUMU" ? undefined : (statuses.find((s) => s === rawStatus) ?? "ACIK");
  const runs = await prisma.agentRun.findMany({
    where: { ...(check ? { checkType: check } : {}), ...(severity ? { severity } : {}), ...(status ? { status } : {}) },
    orderBy: [{ createdAt: "desc" }],
    include: { resolvedBy: { select: { name: true } } },
    take: 200,
  });
  const rank = { KRITIK: 3, UYARI: 2, BILGI: 1 } as const;
  const sorted = [...runs].sort((a, b) => rank[b.severity] - rank[a.severity] || b.createdAt.getTime() - a.createdAt.getTime());
  return (
    <div className="flex flex-col gap-6">
      <InfoNote>{tt("Her bulgu bir öneri veya uyarıdır. “Onayla” bulgunun doğru olduğunu ve gereğinin yapıldığını, “Ez” yanlış alarm olduğunu kaydeder. İkisi de denetim kaydına yazılır.")}</InfoNote>
      <form method="get" className="flex flex-wrap items-end gap-3" aria-label={tt("Filtre")}>
        <input type="hidden" name="bolum" value="bulgular" />
        <label className="flex flex-col gap-2">
          <span className="text-label text-fg-muted">{tt("Kontrol")}</span>
          <Select name="kontrol" defaultValue={check ?? ""} className="w-52">
            <option value="">{tt("Tümü")}</option>
            {checks.map((c) => (
              <option key={c} value={c}>
                {agentCheckLabels[c]}
              </option>
            ))}
          </Select>
        </label>
        <label className="flex flex-col gap-2">
          <span className="text-label text-fg-muted">{tt("Önem")}</span>
          <Select name="onem" defaultValue={severity ?? ""} className="w-36">
            <option value="">{tt("Tümü")}</option>
            {severities.map((s) => (
              <option key={s} value={s}>
                {severityLabels[s]}
              </option>
            ))}
          </Select>
        </label>
        <label className="flex flex-col gap-2">
          <span className="text-label text-fg-muted">{tt("Durum")}</span>
          <Select name="durum" defaultValue={status ?? "TUMU"} className="w-36">
            <option value="TUMU">{tt("Tümü")}</option>
            {statuses.map((s) => (
              <option key={s} value={s}>
                {agentRunStatusLabels[s]}
              </option>
            ))}
          </Select>
        </label>
        <Button type="submit" variant="secondary">{" "}{tt("Filtrele")}</Button>
        <ButtonLink href="/admin/agent?bolum=bulgular" variant="ghost">{" "}{tt("Sıfırla")}</ButtonLink>
      </form>
      <p className="text-[13px] tabular-nums text-fg-passive">{sorted.length}{" "}{tt("bulgu")}</p>
      <AgentRunList runs={sorted.map((r) => ({ ...r, resolvedByName: r.resolvedBy?.name }))} emptyText={tt("Filtreye uyan bulgu yok.")} />
    </div>
  );
}

async function Assistants({ sp }: { sp: Record<string, string | string[] | undefined> }) {
  const tt = await getTT();
  const brands = await prisma.brand.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } });
  const brandId = brands.find((b) => b.id === one(sp.marka))?.id ?? brands[0]?.id;
  if (!brandId) return <p className="text-sm text-fg-passive">{tt("Marka yok.")}</p>;
  const items = await assistantsFor(brandId);
  return (
    <div className="flex flex-col gap-6">
      <InfoNote>{tt("Markalar kendi asistanlarını “Asistanlar” sayfasından yönetir; burada ajans adına düzenleyebilirsiniz. Her asistan yalnız seçili markanın bilgi tabanını kullanır.")}</InfoNote>
      <form method="get" className="flex items-end gap-3">
        <input type="hidden" name="bolum" value="asistanlar" />
        <label className="flex flex-col gap-2">
          <span className="text-label text-fg-muted">{tt("Marka")}</span>
          <Select name="marka" defaultValue={brandId} className="w-64">
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
        </label>
        <Button type="submit" variant="secondary">{" "}{tt("Göster")}</Button>
      </form>
      {items.map((a) => (
        <Card key={a.template.key} interactive={false} className="flex flex-col gap-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              <CardTitle>{a.template.name}</CardTitle>
              <p className="text-[13px] text-fg-muted">{a.template.description}</p>
            </div>
            <StatusDot tone={a.values.enabled ? "active" : "passive"}>{a.values.enabled ? tt("Açık") : tt("Kapalı")}</StatusDot>
          </div>
          <p className="text-[13px] text-fg-muted">{tt("Son 30 gün çözülen konuşma:")}{" "}{a.handled}</p>
          <details className="rounded-[8px] border border-border">
            <summary className="cursor-pointer px-4 py-3 text-sm text-fg-muted hover:text-fg">{tt("Ayarlar")}</summary>
            <div className="border-t border-border p-4">
              <AssistantForm values={a.values} tenantId={brandId} />
            </div>
          </details>
        </Card>
      ))}
    </div>
  );
}
