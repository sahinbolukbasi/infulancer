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
import { cn } from "@/lib/cn";
import { fmtDateTime } from "@/lib/time";

export const metadata: Metadata = { title: "Agent merkezi" };
export const dynamic = "force-dynamic";

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const SECTIONS = [
  { id: "agentlar", label: "Denetim agent'ları" },
  { id: "bulgular", label: "Bulgular" },
  { id: "asistanlar", label: "Sohbet asistanları" },
] as const;

export default async function AgentCenterPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireActor("ADMIN");
  const sp = await searchParams;
  const section = SECTIONS.find((s) => s.id === one(sp.bolum))?.id ?? "agentlar";
  const openCount = await prisma.agentRun.count({ where: { status: "ACIK" } });

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Agent merkezi"
        description="Agent’lar iki türdür: denetim agent’ları arka planda kampanya, içerik ve uyumu kontrol edip bulgu üretir; sohbet asistanları markaların WhatsApp/Instagram müşterilerine cevap verir. Hiçbir agent iş durumunu kendi başına değiştirmez."
      />
      <nav aria-label="Agent merkezi bölümleri" className="flex flex-wrap gap-2 border-b border-border">
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
      {section === "agentlar" ? <AuditAgents /> : section === "bulgular" ? <Findings sp={sp} /> : <Assistants sp={sp} />}
    </div>
  );
}

async function AuditAgents() {
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
                    <StatusDot tone={a.enabled ? "active" : "passive"}>{a.enabled ? "Açık" : "Kapalı"}</StatusDot>
                  </div>
                  <p className="text-sm text-fg-muted">{a.does}</p>
                  <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[13px]">
                    <dt className="text-fg-passive">Ne zaman</dt>
                    <dd>{a.when}</dd>
                    <dt className="text-fg-passive">Sonuç</dt>
                    <dd>{a.output}</dd>
                    <dt className="text-fg-passive">Son çalışma</dt>
                    <dd>
                      {a.lastRun ? (
                        <span className={a.lastRun.ok ? "" : "text-critical"}>
                          {fmtDateTime(a.lastRun.startedAt)} · {a.lastRun.ok ? `${a.lastRun.created} yeni kayıt` : `hata: ${a.lastRun.error ?? "?"}`}
                          {a.lastRun.trigger === "manual" ? " (elle)" : ""}
                        </span>
                      ) : (
                        "Henüz çalışmadı"
                      )}
                    </dd>
                    {a.checkType ? (
                      <>
                        <dt className="text-fg-passive">Açık bulgu</dt>
                        <dd>
                          <Link href={`/admin/agent?bolum=bulgular&kontrol=${a.checkType}`} className="underline-offset-4 hover:underline">
                            {a.openFindings} bulgu →
                          </Link>
                        </dd>
                      </>
                    ) : null}
                  </dl>
                  {a.risk && a.enabled ? <p className="text-[12px] text-fg-passive">Not: {a.risk}</p> : null}
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
      <InfoNote>Her bulgu bir öneri veya uyarıdır. “Onayla” bulgunun doğru olduğunu ve gereğinin yapıldığını, “Ez” yanlış alarm olduğunu kaydeder. İkisi de denetim kaydına yazılır.</InfoNote>
      <form method="get" className="flex flex-wrap items-end gap-3" aria-label="Filtre">
        <input type="hidden" name="bolum" value="bulgular" />
        <label className="flex flex-col gap-2">
          <span className="text-label text-fg-muted">Kontrol</span>
          <Select name="kontrol" defaultValue={check ?? ""} className="w-52">
            <option value="">Tümü</option>
            {checks.map((c) => (
              <option key={c} value={c}>
                {agentCheckLabels[c]}
              </option>
            ))}
          </Select>
        </label>
        <label className="flex flex-col gap-2">
          <span className="text-label text-fg-muted">Önem</span>
          <Select name="onem" defaultValue={severity ?? ""} className="w-36">
            <option value="">Tümü</option>
            {severities.map((s) => (
              <option key={s} value={s}>
                {severityLabels[s]}
              </option>
            ))}
          </Select>
        </label>
        <label className="flex flex-col gap-2">
          <span className="text-label text-fg-muted">Durum</span>
          <Select name="durum" defaultValue={status ?? "TUMU"} className="w-36">
            <option value="TUMU">Tümü</option>
            {statuses.map((s) => (
              <option key={s} value={s}>
                {agentRunStatusLabels[s]}
              </option>
            ))}
          </Select>
        </label>
        <Button type="submit" variant="secondary">
          Filtrele
        </Button>
        <ButtonLink href="/admin/agent?bolum=bulgular" variant="ghost">
          Sıfırla
        </ButtonLink>
      </form>
      <p className="text-[13px] tabular-nums text-fg-passive">{sorted.length} bulgu</p>
      <AgentRunList runs={sorted.map((r) => ({ ...r, resolvedByName: r.resolvedBy?.name }))} emptyText="Filtreye uyan bulgu yok." />
    </div>
  );
}

async function Assistants({ sp }: { sp: Record<string, string | string[] | undefined> }) {
  const brands = await prisma.brand.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } });
  const brandId = brands.find((b) => b.id === one(sp.marka))?.id ?? brands[0]?.id;
  if (!brandId) return <p className="text-sm text-fg-passive">Marka yok.</p>;
  const items = await assistantsFor(brandId);
  return (
    <div className="flex flex-col gap-6">
      <InfoNote>Markalar kendi asistanlarını “Asistanlar” sayfasından yönetir; burada ajans adına düzenleyebilirsiniz. Her asistan yalnız seçili markanın bilgi tabanını kullanır.</InfoNote>
      <form method="get" className="flex items-end gap-3">
        <input type="hidden" name="bolum" value="asistanlar" />
        <label className="flex flex-col gap-2">
          <span className="text-label text-fg-muted">Marka</span>
          <Select name="marka" defaultValue={brandId} className="w-64">
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
        </label>
        <Button type="submit" variant="secondary">
          Göster
        </Button>
      </form>
      {items.map((a) => (
        <Card key={a.template.key} interactive={false} className="flex flex-col gap-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              <CardTitle>{a.template.name}</CardTitle>
              <p className="text-[13px] text-fg-muted">{a.template.description}</p>
            </div>
            <StatusDot tone={a.values.enabled ? "active" : "passive"}>{a.values.enabled ? "Açık" : "Kapalı"}</StatusDot>
          </div>
          <p className="text-[13px] text-fg-muted">Son 30 gün çözülen konuşma: {a.handled}</p>
          <details className="rounded-[8px] border border-border">
            <summary className="cursor-pointer px-4 py-3 text-sm text-fg-muted hover:text-fg">Ayarlar</summary>
            <div className="border-t border-border p-4">
              <AssistantForm values={a.values} tenantId={brandId} />
            </div>
          </details>
        </Card>
      ))}
    </div>
  );
}
