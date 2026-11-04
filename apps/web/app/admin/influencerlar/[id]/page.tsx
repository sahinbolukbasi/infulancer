import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@infulancer/core/db";
import { computeInfluencerStats, latestReachSnapshot } from "@infulancer/core/domain/influencer-stats";
import {
  formatKurus,
  platformLabels,
  taxStatusLabels,
} from "@infulancer/core/domain/labels";
import { computeBalances, holdDays } from "@infulancer/core/domain/ledger";
import { AgentRunList } from "@/components/agent/agent-run-list";
import { BarChart, LineChart } from "@/components/charts/charts";
import { BalanceCards } from "@/components/finance/balance-cards";
import { PlatformIcon } from "@/components/platform-icon";
import { Card, CardTitle } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/form";
import { PageHeader } from "@/components/ui/layout";
import { requireActor } from "@/lib/auth-guard";
import { WorkHistory } from "@/components/history/work-history";
import { SyncAccountsButton } from "@/components/forms/agent-job-forms";
import { categoryLabel } from "@infulancer/core/domain/categories";
import { syncSourceLabels } from "@infulancer/core/social/sync";
import { compact, pct, pct1 } from "@/lib/format";
import { fmtDate } from "@/lib/time";

export const metadata: Metadata = { title: "Influencer profili" };

const shortDate = new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "short", timeZone: "Europe/Istanbul" });

/** Demografi JSON'undan tek satırlık özet (beklenen şekil: gender, ageGroups, topCities). */
function demographicsSummary(raw: unknown): string {
  const d = (raw ?? {}) as {
    gender?: Record<string, number>;
    ageGroups?: Record<string, number>;
    topCities?: { city?: string; share?: number }[];
  };
  const parts: string[] = [];
  if (d.gender && typeof d.gender.kadin === "number") parts.push(`Kadın ${pct.format(d.gender.kadin)}`);
  const age = Object.entries(d.ageGroups ?? {}).filter(([, v]) => typeof v === "number").sort((a, b) => b[1] - a[1])[0];
  if (age) parts.push(`${age[0]} yaş ${pct.format(age[1])}`);
  const city = Array.isArray(d.topCities) ? d.topCities[0] : undefined;
  if (city?.city && typeof city.share === "number") parts.push(`${city.city} ${pct.format(city.share)}`);
  return parts.join(" · ") || "Demografi verisi yok";
}

export default async function InfluencerProfilePage({ params }: { params: Promise<{ id: string }> }) {
  await requireActor("ADMIN");
  const { id } = await params;
  const now = new Date();
  const inf = await prisma.influencer.findUnique({
    where: { id },
    include: {
      user: { select: { email: true } },
      categories: { orderBy: { primary: "desc" }, include: { category: { include: { parent: { select: { name: true } } } } } },
      socialAccounts: { orderBy: { followers: "desc" }, include: { snapshots: { orderBy: { takenAt: "asc" } } } },
      assignments: {
        orderBy: { createdAt: "desc" },
        include: {
          campaign: { select: { id: true, name: true, status: true, startsAt: true, endsAt: true, brand: { select: { name: true } } } },
          deliverables: {
            orderBy: { plannedAt: "asc" },
            select: {
              id: true,
              platform: true,
              contentType: true,
              status: true,
              plannedAt: true,
              publishedAt: true,
              metricSnapshots: { select: { measuredAt: true, reach: true } },
            },
          },
        },
      },
    },
  });
  if (!inf) notFound();

  const deliverableIds = inf.assignments.flatMap((a) => a.deliverables.map((d) => d.id));
  const [stats, balances, runs] = await Promise.all([
    computeInfluencerStats([inf.id], now),
    computeBalances(inf.id, now),
    prisma.agentRun.findMany({
      where: {
        OR: [
          { targetType: "Influencer", targetId: inf.id },
          { targetType: "Deliverable", targetId: { in: deliverableIds } },
          { targetType: "Assignment", targetId: { in: inf.assignments.map((a) => a.id) } },
        ],
      },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      include: { resolvedBy: { select: { name: true } } },
      take: 50,
    }),
  ]);
  const st = stats.get(inf.id);

  const published = inf.assignments
    .filter((a) => a.contractStatus !== "RED")
    .flatMap((a) => a.deliverables.filter((d) => d.publishedAt && d.status !== "IPTAL").map((d) => ({ ...d, campaignName: a.campaign.name })))
    .sort((a, b) => a.publishedAt!.getTime() - b.publishedAt!.getTime())
    .slice(-12);
  const reachBars = published.map((d) => ({
    label: shortDate.format(d.publishedAt!),
    value: latestReachSnapshot(d.metricSnapshots)?.reach ?? 0,
  }));

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title={inf.name}
        description={`${inf.city ? `${inf.city} · ` : ""}${taxStatusLabels[inf.taxStatus]}${inf.canIssueInvoice ? "" : " · fatura kesemiyor"} · ${inf.user?.email ?? "giriş hesabı yok"}`}
        actions={
          <div className="flex gap-2">
            <SyncAccountsButton influencerId={inf.id} />
            <ButtonLink href={`/admin/influencerlar/${inf.id}/duzenle`}>Düzenle</ButtonLink>
          </div>
        }
      />
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2" aria-label="Kategoriler">
          {inf.categories.map((c) => (
            <span key={c.categoryId} className={`rounded-full border px-3 py-1 text-[13px] ${c.primary ? "border-fg text-fg" : "border-border text-fg-muted"}`}>
              {c.primary ? "★ " : ""}
              {categoryLabel(c.category)}
            </span>
          ))}
        </div>
        {inf.bio ? <p className="max-w-3xl text-sm text-fg-muted">{inf.bio}</p> : null}
      </div>

      <section aria-label="Hesaplar" className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {inf.socialAccounts.map((a) => (
          <Card key={a.id} interactive={false} className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2 text-sm text-fg">
                <PlatformIcon platform={a.platform} size={18} title={platformLabels[a.platform]} />
                {a.handle}
              </span>
              <span className="text-[12px] text-fg-passive">{platformLabels[a.platform]}</span>
            </div>
            <dl className="grid grid-cols-2 gap-2">
              <div>
                <dt className="text-label text-fg-muted">Takipçi</dt>
                <dd className="text-[24px] font-semibold tabular-nums">{compact.format(a.followers)}</dd>
              </div>
              <div>
                <dt className="text-label text-fg-muted">ER</dt>
                <dd className="text-[24px] font-semibold tabular-nums">{pct1.format(Number(a.engagementRate))}</dd>
              </div>
            </dl>
            <p className="text-[13px] text-fg-muted">{demographicsSummary(a.demographics)}</p>
            {a.postsCount != null || a.avgLikes != null || a.avgViews != null ? (
              <p className="text-[12px] text-fg-muted">
                {a.postsCount != null ? `${compact.format(a.postsCount)} gönderi` : ""}
                {a.avgLikes != null ? ` · ort. ${compact.format(a.avgLikes)} beğeni` : ""}
                {a.avgComments != null ? ` · ${compact.format(a.avgComments)} yorum` : ""}
                {a.avgViews != null ? ` · ort. ${compact.format(a.avgViews)} izlenme` : ""}
              </p>
            ) : null}
            <p className="text-[12px] text-fg-passive">
              Kaynak: {syncSourceLabels[a.syncSource] ?? a.syncSource}
              {a.lastSyncedAt ? ` · son senkron ${fmtDate(a.lastSyncedAt)}` : " · henüz senkronlanmadı"}
            </p>
            {a.syncError ? <p className="text-[12px] text-critical">{a.syncError}</p> : null}
            {a.profileUrl ? (
              <a href={a.profileUrl} target="_blank" rel="noopener noreferrer" className="text-[12px] text-fg-muted underline-offset-4 hover:underline">
                Profili aç <span className="sr-only">(yeni sekmede açılır)</span>
              </a>
            ) : null}
          </Card>
        ))}
        {inf.socialAccounts.length === 0 ? <p className="text-sm text-fg-passive">Kayıtlı hesap yok.</p> : null}
      </section>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card interactive={false} className="flex flex-col gap-1">
          <span className="text-label text-fg-muted">Tamamlanan kampanya</span>
          <span className="text-metric tabular-nums">{st?.completedCampaigns ?? 0}</span>
        </Card>
        <Card interactive={false} className="flex flex-col gap-1">
          <span className="text-label text-fg-muted">Zamanında teslim</span>
          <span className="text-metric tabular-nums">{st?.onTimeRate == null ? "—" : pct.format(st.onTimeRate)}</span>
          <span className="text-[13px] text-fg-passive">{st ? `${st.onTimeCount} / ${st.publishedCount} yayın (≤ 30 dk)` : ""}</span>
        </Card>
        <Card interactive={false} className="flex flex-col gap-1">
          <span className="text-label text-fg-muted">Ortalama performans</span>
          <span className="text-metric tabular-nums">
            {st?.performance == null ? "—" : st.performance.kind === "ERISIM_ORANI" ? pct.format(st.performance.value) : pct1.format(st.performance.value)}
          </span>
          <span className="text-[13px] text-fg-passive">
            {st?.performance?.kind === "ERISIM_ORANI" ? "Erişim / kişi başı hedef" : st?.performance ? "Ortalama ER" : "Ölçüm yok"}
          </span>
        </Card>
        <Card interactive={false} className="flex flex-col gap-1">
          <span className="text-label text-fg-muted">Risk skoru</span>
          <span className={`text-metric tabular-nums ${inf.riskScore != null && inf.riskScore >= 70 ? "text-critical" : ""}`}>{inf.riskScore ?? "—"}</span>
          <span className="text-[13px] text-fg-passive">
            {st?.activeExclusivities.length
              ? `Münhasırlık: ${st.activeExclusivities.map((e) => `${e.category} (${fmtDate(e.until)})`).join(", ")}`
              : "Aktif münhasırlık yok"}
          </span>
        </Card>
      </div>

      <section aria-label="Performans grafikleri" className="grid-12">
        {inf.socialAccounts.map((a) => (
          <Card key={a.id} interactive={false} className="flex flex-col gap-4 md:col-span-6">
            <CardTitle className="flex items-center gap-2">
              <PlatformIcon platform={a.platform} size={16} /> {a.handle}
            </CardTitle>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="flex flex-col gap-1">
                <span className="text-label text-fg-muted">ER</span>
                <LineChart
                  label={`${a.handle} ER geçmişi`}
                  format={(v) => pct1.format(v)}
                  points={a.snapshots.map((s) => ({ label: shortDate.format(s.takenAt), value: Number(s.engagementRate) }))}
                />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-label text-fg-muted">Takipçi</span>
                <LineChart
                  label={`${a.handle} takipçi geçmişi`}
                  format={(v) => compact.format(v)}
                  points={a.snapshots.map((s) => ({ label: shortDate.format(s.takenAt), value: s.followers }))}
                />
              </div>
            </div>
          </Card>
        ))}
        <Card interactive={false} className="flex flex-col gap-4 md:col-span-12">
          <CardTitle>İçerik başına erişim (son 12 yayın)</CardTitle>
          <BarChart label="İçerik başına erişim" format={(v) => compact.format(v)} bars={reachBars} />
        </Card>
      </section>

      <section aria-label="Bakiye" className="flex flex-col gap-4">
        <h2 className="text-section">Bakiye</h2>
        <BalanceCards balances={balances} holdDays={holdDays()} />
        <p className="text-[13px] text-fg-passive">
          Toplam ödenen: {formatKurus(st?.totalPaidKurus ?? 0)} ·{" "}
          <Link href="/admin/finans" className="hover:text-fg">
            Finans ekranı →
          </Link>
        </p>
      </section>

      <Card interactive={false} className="flex flex-col gap-4">
        <CardTitle>İş ve ödeme geçmişi</CardTitle>
        <WorkHistory influencerId={inf.id} mode="admin" />
      </Card>

      <Card interactive={false} className="flex flex-col gap-4">
        <CardTitle>Agent bulguları</CardTitle>
        <AgentRunList runs={runs.map((r) => ({ ...r, resolvedByName: r.resolvedBy?.name }))} emptyText="Bu influencer için agent bulgusu yok." />
      </Card>
    </div>
  );
}
