import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@infulancer/core/db";
import { computeInfluencerStats } from "@infulancer/core/domain/influencer-stats";
import { formatKurus, platformLabels } from "@infulancer/core/domain/labels";
import { PlatformIcon } from "@/components/platform-icon";
import { DataTable } from "@/components/ui/data-table";
import { ButtonLink } from "@/components/ui/form";
import { PageHeader, Stagger } from "@/components/ui/layout";
import { Sparkline } from "@/components/ui/metric-card";
import { StatusDot } from "@/components/ui/status";
import { requireActor } from "@/lib/auth-guard";
import { compact, pct, pct1 } from "@/lib/format";
import { fmtDate } from "@/lib/time";

export const metadata: Metadata = { title: "Influencerlar" };

export default async function InfluencersPage() {
  await requireActor("ADMIN");
  const now = new Date();
  const [influencers, stats] = await Promise.all([
    prisma.influencer.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        category: true,
        riskScore: true,
        user: { select: { email: true } },
        socialAccounts: { orderBy: { followers: "desc" }, select: { platform: true, handle: true, followers: true } },
      },
    }),
    computeInfluencerStats(undefined, now),
  ]);

  return (
    <Stagger className="flex flex-col gap-8">
      <PageHeader
        title="Influencerlar"
        description="Hesaplar, ER trendi, teslim disiplini, performans, risk ve ödemeler."
        actions={<ButtonLink href="/admin/influencerlar/yeni">Yeni influencer</ButtonLink>}
      />
      <DataTable
        caption="Influencer takip listesi"
        emptyText="Henüz influencer yok."
        initialSort={{ key: "name", dir: "asc" }}
        columns={[
          { key: "name", header: "Influencer", sortable: true },
          { key: "accounts", header: "Hesaplar", sortable: true },
          { key: "er", header: "ER trendi", sortable: true },
          { key: "completed", header: "Tamamlanan", align: "right", sortable: true },
          { key: "onTime", header: "Zamanında", align: "right", sortable: true },
          { key: "performance", header: "Ort. performans", align: "right", sortable: true },
          { key: "risk", header: "Risk", align: "right", sortable: true },
          { key: "exclusivity", header: "Münhasırlık", sortable: true },
          { key: "paid", header: "Toplam ödenen", align: "right", sortable: true },
        ]}
        rows={influencers.map((i) => {
          const st = stats.get(i.id);
          const followers = i.socialAccounts.reduce((sum, a) => sum + a.followers, 0);
          const lastEr = st?.erTrend.at(-1) ?? null;
          const excl = st?.activeExclusivities ?? [];
          return {
            id: i.id,
            cells: {
              name: {
                display: (
                  <Link href={`/admin/influencerlar/${i.id}`} className="flex flex-col text-fg hover:underline">
                    {i.name}
                    <span className="text-[12px] text-fg-passive">
                      {i.category} · {i.user?.email ?? "Giriş hesabı yok"}
                    </span>
                  </Link>
                ),
                sort: i.name,
              },
              accounts: {
                display: (
                  <span className="flex flex-col gap-1">
                    {i.socialAccounts.map((a) => (
                      <span key={a.platform} className="inline-flex items-center gap-2 text-fg-muted">
                        <PlatformIcon platform={a.platform} size={14} title={platformLabels[a.platform]} />
                        <span className="tabular-nums">{compact.format(a.followers)}</span>
                      </span>
                    ))}
                  </span>
                ),
                sort: followers,
              },
              er: {
                display: (
                  <span className="flex items-center gap-3">
                    {st && st.erTrend.length > 1 ? <Sparkline data={st.erTrend} className="w-20 text-fg-muted" /> : null}
                    <span className="tabular-nums text-fg-muted">{lastEr == null ? "—" : pct1.format(lastEr)}</span>
                  </span>
                ),
                sort: lastEr,
              },
              completed: { display: st?.completedCampaigns ?? 0, sort: st?.completedCampaigns ?? 0 },
              onTime: {
                display: st?.onTimeRate == null ? "—" : `${pct.format(st.onTimeRate)} (${st.onTimeCount}/${st.publishedCount})`,
                sort: st?.onTimeRate ?? null,
              },
              performance: {
                display:
                  st?.performance == null ? "—" : st.performance.kind === "ERISIM_ORANI" ? (
                    <span title="Erişim / kişi başı erişim hedefi">{pct.format(st.performance.value)} hedef</span>
                  ) : (
                    <span title="Ortalama etkileşim oranı">{pct1.format(st.performance.value)} ER</span>
                  ),
                sort: st?.performance?.value ?? null,
              },
              risk: {
                display:
                  i.riskScore == null ? (
                    "—"
                  ) : (
                    <StatusDot tone={i.riskScore >= 70 ? "critical" : i.riskScore >= 40 ? "muted" : "passive"} className="justify-end">
                      {i.riskScore}
                    </StatusDot>
                  ),
                sort: i.riskScore,
              },
              exclusivity: {
                display:
                  excl.length === 0 ? (
                    <span className="text-fg-passive">Yok</span>
                  ) : (
                    <span className="flex flex-col text-[13px]">
                      {excl.map((e) => (
                        <span key={e.campaignId}>
                          {e.category} · {fmtDate(e.until)}&apos;e kadar
                        </span>
                      ))}
                    </span>
                  ),
                sort: excl.length,
              },
              paid: { display: formatKurus(st?.totalPaidKurus ?? 0), sort: st?.totalPaidKurus ?? 0 },
            },
            actions: [
              { label: "Profil", href: `/admin/influencerlar/${i.id}` },
              { label: "Düzenle", href: `/admin/influencerlar/${i.id}/duzenle` },
            ],
          };
        })}
      />
    </Stagger>
  );
}
