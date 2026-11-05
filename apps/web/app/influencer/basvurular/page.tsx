import type { Metadata } from "next";
import { prisma } from "@infulancer/core/db";
import { formatKurus } from "@infulancer/core/domain/labels";
import { ApplyForm } from "@/components/campaigns/open-call-forms";
import { Card, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/layout";
import { StatusDot } from "@/components/ui/status";
import { Tabs } from "@/components/ui/tabs";
import { requireActor } from "@/lib/auth-guard";
import { fmtDate } from "@/lib/time";

export const metadata: Metadata = { title: "Açık çağrılar" };
export const dynamic = "force-dynamic";
const appTr: Record<string, string> = { BASVURULDU: "Başvuruldu", INCELENIYOR: "İnceleniyor", KABUL: "Kabul edildi", RED: "Reddedildi" };

export default async function InfluencerOpenCallsPage() {
  const actor = await requireActor("INFLUENCER");
  const id = actor.influencerId!;
  const [open, mine] = await Promise.all([
    prisma.campaignOpenCall.findMany({ where: { status: "ACIK" }, orderBy: { createdAt: "desc" }, take: 60 }),
    prisma.campaignApplication.findMany({ where: { influencerId: id }, orderBy: { createdAt: "desc" }, include: { openCall: { select: { title: true } } } }),
  ]);
  const applied = new Set(mine.map((m) => m.openCallId));
  const brandNames = new Map((await prisma.brand.findMany({ where: { id: { in: [...new Set(open.map((o) => o.tenantId))] } }, select: { id: true, name: true } })).map((b) => [b.id, b.name]));
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Açık çağrılar" description="Markaların açtığı kampanya başvurularına katılın." />
      <Tabs
        label="Çağrı bölümleri"
        tabs={[
          {
            id: "acik",
            label: `Açık çağrılar (${open.length})`,
            content:
              open.length === 0 ? (
                <p className="text-sm text-fg-passive">Şu an açık çağrı yok.</p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {open.map((c) => (
                    <li key={c.id}>
                      <Card interactive={false} className="flex flex-col gap-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-col">
                            <CardTitle>{c.title}</CardTitle>
                            <span className="text-[13px] text-fg-muted">
                              {brandNames.get(c.tenantId) ?? "Marka"}
                              {c.budgetMinKurus != null || c.budgetMaxKurus != null ? ` · ${c.budgetMinKurus != null ? formatKurus(Number(c.budgetMinKurus)) : "?"} – ${c.budgetMaxKurus != null ? formatKurus(Number(c.budgetMaxKurus)) : "?"}` : ""}
                              {c.deadline ? ` · son ${fmtDate(c.deadline)}` : ""}
                            </span>
                          </div>
                          {applied.has(c.id) ? <StatusDot tone="active">Başvuruldu</StatusDot> : null}
                        </div>
                        <p className="whitespace-pre-line text-sm text-fg-muted">{c.description}</p>
                        {!applied.has(c.id) ? (
                          <details className="rounded-[8px] border border-border">
                            <summary className="cursor-pointer px-3 py-2 text-sm text-fg-muted hover:text-fg">Başvur</summary>
                            <div className="border-t border-border p-3"><ApplyForm openCallId={c.id} /></div>
                          </details>
                        ) : null}
                      </Card>
                    </li>
                  ))}
                </ul>
              ),
          },
          {
            id: "benim",
            label: `Başvurularım (${mine.length})`,
            content:
              mine.length === 0 ? (
                <p className="text-sm text-fg-passive">Henüz başvuru yok.</p>
              ) : (
                <ul className="flex flex-col divide-y divide-line rounded-2xl border border-line">
                  {mine.map((m) => (
                    <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                      <span className="text-sm">{m.openCall.title}</span>
                      <StatusDot tone={m.status === "KABUL" ? "active" : m.status === "RED" ? "critical" : "muted"}>{appTr[m.status]}</StatusDot>
                    </li>
                  ))}
                </ul>
              ),
          },
        ]}
      />
    </div>
  );
}
