import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@infulancer/core/db";
import { computeInfluencerStats } from "@infulancer/core/domain/influencer-stats";
import { categoryTree } from "@infulancer/core/domain/categories";
import { activeFilterCount, parseFilters, searchInfluencerIds } from "@infulancer/core/domain/influencer-search";
import { InfluencerFilterBar } from "@/components/influencer/filter-bar";
import { formatKurus, platformLabels } from "@infulancer/core/domain/labels";
import { PlatformIcon } from "@/components/platform-icon";
import { DataTable } from "@/components/ui/data-table";
import { ButtonLink } from "@/components/ui/form";
import { PageHeader, Stagger } from "@/components/ui/layout";
import { Sparkline } from "@/components/ui/metric-card";
import { StatusDot } from "@/components/ui/status";
import { requireActor } from "@/lib/auth-guard";
import { Avatar, pickAvatar } from "@/components/ui/avatar";
import { compact, pct, pct1 } from "@/lib/format";
import { fmtDate } from "@/lib/time";

export const metadata: Metadata = { title: "Influencerlar" };

export default async function InfluencersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireActor("ADMIN");
  const now = new Date();
  const sp = await searchParams;
  const filters = parseFilters(sp);
  const active = activeFilterCount(filters);
  const [ids, total, tree] = await Promise.all([searchInfluencerIds(filters), prisma.influencer.count(), categoryTree()]);
  const [influencersRaw, stats] = await Promise.all([
    prisma.influencer.findMany({
      where: { id: { in: ids } },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        category: true,
        city: true,
        categories: { orderBy: { primary: "desc" }, select: { primary: true, category: { select: { name: true, parent: { select: { name: true } } } } } },
        riskScore: true,
        user: { select: { email: true } },
        socialAccounts: { orderBy: { followers: "desc" }, select: { platform: true, handle: true, followers: true, avatarUrl: true } },
      },
    }),
    computeInfluencerStats(ids, now),
  ]);
  const maxFollowers = (i: (typeof influencersRaw)[number]) => Math.max(0, ...i.socialAccounts.map((a) => a.followers));
  const influencers = [...influencersRaw].sort((a, b) => {
    if (filters.sort === "followers") return maxFollowers(b) - maxFollowers(a);
    if (filters.sort === "er") return (stats.get(b.id)?.erTrend.at(-1) ?? 0) - (stats.get(a.id)?.erTrend.at(-1) ?? 0);
    if (filters.sort === "risk") return (a.riskScore ?? 0) - (b.riskScore ?? 0);
    return a.name.localeCompare(b.name, "tr");
  });

  return (
    <Stagger className="flex flex-col gap-8">
      <PageHeader
        title="Influencerlar"
        description="Hesaplar, ER trendi, teslim disiplini, performans, risk ve ödemeler."
        actions={<ButtonLink href="/admin/influencerlar/yeni">Yeni influencer</ButtonLink>}
      />
      <InfluencerFilterBar categories={tree} sp={sp} count={influencers.length} total={total} active={active} />
      <DataTable
        caption="Influencer takip listesi"
        emptyText={active ? "Filtrelere uyan influencer yok. Filtreleri gevşetin." : "Henüz influencer yok."}
        initialSort={filters.sort === "followers" ? { key: "accounts", dir: "desc" } : { key: "name", dir: "asc" }}
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
            label: i.name,
            cells: {
              name: {
                display: (
                  <Link href={`/admin/influencerlar/${i.id}`} className="flex items-start gap-3 text-fg hover:underline">
                    <Avatar name={i.name} src={pickAvatar(i.socialAccounts)} size={36} />
                    <span className="flex flex-col">
                    {i.name}
                    <span className="flex flex-wrap gap-1 pt-1">
                      {i.categories.slice(0, 3).map((c, idx) => (
                        <span key={idx} className={`rounded-full border px-2 py-0.5 text-[11px] ${c.primary ? "border-fg-muted text-fg-muted" : "border-border text-fg-passive"}`}>
                          {c.category.parent ? `${c.category.parent.name} › ` : ""}
                          {c.category.name}
                        </span>
                      ))}
                    </span>
                    <span className="text-[12px] text-fg-passive">
                      {i.city ? `${i.city} · ` : ""}
                      {i.user?.email ?? "Giriş hesabı yok"}
                    </span>
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
              { label: "Profil", href: `/admin/influencerlar/${i.id}`, icon: "open" },
              { label: "Düzenle", href: `/admin/influencerlar/${i.id}/duzenle` },
            ],
          };
        })}
      />
    </Stagger>
  );
}
