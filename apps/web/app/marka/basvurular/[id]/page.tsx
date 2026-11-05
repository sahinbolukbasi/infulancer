import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@infulancer/core/db";
import { formatKurus } from "@infulancer/core/domain/labels";
import { OpenCallStatusButton, ReviewApplication } from "@/components/campaigns/open-call-forms";
import { Card, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/layout";
import { StatusDot } from "@/components/ui/status";
import { requireActor } from "@/lib/auth-guard";
import { fmtDate } from "@/lib/time";

export const metadata: Metadata = { title: "Başvuru çağrısı" };
export const dynamic = "force-dynamic";
const statusTr: Record<string, string> = { TASLAK: "Taslak", ACIK: "Açık", KAPALI: "Kapalı" };
const appTr: Record<string, string> = { BASVURULDU: "Başvuruldu", INCELENIYOR: "İnceleniyor", KABUL: "Kabul", RED: "Ret" };

export default async function BrandOpenCallDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requireActor("BRAND");
  const { id } = await params;
  const call = await prisma.campaignOpenCall.findUnique({ where: { id }, include: { applications: { orderBy: { createdAt: "desc" } } } });
  if (!call || call.tenantId !== actor.brandId) notFound();
  const names = new Map((await prisma.influencer.findMany({ where: { id: { in: call.applications.map((a) => a.influencerId) } }, select: { id: true, name: true } })).map((x) => [x.id, x.name]));
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={call.title} description={`${call.applications.length} başvuru${call.deadline ? ` · son ${fmtDate(call.deadline)}` : ""}`} actions={<StatusDot tone={call.status === "ACIK" ? "active" : "muted"}>{statusTr[call.status]}</StatusDot>} />
      <div className="flex flex-wrap gap-2">
        {call.status === "TASLAK" ? <OpenCallStatusButton id={call.id} to="ACIK" label="Başvuruya aç" variant="primary" /> : null}
        {call.status === "ACIK" ? <OpenCallStatusButton id={call.id} to="KAPALI" label="Başvuruyu kapat" /> : null}
        {call.status === "KAPALI" ? <OpenCallStatusButton id={call.id} to="ACIK" label="Yeniden aç" /> : null}
      </div>
      <Card interactive={false} className="flex flex-col gap-2">
        <CardTitle>Çağrı detayı</CardTitle>
        <p className="whitespace-pre-line text-sm text-fg-muted">{call.description}</p>
        <p className="text-[13px] text-fg-muted">
          {call.category ? `${call.category} · ` : ""}
          {call.budgetMinKurus != null || call.budgetMaxKurus != null ? `Bütçe: ${call.budgetMinKurus != null ? formatKurus(Number(call.budgetMinKurus)) : "?"} – ${call.budgetMaxKurus != null ? formatKurus(Number(call.budgetMaxKurus)) : "?"} · ` : ""}
          {call.platforms.join(", ")}
        </p>
      </Card>
      <Card interactive={false} className="flex flex-col gap-3">
        <CardTitle>Başvurular ({call.applications.length})</CardTitle>
        {call.applications.length === 0 ? (
          <p className="text-sm text-fg-passive">Henüz başvuru yok.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-line">
            {call.applications.map((a) => (
              <li key={a.id} className="flex flex-col gap-2 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">{names.get(a.influencerId) ?? "Influencer"}</span>
                  <span className="flex items-center gap-3 text-[13px]">
                    {a.quotedKurus != null ? <span className="tabular-nums">{formatKurus(Number(a.quotedKurus))}</span> : null}
                    <StatusDot tone={a.status === "KABUL" ? "active" : a.status === "RED" ? "critical" : "muted"}>{appTr[a.status]}</StatusDot>
                  </span>
                </div>
                <p className="text-[13px] text-fg-muted">{a.pitch}</p>
                {a.reviewNote ? <p className="text-[12px] text-fg-passive">Not: {a.reviewNote}</p> : null}
                {a.status === "BASVURULDU" || a.status === "INCELENIYOR" ? <ReviewApplication id={a.id} /> : null}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
