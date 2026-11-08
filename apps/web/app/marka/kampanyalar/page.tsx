import type { Metadata } from "next";
import Link from "next/link";
import { toBrandCampaignView } from "@infulancer/core/access/dto";
import { prisma, type CampaignStatus } from "@infulancer/core/db";
import { countryName } from "@infulancer/core/domain/campaign-plan";
import { campaignStatusLabels, formatKurus } from "@infulancer/core/domain/labels";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ButtonLink } from "@/components/ui/form";
import { PageHeader } from "@/components/ui/layout";
import { ProgressBar } from "@/components/ui/progress";
import { StatusDot } from "@/components/ui/status";
import { requireActor } from "@/lib/auth-guard";
import { cn } from "@/lib/cn";
import { pct } from "@/lib/format";
import { loadCampaignScores } from "@/lib/queries";
import { campaignTone } from "@/lib/status-tone";
import { fmtDate } from "@/lib/time";

export const metadata: Metadata = { title: "Kampanyalar" };
export const dynamic = "force-dynamic";
const TABS: { id: "" | CampaignStatus; label: string }[] = [
  { id: "", label: "Tümü" },
  { id: "TASLAK", label: "Taslak" },
  { id: "AKTIF", label: "Aktif" },
  { id: "KAPANDI", label: "Kapandı" },
];

export default async function BrandCampaignsPage({ searchParams }: { searchParams: Promise<{ durum?: string }> }) {
  const actor = await requireActor("BRAND");
  const { durum } = await searchParams;
  const status = TABS.find((t) => t.id && t.id === durum)?.id || undefined;
  const [rows, counts] = await Promise.all([
    prisma.campaign.findMany({
      where: { brandId: actor.brandId!, ...(status ? { status } : { status: { not: "IPTAL" } }) },
      orderBy: [{ updatedAt: "desc" }],
      include: { assignments: { include: { influencer: { select: { id: true, name: true } } } } },
    }),
    prisma.campaign.groupBy({ by: ["status"], where: { brandId: actor.brandId! }, _count: true }),
  ]);
  // Marka ekranına yalnız DTO (influencer bedeli/komisyon yok).
  const campaigns = rows.map((c) => ({ view: toBrandCampaignView(c), raw: c }));
  const scores = await loadCampaignScores(campaigns.filter((c) => c.raw.status !== "TASLAK").map((c) => c.view.id));
  const total = counts.reduce((s, c) => s + (c.status === "IPTAL" ? 0 : c._count), 0);
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Kampanyalar" description="Taslakları tamamlayın, aktif kampanyaların skorunu ve raporunu izleyin." actions={<ButtonLink href="/marka/kampanyalar/yeni">Yeni kampanya</ButtonLink>} />
      <nav aria-label="Durum" className="inline-flex w-fit flex-wrap rounded-full border border-line bg-glass p-1">
        {TABS.map((t) => {
          const n = t.id ? (counts.find((c) => c.status === t.id)?._count ?? 0) : total;
          const on = (status ?? "") === t.id;
          return (
            <Link
              key={t.id || "hepsi"}
              href={t.id ? `/marka/kampanyalar?durum=${t.id}` : "/marka/kampanyalar"}
              aria-current={on ? "page" : undefined}
              className={cn("rounded-full px-4 py-1.5 text-[13px] transition-standard", on ? "bg-fg font-medium text-bg" : "text-fg-muted hover:text-fg")}
            >
              {t.label} <span className="tabular-nums opacity-70">{n}</span>
            </Link>
          );
        })}
      </nav>
      {campaigns.length === 0 ? (
        <EmptyState message={status ? "Bu durumda kampanya yok." : "Henüz kampanyanız yok. İlk kampanyanızı adım adım oluşturun."} action={{ label: "Yeni kampanya", href: "/marka/kampanyalar/yeni" }} />
      ) : (
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {campaigns.map(({ view: c, raw }) => {
            const draft = raw.status === "TASLAK";
            const score = scores.get(c.id)?.score ?? null;
            return (
              <li key={c.id}>
                <Link href={draft && !raw.submittedAt ? `/marka/kampanyalar/${c.id}/olustur?adim=ozet` : `/marka/kampanyalar/${c.id}`} className="block h-full rounded-[8px] focus-visible:outline-offset-4">
                  <Card className="flex h-full flex-col gap-4">
                    <div className="flex items-start justify-between gap-4">
                      <h2 className="text-section">{c.name}</h2>
                      <StatusDot tone={campaignTone(raw.status)}>{draft && raw.submittedAt ? "Ajansta" : campaignStatusLabels[raw.status]}</StatusDot>
                    </div>
                    {draft ? (
                      <p className="text-[13px] text-fg-muted">{raw.submittedAt ? "Ajans influencer atamasını ve bedelleri hazırlıyor." : "Taslak: kalan adımları tamamlayıp ajansa gönderin."}</p>
                    ) : (
                      <div className="flex flex-col gap-2">
                        <div className="flex items-baseline justify-between">
                          <span className="text-label text-fg-muted">Skor</span>
                          <span className="text-[26px] leading-none font-semibold tabular-nums">{score == null ? "—" : pct.format(score)}</span>
                        </div>
                        <ProgressBar value={score ?? 0} label={`${c.name} skoru`} />
                      </div>
                    )}
                    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[13px]">
                      <dt className="text-fg-passive">Tarih</dt>
                      <dd className="text-fg-muted tabular-nums">
                        {fmtDate(c.startsAt)} – {fmtDate(c.endsAt)}
                      </dd>
                      <dt className="text-fg-passive">Bütçe</dt>
                      <dd className="text-fg-muted tabular-nums">{Number(c.brandTotalFeeKurus) > 0 ? formatKurus(c.brandTotalFeeKurus) : "—"}</dd>
                      {raw.targetCountries.length ? (
                        <>
                          <dt className="text-fg-passive">Ülke</dt>
                          <dd className="text-fg-muted">{raw.targetCountries.map(countryName).join(", ")}</dd>
                        </>
                      ) : null}
                      <dt className="text-fg-passive">Influencer</dt>
                      <dd className="text-fg-muted tabular-nums">{c.influencers.length || (raw.shortlistInfluencerIds.length ? `${raw.shortlistInfluencerIds.length} önerildi` : 0)}</dd>
                    </dl>
                    <span className="mt-auto text-[13px] font-medium">{draft && !raw.submittedAt ? "Devam et →" : "Aç →"}</span>
                  </Card>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
