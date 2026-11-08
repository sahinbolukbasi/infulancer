import { getTT } from "@/lib/i18n/tt-server";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@infulancer/core/db";
import { formatKurus } from "@infulancer/core/domain/labels";
import { OpenCallStatusButton, ReviewApplication } from "@/components/campaigns/open-call-forms";
import { BackLink, Pill, StatStrip } from "@/components/luma/primitives";
import { Avatar, pickAvatar } from "@/components/ui/avatar";
import { requireActor } from "@/lib/auth-guard";
import { applicationPill, callPill } from "@/lib/offers-pills";
import { mediaSrc } from "@/lib/media";
import { fmtDate } from "@/lib/time";

export const metadata: Metadata = { title: "Başvuru çağrısı" };
export const dynamic = "force-dynamic";

export default async function OpenCallDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const tt = await getTT();
  const actor = await requireActor("BRAND");
  const { id } = await params;
  const call = await prisma.campaignOpenCall.findUnique({ where: { id }, include: { applications: { orderBy: { createdAt: "desc" } } } });
  if (!call || call.tenantId !== actor.brandId) notFound();
  const infs = new Map((await prisma.influencer.findMany({ where: { id: { in: call.applications.map((a) => a.influencerId) } }, select: { id: true, name: true, category: true, city: true, socialAccounts: { select: { platform: true, avatarUrl: true, followers: true } } } })).map((x) => [x.id, x]));
  const p = callPill[call.status] ?? { label: call.status, tone: "gray" as const };
  const n = (s: string) => call.applications.filter((a) => a.status === s).length;
  const cover = mediaSrc(call.coverImageKey);
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <BackLink href="/marka/teklifler?sekme=cagrilar">{tt("Teklifler")}</BackLink>
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-2">
          <Pill tone={p.tone}>{p.label}</Pill>
          <h1 className="text-title text-fg">{call.title}</h1>
          <p className="text-[13px] text-fg-muted">
            {call.platforms.join(", ") || tt("Tüm platformlar")}
            {call.category ? ` · ${call.category}` : ""}
            {call.budgetMinKurus != null || call.budgetMaxKurus != null ? ` · ${call.budgetMinKurus != null ? formatKurus(Number(call.budgetMinKurus)) : "?"} – ${call.budgetMaxKurus != null ? formatKurus(Number(call.budgetMaxKurus)) : "?"}` : ""}
            {call.deadline ? ` · son başvuru ${fmtDate(call.deadline)}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {call.status === "TASLAK" ? <OpenCallStatusButton id={call.id} to="ACIK" label={tt("Başvuruya aç")} variant="primary" /> : null}
          {call.status === "ACIK" ? <OpenCallStatusButton id={call.id} to="KAPALI" label={tt("Başvuruları kapat")} /> : null}
          {call.status === "KAPALI" ? <OpenCallStatusButton id={call.id} to="ACIK" label={tt("Yeniden aç")} /> : null}
        </div>
      </header>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-[minmax(0,1fr)_260px]">
        <p className="whitespace-pre-line rounded-2xl border border-line bg-surface p-5 text-[14px] text-fg">{call.description}</p>
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover} alt="" className="aspect-square w-full rounded-2xl border border-line object-cover" />
        ) : null}
      </div>
      <StatStrip
        stats={[
          { label: "Başvuru", value: String(call.applications.length) },
          { label: "Yeni", value: String(n("BASVURULDU")) },
          { label: "İnceleniyor", value: String(n("INCELENIYOR")) },
          { label: "Kabul (teklif)", value: String(n("KABUL")) },
          { label: "Ret", value: String(n("RED")) },
          { label: "Durum", value: p.label },
        ]}
      />
      {call.status === "TASLAK" ? <p className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-[13px] text-fg">{tt("Çağrı taslakta. \"Başvuruya aç\" deyince içerik üreticileri Teklifler › Açık çağrılar bölümünde görür.")}</p> : null}
      <section className="flex flex-col gap-3" aria-label={tt("Başvurular")}>
        <h2 className="border-b border-line pb-2 text-[15px] font-semibold text-fg">{tt("Başvurular (")}{call.applications.length})</h2>
        {call.applications.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line px-4 py-10 text-center text-[13px] text-fg-muted">{tt("Henüz başvuru yok.")}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
            {call.applications.map((a) => {
              const inf = infs.get(a.influencerId);
              const ap = applicationPill[a.status] ?? { label: a.status, tone: "gray" as const };
              const followers = inf?.socialAccounts.reduce((s, x) => s + x.followers, 0) ?? 0;
              return (
                <li key={a.id} className="flex flex-col gap-3 px-4 py-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <Avatar name={inf?.name ?? "?"} src={inf ? pickAvatar(inf.socialAccounts) : null} size={40} />
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="font-medium text-fg">{inf?.name ?? tt("İçerik üreticisi")}</span>
                      <span className="text-[12px] text-fg-muted">{[inf?.category, inf?.city, followers ? `${followers.toLocaleString("tr-TR")} takipçi` : null].filter(Boolean).join(" · ")}</span>
                    </div>
                    {a.quotedKurus != null ? <span className="font-semibold tabular-nums text-fg">{formatKurus(Number(a.quotedKurus))}</span> : null}
                    <Pill tone={ap.tone}>{ap.label}</Pill>
                  </div>
                  <p className="text-[13px] text-fg-muted">{a.pitch}</p>
                  {a.reviewNote ? <p className="text-[12px] text-fg-passive">{tt("Not:")}{" "}{a.reviewNote}</p> : null}
                  {a.status === "BASVURULDU" || a.status === "INCELENIYOR" ? <ReviewApplication id={a.id} /> : null}
                  {a.offerId ? <Link href="/marka/teklifler?sekme=teklifler" className="w-fit text-[12px] font-medium text-fg underline-offset-4 hover:underline">{tt("Teklifler'de görüntüle →")}</Link> : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
