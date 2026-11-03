import type { Metadata } from "next";
import Link from "next/link";
import { toBrandCampaignView } from "@infulancer/core/access/dto";
import { prisma } from "@infulancer/core/db";
import { campaignStatusLabels, formatKurus } from "@infulancer/core/domain/labels";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader, Stagger } from "@/components/ui/layout";
import { ProgressBar } from "@/components/ui/progress";
import { StatusDot } from "@/components/ui/status";
import { requireActor } from "@/lib/auth-guard";
import { pct } from "@/lib/format";
import { loadCampaignScores } from "@/lib/queries";
import { campaignTone } from "@/lib/status-tone";
import { fmtDate } from "@/lib/time";

export const metadata: Metadata = { title: "Kampanyalarım" };

export default async function BrandHomePage() {
  const actor = await requireActor("BRAND");
  const rows = await prisma.campaign.findMany({
    where: { brandId: actor.brandId!, status: { not: "TASLAK" } },
    orderBy: [{ startsAt: "desc" }],
    include: { assignments: { include: { influencer: { select: { id: true, name: true } } } } },
  });
  // Marka ekranına yalnız DTO (bütçe/bedel/komisyon yok).
  const campaigns = rows.map((c) => toBrandCampaignView(c));
  const [scores, pending] = await Promise.all([
    loadCampaignScores(campaigns.map((c) => c.id)),
    prisma.deliverable.findMany({
      where: {
        status: "ICERIK_YUKLENDI",
        assignment: { contractStatus: { not: "RED" }, campaign: { brandId: actor.brandId! } },
      },
      select: { assignment: { select: { campaignId: true } } },
    }),
  ]);
  const pendingByCampaign = new Map<string, number>();
  for (const p of pending) {
    const cid = p.assignment.campaignId;
    pendingByCampaign.set(cid, (pendingByCampaign.get(cid) ?? 0) + 1);
  }

  return (
    <Stagger className="flex flex-col gap-8">
      <PageHeader title="Kampanyalarım" description="Kampanya skorları, yayın takvimi ve onayınızı bekleyen taslaklar." />
      {campaigns.length === 0 ? (
        <EmptyState
          message="Ajansınız bir kampanya başlattığında skoru ve raporu burada görünecek."
          action={{ label: "Sayfayı yenile", href: "/marka" }}
        />
      ) : (
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {campaigns.map((c) => {
            const score = scores.get(c.id)?.score ?? null;
            const waiting = pendingByCampaign.get(c.id) ?? 0;
            return (
              <li key={c.id}>
                <Link href={`/marka/kampanyalar/${c.id}`} className="block h-full rounded-[8px] focus-visible:outline-offset-4">
                  <Card className="flex h-full flex-col gap-5">
                    <div className="flex items-start justify-between gap-4">
                      <h2 className="text-section">{c.name}</h2>
                      <StatusDot tone={campaignTone(c.status)}>{campaignStatusLabels[c.status]}</StatusDot>
                    </div>
                    <div className="flex flex-col gap-2">
                      <div className="flex items-baseline justify-between">
                        <span className="text-label text-fg-muted">Skor</span>
                        <span className="text-[28px] leading-none font-semibold tabular-nums">{score == null ? "—" : pct.format(score)}</span>
                      </div>
                      <ProgressBar value={score ?? 0} label={`${c.name} skoru`} />
                    </div>
                    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[13px]">
                      <dt className="text-fg-passive">Tarih</dt>
                      <dd className="text-fg-muted tabular-nums">
                        {fmtDate(c.startsAt)} – {fmtDate(c.endsAt)}
                      </dd>
                      <dt className="text-fg-passive">Toplam ödenen</dt>
                      <dd className="text-fg-muted tabular-nums">{formatKurus(c.brandTotalFeeKurus)}</dd>
                      <dt className="text-fg-passive">Influencer</dt>
                      <dd className="text-fg-muted tabular-nums">{c.influencers.length}</dd>
                    </dl>
                    {waiting > 0 ? (
                      <p className="text-[13px] text-fg">
                        {waiting} taslak görüşünüzü bekliyor
                      </p>
                    ) : null}
                  </Card>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Stagger>
  );
}
