import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@infulancer/core/db";
import { categoryLabel } from "@infulancer/core/domain/categories";
import {
  campaignStatusLabels,
  contentTypeLabels,
  deliverableStatusLabels,
  formatKurus,
  platformLabels,
  reviewDecisionLabels,
} from "@infulancer/core/domain/labels";
import { audit } from "@infulancer/core/audit";
import { kvkkStatus } from "@infulancer/core/compliance/kvkk";
import { BrandUserForm } from "@/components/forms/brand-forms";
import { Card, CardTitle } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/form";
import { PageHeader } from "@/components/ui/layout";
import { StatusDot } from "@/components/ui/status";
import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { Tabs } from "@/components/ui/tabs";
import { ExternalIcon } from "@/components/icons";
import { PlatformIcon } from "@/components/platform-icon";
import { pct } from "@/lib/format";
import { loadCampaignScores } from "@/lib/queries";
import { deliverableTone } from "@/lib/status-tone";
import { requireActor } from "@/lib/auth-guard";
import { campaignTone } from "@/lib/status-tone";
import { fmtDate, fmtDateTime } from "@/lib/time";

export const metadata: Metadata = { title: "Marka profili" };

/** Marka profili — influencer profiliyle aynı yapı: özet, kategoriler, ilişkiler; düzenleme ayrı sayfada. */
const AUDIT_LABELS: Record<string, string> = {
  BRAND_CREATED: "Marka oluşturuldu",
  BRAND_UPDATED: "Marka bilgileri güncellendi",
  USER_CREATED: "Panel kullanıcısı eklendi",
  CAMPAIGN_CREATED: "Kampanya oluşturuldu",
  CAMPAIGN_UPDATED: "Kampanya güncellendi",
  CAMPAIGN_ACTIVATED: "Kampanya yayına alındı",
  CAMPAIGN_CLOSED: "Kampanya kapatıldı",
  BRAND_PAYMENT_RECEIVED: "Marka ödemesi alındı",
  BRIEF_VERSION_CREATED: "Brief sürümü yazıldı",
  ASSIGNMENT_CREATED: "Influencer atandı",
  CONTRACT_DECISION: "Sözleşme kararı",
};
type TimelineItem = { key: string; at: Date; title: string; detail?: string; href?: string; who?: string };
export default async function BrandProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ sekme?: string }>;
}) {
  await requireActor("ADMIN");
  const { id } = await params;
  const { sekme } = await searchParams;
  const brand = await prisma.brand.findUnique({
    where: { id },
    include: {
      users: { select: { id: true, name: true, email: true }, orderBy: { createdAt: "asc" } },
      campaigns: {
        orderBy: { startsAt: "desc" },
        select: {
          id: true,
          name: true,
          status: true,
          startsAt: true,
          endsAt: true,
          closedAt: true,
          budgetKurus: true,
          brandTotalFeeKurus: true,
          brandPaymentReceivedAt: true,
          briefs: { select: { id: true } },
          assignments: {
            orderBy: { createdAt: "asc" },
            select: {
              id: true,
              feeKurus: true,
              commissionKurus: true,
              contractStatus: true,
              createdAt: true,
              influencer: { select: { id: true, name: true } },
              deliverables: {
                orderBy: { plannedAt: "desc" },
                select: { id: true, platform: true, contentType: true, status: true, plannedAt: true, publishedAt: true, postUrl: true, contractViolation: true },
              },
            },
          },
        },
      },
      categories: { include: { category: { include: { parent: { select: { name: true } } } } }, orderBy: { primary: "desc" } },
      tenantSettings: true,
    },
  });
  if (!brand) notFound();
  const campaignIds = brand.campaigns.map((c) => c.id);
  const assignments = brand.campaigns.flatMap((c) => c.assignments.map((a) => ({ ...a, campaign: c })));
  const deliverables = assignments.flatMap((a) => a.deliverables.map((d) => ({ ...d, assignment: a })));
  const [scores, earned, reviews, conversationStats, history] = await Promise.all([
    loadCampaignScores(campaignIds),
    prisma.ledgerEntry.groupBy({
      by: ["referenceId"],
      where: { reason: "HAKEDIS", account: "INFLUENCER_PAYABLE", referenceType: "Deliverable", referenceId: { in: deliverables.map((d) => d.id) } },
      _sum: { amountKurus: true },
    }),
    prisma.deliverableReview.findMany({
      where: { deliverable: { assignment: { campaignId: { in: campaignIds } } } },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        decision: true,
        note: true,
        createdAt: true,
        deliverableId: true,
        brandUser: { select: { name: true } },
        deliverable: { select: { assignment: { select: { influencer: { select: { name: true } }, campaign: { select: { name: true } } } } } },
      },
    }),
    prisma.conversation.groupBy({ by: ["status"], where: { tenantId: id }, _count: true }),
    audit
      .listMany({
        entities: [
          { entityType: "Brand", entityIds: [id] },
          { entityType: "Campaign", entityIds: campaignIds },
          { entityType: "Assignment", entityIds: assignments.map((a) => a.id) },
          { entityType: "CampaignBrief", entityIds: brand.campaigns.flatMap((c) => c.briefs.map((b) => b.id)) },
          { entityType: "User", entityIds: brand.users.map((u) => u.id) },
        ],
        limit: 200,
      })
      .catch(() => []),
  ]);
  const earnedBy = new Map(earned.map((e) => [e.referenceId, e._sum.amountKurus ?? 0]));
  const actorIds = [...new Set(history.map((h) => h.actorId).filter((x): x is string => !!x))];
  const actors = new Map((await prisma.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, name: true } })).map((u) => [u.id, u.name]));
  const entityHref = (type: string, eid: string): string | undefined => {
    if (type === "Campaign") return `/admin/kampanyalar/${eid}`;
    if (type === "Assignment") {
      const a = assignments.find((x) => x.id === eid);
      return a ? `/admin/kampanyalar/${a.campaign.id}` : undefined;
    }
    if (type === "CampaignBrief") {
      const c = brand.campaigns.find((x) => x.briefs.some((b) => b.id === eid));
      return c ? `/admin/kampanyalar/${c.id}/brief` : undefined;
    }
    return undefined;
  };
  const entityName = (type: string, eid: string): string | undefined => {
    if (type === "Campaign") return brand.campaigns.find((c) => c.id === eid)?.name;
    if (type === "Assignment") {
      const a = assignments.find((x) => x.id === eid);
      return a ? `${a.influencer.name} · ${a.campaign.name}` : undefined;
    }
    if (type === "CampaignBrief") return brand.campaigns.find((x) => x.briefs.some((b) => b.id === eid))?.name;
    if (type === "User") return brand.users.find((u) => u.id === eid)?.name;
    return undefined;
  };
  const timeline: TimelineItem[] = [
    ...history.map((h) => ({
      key: `a:${h.id}`,
      at: h.at,
      title: AUDIT_LABELS[h.action] ?? h.action,
      detail: [entityName(h.entityType, h.entityId), h.action === "CONTRACT_DECISION" && typeof h.data.to === "string" ? h.data.to : undefined]
        .filter(Boolean)
        .join(" · "),
      href: entityHref(h.entityType, h.entityId),
      who: h.actorId ? actors.get(h.actorId) : "Sistem",
    })),
    ...reviews.map((r) => ({
      key: `r:${r.id}`,
      at: r.createdAt,
      title: `Marka incelemesi: ${reviewDecisionLabels[r.decision]}`,
      detail: `${r.deliverable.assignment.influencer.name} · ${r.deliverable.assignment.campaign.name}${r.note ? ` — ${r.note}` : ""}`,
      href: `/admin/teslimler/${r.deliverableId}`,
      who: r.brandUser.name,
    })),
    ...deliverables
      .filter((d) => d.publishedAt)
      .map((d) => ({
        key: `p:${d.id}`,
        at: d.publishedAt!,
        title: `İçerik yayınlandı: ${platformLabels[d.platform]} ${contentTypeLabels[d.contentType]}`,
        detail: `${d.assignment.influencer.name} · ${d.assignment.campaign.name}`,
        href: `/admin/teslimler/${d.id}`,
      })),
  ].sort((a, b) => b.at.getTime() - a.at.getTime());
  // ── Finans ──
  const billable = brand.campaigns.filter((c) => c.status !== "IPTAL" && c.status !== "TASLAK");
  const collected = billable.filter((c) => c.brandPaymentReceivedAt).reduce((s, c) => s + Number(c.brandTotalFeeKurus), 0);
  const overdueCampaigns = billable.filter((c) => !c.brandPaymentReceivedAt && c.status === "KAPANDI");
  const receivable = billable.filter((c) => !c.brandPaymentReceivedAt).reduce((s, c) => s + Number(c.brandTotalFeeKurus), 0);
  const liveAssignments = assignments.filter((a) => a.contractStatus !== "RED");
  const influencerCost = liveAssignments.reduce((s, a) => s + a.feeKurus, 0);
  const commission = liveAssignments.reduce((s, a) => s + a.commissionKurus, 0);
  const earnedTotal = deliverables.reduce((s, d) => s + (earnedBy.get(d.id) ?? 0), 0);
  // ── Çalışılan influencerlar ──
  const people = new Map<string, { id: string; name: string; campaigns: Set<string>; fee: number; done: number; total: number; last: Date }>();
  for (const a of liveAssignments) {
    const p = people.get(a.influencer.id) ?? { id: a.influencer.id, name: a.influencer.name, campaigns: new Set<string>(), fee: 0, done: 0, total: 0, last: a.createdAt };
    p.campaigns.add(a.campaign.id);
    p.fee += a.feeKurus;
    p.total += a.deliverables.filter((d) => d.status !== "IPTAL").length;
    p.done += a.deliverables.filter((d) => d.status === "YAYINLANDI" || d.status === "TAMAMLANDI").length;
    if (a.createdAt > p.last) p.last = a.createdAt;
    people.set(a.influencer.id, p);
  }
  const published = deliverables.filter((d) => d.publishedAt).sort((a, b) => b.publishedAt!.getTime() - a.publishedAt!.getTime());
  const openConversations = conversationStats.filter((c) => c.status !== "closed").reduce((s, c) => s + c._count, 0);
  const [competitors, number, connections, consents, kvkk, credits, assistants] = await Promise.all([
    prisma.brand.findMany({ where: { id: { in: brand.competitorBrandIds } }, select: { id: true, name: true } }),
    prisma.whatsAppNumber.findUnique({ where: { tenantId: id } }),
    prisma.channelConnection.findMany({ where: { tenantId: id }, select: { id: true, provider: true, status: true } }),
    prisma.consent.groupBy({ by: ["state"], where: { tenantId: id }, _count: true }),
    kvkkStatus(id),
    prisma.creditAccount.findUnique({ where: { tenantId: id } }),
    prisma.agentConfig.count({ where: { tenantId: id, enabled: true } }),
  ]);
  const active = brand.campaigns.filter((c) => c.status === "AKTIF").length;
  const totalFee = brand.campaigns.filter((c) => c.status !== "IPTAL").reduce((s, c) => s + Number(c.brandTotalFeeKurus), 0);

  const general = <div className="flex flex-col gap-6">
      <div className="grid-12">
        <Card interactive={false} className="flex flex-col gap-4 md:col-span-6">
          <CardTitle>Kategoriler ve rakipler</CardTitle>
          <div className="flex flex-wrap gap-2">
            {brand.categories.map((c) => (
              <span key={c.categoryId} className={`rounded-full border px-3 py-1 text-[13px] ${c.primary ? "border-fg text-fg" : "border-border text-fg-muted"}`}>
                {c.primary ? "★ " : ""}
                {categoryLabel(c.category)}
              </span>
            ))}
          </div>
          <p className="text-[13px] text-fg-muted">
            Rakip markalar:{" "}
            {competitors.length
              ? competitors.map((b, i) => (
                  <span key={b.id}>
                    {i ? ", " : ""}
                    <Link href={`/admin/markalar/${b.id}`} className="hover:underline">
                      {b.name}
                    </Link>
                  </span>
                ))
              : "tanımlı değil"}
            . Aynı ana kategorideki markalar da otomatik rakip sayılır (influencer ataması 30 gün engellenir).
          </p>
        </Card>
        <Card interactive={false} className="flex flex-col gap-4 md:col-span-6">
          <CardTitle>İletişim ve sözleşme</CardTitle>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-fg-passive">Yetkili</dt>
            <dd>{brand.contactName}</dd>
            <dt className="text-fg-passive">E-posta</dt>
            <dd>{brand.contactEmail}</dd>
            <dt className="text-fg-passive">Telefon</dt>
            <dd>{brand.contactPhone}</dd>
            <dt className="text-fg-passive">Sözleşme</dt>
            <dd>
              {brand.contractRef ?? "—"}
              {brand.contractStartsAt ? ` · ${fmtDate(brand.contractStartsAt)}` : ""}
            </dd>
          </dl>
        </Card>
      </div>

      <div className="grid-12">
        <Card interactive={false} className="flex flex-col gap-4 md:col-span-12">
          <CardTitle>Panel kullanıcıları</CardTitle>
          {brand.users.length === 0 ? (
            <p className="text-sm text-fg-passive">Henüz kullanıcı yok.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-border text-sm">
              {brand.users.map((u) => (
                <li key={u.id} className="flex justify-between py-2">
                  <span>{u.name}</span>
                  <span className="text-fg-muted">{u.email}</span>
                </li>
              ))}
            </ul>
          )}
          <BrandUserForm brandId={brand.id} />
        </Card>
      </div>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3" aria-label="Kanal ve uyum durumu">
        <Card interactive={false} className="flex flex-col gap-2">
          <CardTitle>Mesaj kanalları</CardTitle>
          <p className="text-sm text-fg-muted">
            WhatsApp: {number ? `${number.displayNumber ?? number.phoneNumberId} · ${number.paymentMethod === "payment_method_confirmed" ? "kurulum tamam" : "ödeme yöntemi bekleniyor"}` : "bağlı değil"}
          </p>
          {connections.map((c) => (
            <StatusDot key={c.id} tone={c.status === "ACTIVE" ? "active" : "critical"}>
              {c.provider} · {c.status}
            </StatusDot>
          ))}
          <p className="text-[13px] text-fg-passive">{assistants} sohbet asistanı etkin.</p>
          <Link href="/admin/kanallar" className="text-[13px] underline-offset-4 hover:underline">
            Kanallar sayfası →
          </Link>
        </Card>
        <Card interactive={false} className="flex flex-col gap-2">
          <CardTitle>Uyum</CardTitle>
          <StatusDot tone={brand.tenantSettings?.mode === "production" ? "active" : "muted"}>{brand.tenantSettings?.mode === "production" ? "Canlı mod" : "Sandbox (canlı değil)"}</StatusDot>
          <p className="text-sm text-fg-muted">KVKK makbuzu: {kvkk.complete ? "tamam" : `${kvkk.missing.length} eksik`}</p>
          <p className="text-sm text-fg-muted">İYS: {consents.map((c) => `${c.state} ${c._count}`).join(" · ") || "kayıt yok"}</p>
          <Link href="/admin/uyum" className="text-[13px] underline-offset-4 hover:underline">
            Uyum sayfası →
          </Link>
        </Card>
        <Card interactive={false} className="flex flex-col gap-2">
          <CardTitle>Creative bakiyesi</CardTitle>
          <p className="text-[24px] font-semibold tabular-nums">{credits ? Number(credits.balanceCredits) : 0}</p>
          <p className="text-[13px] text-fg-muted">{credits ? `${Number(credits.balanceCredits)} TL bakiye · ${Number(credits.heldCredits)} TL blokede` : "Bakiye hesabı yok"}</p>
          <Link href="/creative" className="text-[13px] underline-offset-4 hover:underline">
            Creative sayfası →
          </Link>
        </Card>
      </section>
  </div>;
  const campaignsTab = (
    <DataTable
      caption="Marka kampanyaları"
      emptyText="Bu markayla henüz kampanya yapılmadı."
      initialSort={{ key: "dates", dir: "desc" }}
      columns={[
        { key: "name", header: "Kampanya", sortable: true },
        { key: "status", header: "Durum", sortable: true },
        { key: "dates", header: "Tarih", sortable: true },
        { key: "people", header: "Influencer", align: "right", sortable: true },
        { key: "done", header: "Yayın", align: "right", sortable: true },
        { key: "score", header: "Skor", align: "right", sortable: true },
        { key: "fee", header: "Marka bedeli", align: "right", sortable: true },
        { key: "paid", header: "Tahsilat", sortable: true },
      ]}
      rows={brand.campaigns.map((c) => {
        const live = c.assignments.filter((a) => a.contractStatus !== "RED");
        const ds = live.flatMap((a) => a.deliverables).filter((d) => d.status !== "IPTAL");
        const done = ds.filter((d) => d.publishedAt).length;
        const sc = scores.get(c.id)?.score ?? null;
        return {
          id: c.id,
          label: c.name,
          cells: {
            name: { display: <Link href={`/admin/kampanyalar/${c.id}`} className="hover:underline">{c.name}</Link>, sort: c.name },
            status: { display: <StatusDot tone={campaignTone(c.status)}>{campaignStatusLabels[c.status]}</StatusDot>, sort: c.status },
            dates: { display: `${fmtDate(c.startsAt)} – ${fmtDate(c.endsAt)}`, sort: c.startsAt.getTime() },
            people: { display: live.length, sort: live.length },
            done: { display: `${done} / ${ds.length}`, sort: done },
            score: { display: sc == null ? "—" : pct.format(sc), sort: sc },
            fee: { display: formatKurus(Number(c.brandTotalFeeKurus)), sort: Number(c.brandTotalFeeKurus) },
            paid: {
              display:
                c.status === "IPTAL" ? "—" : c.brandPaymentReceivedAt ? (
                  <StatusDot tone="active">{fmtDate(c.brandPaymentReceivedAt)}</StatusDot>
                ) : (
                  <StatusDot tone={c.status === "KAPANDI" ? "critical" : "muted"}>{c.status === "KAPANDI" ? "Gecikiyor" : "Bekleniyor"}</StatusDot>
                ),
              sort: c.brandPaymentReceivedAt?.getTime() ?? 0,
            },
          },
          actions: [
            { label: "Kampanyayı aç", href: `/admin/kampanyalar/${c.id}`, icon: "open" as const },
            ...(c.status === "AKTIF" || c.status === "TASLAK" ? [{ label: "Influencer ekle", href: `/admin/kampanyalar/${c.id}?sekme=influencerlar`, icon: "add" as const }] : []),
            { label: "Brief", href: `/admin/kampanyalar/${c.id}/brief`, icon: "file" as const },
          ],
        };
      })}
    />
  );
  const paymentsTab = (
    <div className="flex flex-col gap-6">
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4" aria-label="Ödeme özeti">
        {[
          ["Tahsil edilen", formatKurus(collected), "Ödemesi alınan kampanyalar"],
          ["Bekleyen tahsilat", formatKurus(receivable), `${overdueCampaigns.length} kapanmış kampanyada gecikme`],
          ["Influencer bedelleri", formatKurus(influencerCost), `${formatKurus(earnedTotal)} hakediş oluştu`],
          ["Ajans komisyonu", formatKurus(commission), "Atamalardaki komisyon toplamı"],
        ].map(([l, v, h]) => (
          <Card key={l} interactive={false} className="flex flex-col gap-1">
            <span className="text-label text-fg-muted">{l}</span>
            <span className="text-[22px] font-semibold tabular-nums">{v}</span>
            <span className="text-[12px] text-fg-passive">{h}</span>
          </Card>
        ))}
      </section>
      <Card interactive={false} className="flex flex-col gap-4">
        <CardTitle>Kampanya bazında tahsilat ve maliyet</CardTitle>
        <DataTable
          caption="Tahsilat ve maliyet"
          emptyText="Faturalanacak kampanya yok."
          columns={[
            { key: "name", header: "Kampanya", sortable: true },
            { key: "fee", header: "Marka bedeli", align: "right", sortable: true },
            { key: "cost", header: "Influencer bedeli", align: "right", sortable: true },
            { key: "earned", header: "Hakediş", align: "right", sortable: true },
            { key: "margin", header: "Brüt fark", align: "right", sortable: true },
            { key: "paid", header: "Marka ödemesi", sortable: true },
          ]}
          rows={brand.campaigns
            .filter((c) => c.status !== "IPTAL")
            .map((c) => {
              const live = c.assignments.filter((a) => a.contractStatus !== "RED");
              const cost = live.reduce((s, a) => s + a.feeKurus, 0);
              const earnedC = live.flatMap((a) => a.deliverables).reduce((s, d) => s + (earnedBy.get(d.id) ?? 0), 0);
              const margin = Number(c.brandTotalFeeKurus) - cost;
              return {
                id: c.id,
                label: c.name,
                cells: {
                  name: { display: <Link href={`/admin/kampanyalar/${c.id}`} className="hover:underline">{c.name}</Link>, sort: c.name },
                  fee: { display: formatKurus(Number(c.brandTotalFeeKurus)), sort: Number(c.brandTotalFeeKurus) },
                  cost: { display: formatKurus(cost), sort: cost },
                  earned: { display: formatKurus(earnedC), sort: earnedC },
                  margin: { display: <span className={margin < 0 ? "text-critical" : undefined}>{formatKurus(margin)}</span>, sort: margin },
                  paid: {
                    display: c.brandPaymentReceivedAt ? (
                      <StatusDot tone="active">Alındı · {fmtDate(c.brandPaymentReceivedAt)}</StatusDot>
                    ) : c.status === "KAPANDI" ? (
                      <StatusDot tone="critical">Gecikiyor (kapanış {c.closedAt ? fmtDate(c.closedAt) : "—"})</StatusDot>
                    ) : (
                      <StatusDot tone="muted">{c.status === "TASLAK" ? "Taslak" : "Kampanya sürüyor"}</StatusDot>
                    ),
                    sort: c.brandPaymentReceivedAt?.getTime() ?? 0,
                  },
                },
              };
            })}
        />
        <p className="text-[13px] text-fg-passive">
          Marka ödemesi kampanya sayfasındaki &quot;Marka ödemesi alındı&quot; ile işaretlenir. Influencer ödemeleri hakediş üzerinden Finans sayfasında yürür.
        </p>
      </Card>
    </div>
  );
  const peopleTab =
    people.size === 0 ? (
      <EmptyState message="Bu markayla henüz influencer çalışmadı." />
    ) : (
      <DataTable
        caption="Markayla çalışan influencerlar"
        initialSort={{ key: "last", dir: "desc" }}
        columns={[
          { key: "name", header: "Influencer", sortable: true },
          { key: "campaigns", header: "Kampanya", align: "right", sortable: true },
          { key: "done", header: "Yayın / iş", align: "right", sortable: true },
          { key: "fee", header: "Toplam bedel", align: "right", sortable: true },
          { key: "last", header: "Son atama", sortable: true },
        ]}
        rows={[...people.values()].map((p) => ({
          id: p.id,
          label: p.name,
          cells: {
            name: { display: <Link href={`/admin/influencerlar/${p.id}`} className="hover:underline">{p.name}</Link>, sort: p.name },
            campaigns: { display: p.campaigns.size, sort: p.campaigns.size },
            done: { display: `${p.done} / ${p.total}`, sort: p.done },
            fee: { display: formatKurus(p.fee), sort: p.fee },
            last: { display: fmtDate(p.last), sort: p.last.getTime() },
          },
          actions: [{ label: "Influencer profili", href: `/admin/influencerlar/${p.id}`, icon: "open" as const }],
        }))}
      />
    );
  const contentTab =
    published.length === 0 ? (
      <EmptyState message="Bu marka için yayınlanmış içerik yok." />
    ) : (
      <Card interactive={false} className="flex flex-col gap-2">
        <ul className="flex flex-col divide-y divide-border">
          {published.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
              <span className="flex items-center gap-2">
                <PlatformIcon platform={d.platform} size={16} title={platformLabels[d.platform]} />
                <Link href={`/admin/teslimler/${d.id}`} className="hover:underline">
                  {d.assignment.influencer.name} · {contentTypeLabels[d.contentType]}
                </Link>
              </span>
              <span className="text-[13px] text-fg-muted">{d.assignment.campaign.name} · {fmtDateTime(d.publishedAt!)}</span>
              <span className="flex items-center gap-3">
                <StatusDot tone={deliverableTone(d.status, { violation: d.contractViolation })}>{deliverableStatusLabels[d.status]}</StatusDot>
                {d.postUrl ? (
                  <a href={d.postUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-fg-muted hover:text-fg">
                    Paylaşım <ExternalIcon size={12} />
                    <span className="sr-only">(yeni sekmede açılır)</span>
                  </a>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      </Card>
    );
  const historyTab =
    timeline.length === 0 ? (
      <EmptyState message="Henüz kayıtlı bir hareket yok." />
    ) : (
      <Card interactive={false} className="flex flex-col gap-2">
        <p className="text-[13px] text-fg-passive">
          Marka, kampanya, brief, sözleşme ve ödeme hareketleri değiştirilemez denetim kaydından; marka incelemeleri ve yayınlar teslim kayıtlarından gelir.
        </p>
        <ol className="flex flex-col">
          {timeline.slice(0, 300).map((t) => (
            <li key={t.key} className="grid grid-cols-[140px_1fr] gap-4 border-b border-border py-3 text-sm last:border-b-0">
              <time dateTime={t.at.toISOString()} className="text-[13px] tabular-nums text-fg-passive">
                {fmtDateTime(t.at)}
              </time>
              <span className="flex flex-col gap-0.5">
                <span className="text-fg">{t.href ? <Link href={t.href} className="hover:underline">{t.title}</Link> : t.title}</span>
                {t.detail || t.who ? (
                  <span className="text-[13px] text-fg-muted">
                    {t.detail}
                    {t.detail && t.who ? " · " : ""}
                    {t.who}
                  </span>
                ) : null}
              </span>
            </li>
          ))}
        </ol>
      </Card>
    );
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title={brand.name}
        description={`${brand.categories.find((c) => c.primary)?.category.name ?? brand.category} · VKN ${brand.taxNumber} · ${brand.taxOffice}`}
        actions={
          <div className="flex gap-2">
            <ButtonLink href={`/admin/kampanyalar/yeni?marka=${brand.id}`} variant="secondary">
              Yeni kampanya
            </ButtonLink>
            <ButtonLink href={`/admin/markalar/${brand.id}/duzenle`}>Düzenle</ButtonLink>
          </div>
        }
      />

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4" aria-label="Özet">
        {[
          ["Aktif / toplam kampanya", `${active} / ${brand.campaigns.length}`],
          ["Toplam marka bedeli", formatKurus(totalFee)],
          ["Tahsil edilen", formatKurus(collected)],
          ["Bekleyen tahsilat", formatKurus(receivable)],
          ["Çalışılan influencer", String(people.size)],
          ["Yayınlanan içerik", String(published.length)],
          ["Açık konuşma", String(openConversations)],
          ["Panel kullanıcısı", String(brand.users.length)],
        ].map(([l, v]) => (
          <Card key={l} interactive={false} className="flex flex-col gap-1">
            <span className="text-label text-fg-muted">{l}</span>
            <span className="text-[24px] font-semibold tabular-nums">{v}</span>
          </Card>
        ))}
      </section>

      <Tabs
        key={sekme ?? "genel"}
        label="Marka bölümleri"
        defaultTab={sekme}
        tabs={[
          { id: "genel", label: "Genel", content: general },
          { id: "kampanyalar", label: `Kampanyalar (${brand.campaigns.length})`, content: campaignsTab },
          { id: "odemeler", label: "Ödemeler", content: paymentsTab },
          { id: "influencerlar", label: `Influencerlar (${people.size})`, content: peopleTab },
          { id: "icerikler", label: `İçerikler (${published.length})`, content: contentTab },
          { id: "gecmis", label: `Geçmiş (${timeline.length})`, content: historyTab },
        ]}
      />
    </div>
  );
}
