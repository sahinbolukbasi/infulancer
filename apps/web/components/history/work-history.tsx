import { getTT } from "@/lib/i18n/tt-server";
import Link from "next/link";
import { prisma } from "@infulancer/core/db";
import { formatKurus, payoutStatusLabels } from "@infulancer/core/domain/labels";
import { StatusDot } from "@/components/ui/status";
import { contractTone, contractUiLabels } from "@/lib/status-tone";
import { fmtDate } from "@/lib/time";

const PUBLISHED = new Set(["YAYINLANDI", "METRIK_BEKLIYOR", "TAMAMLANDI"]);

/**
 * Influencer iş ve ödeme geçmişi — admin profilinde ve influencer'ın kendi Ödemeler sayfasında
 * aynı veriyle gösterilir. `mode="admin"` kampanya/teslim bağlantılarını admin sayfalarına verir.
 */
export async function WorkHistory({ influencerId, mode }: { influencerId: string; mode: "admin" | "influencer" }) {
  const tt = await getTT();
  const [assignments, payouts] = await Promise.all([
    prisma.assignment.findMany({
      where: { influencerId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        feeKurus: true,
        contractStatus: true,
        createdAt: true,
        campaign: { select: { id: true, name: true, startsAt: true, endsAt: true, brand: { select: { name: true } } } },
        deliverables: { select: { id: true, status: true, postUrl: true } },
      },
    }),
    prisma.payoutRequest.findMany({ where: { influencerId }, orderBy: { createdAt: "desc" }, select: { id: true, amountKurus: true, status: true, createdAt: true, sentAt: true } }),
  ]);
  const earned = await prisma.ledgerEntry.groupBy({
    by: ["referenceId"],
    where: { influencerId, reason: "HAKEDIS", account: "INFLUENCER_PAYABLE", referenceType: "Deliverable" },
    _sum: { amountKurus: true },
  });
  const earnedBy = new Map(earned.map((e) => [e.referenceId, e._sum.amountKurus ?? 0]));
  const totalEarned = earned.reduce((s, e) => s + (e._sum.amountKurus ?? 0), 0);
  const paid = payouts.filter((p) => p.status === "GONDERILDI").reduce((s, p) => s + p.amountKurus, 0);
  const pending = payouts.filter((p) => p.status !== "GONDERILDI" && p.status !== "REDDEDILDI").reduce((s, p) => s + p.amountKurus, 0);
  const campaignHref = (id: string) => (mode === "admin" ? `/admin/kampanyalar/${id}` : undefined);
  const jobHref = (id: string) => (mode === "admin" ? `/admin/teslimler/${id}` : `/influencer/isler/${id}`);

  return (
    <div className="flex flex-col gap-5">
      <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          ["İş", String(assignments.filter((a) => a.contractStatus !== "RED").length)],
          ["Toplam hakediş", formatKurus(totalEarned)],
          ["Ödenen", formatKurus(paid)],
          ["Ödeme sürecinde", formatKurus(pending)],
        ].map(([k, v]) => (
          <div key={k} className="rounded-2xl border border-line bg-glass p-4">
            <dt className="text-[12px] text-fg-muted">{k}</dt>
            <dd className="text-xl font-semibold tabular-nums">{v}</dd>
          </div>
        ))}
      </dl>

      <section aria-labelledby="wh-jobs" className="flex flex-col gap-2">
        <h3 id="wh-jobs" className="text-sm font-medium">{tt("İşler")}</h3>
        {assignments.length === 0 ? (
          <p className="text-sm text-fg-passive">{tt("Henüz iş yok.")}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-line rounded-2xl border border-line">
            {assignments.map((a) => {
              const live = a.deliverables.filter((d) => d.status !== "IPTAL");
              const pub = live.filter((d) => PUBLISHED.has(d.status));
              const got = a.deliverables.reduce((s, d) => s + (earnedBy.get(d.id) ?? 0), 0);
              const ch = campaignHref(a.campaign.id);
              return (
                <li key={a.id} className="flex flex-col gap-2 px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="flex flex-col">
                      {ch ? (
                        <Link href={ch} className="text-sm text-fg hover:underline">
                          {a.campaign.name}
                        </Link>
                      ) : (
                        <span className="text-sm text-fg">{a.campaign.name}</span>
                      )}
                      <span className="text-[12px] text-fg-muted">
                        {a.campaign.brand.name} · {fmtDate(a.campaign.startsAt)} – {fmtDate(a.campaign.endsAt)}
                      </span>
                    </span>
                    <span className="flex items-center gap-4 text-[13px] tabular-nums">
                      <span className="text-fg-muted">{tt("Bedel")}{" "}{formatKurus(a.feeKurus)}</span>
                      <span className="text-fg">{tt("Hakediş")}{" "}{formatKurus(got)}</span>
                      <StatusDot tone={contractTone(a.contractStatus)}>{contractUiLabels[a.contractStatus]}</StatusDot>
                    </span>
                  </div>
                  {live.length ? (
                    <div className="flex flex-wrap items-center gap-2 text-[12px]">
                      <span className="text-fg-passive tabular-nums">
                        {pub.length}/{live.length}{" "}{tt("yayında")}</span>
                      {live.map((d) => (
                        <Link
                          key={d.id}
                          href={jobHref(d.id)}
                          className={`rounded-full border px-2 py-0.5 ${PUBLISHED.has(d.status) ? "border-neon-lime/50 text-fg" : "border-line text-fg-muted"} hover:border-neon-pink`}
                        >
                          {PUBLISHED.has(d.status) ? "✓ " : ""}{tt("İş")}</Link>
                      ))}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section aria-labelledby="wh-pay" className="flex flex-col gap-2">
        <h3 id="wh-pay" className="text-sm font-medium">{tt("Ödemeler")}</h3>
        {payouts.length === 0 ? (
          <p className="text-sm text-fg-passive">{tt("Henüz ödeme talebi yok.")}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-line rounded-2xl border border-line">
            {payouts.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-[13px]">
                <span className="tabular-nums text-fg-muted">{tt("Talep")}{" "}{fmtDate(p.createdAt)}
                  {p.sentAt ? ` · gönderildi ${fmtDate(p.sentAt)}` : ""}
                </span>
                <span className="flex items-center gap-4">
                  <span className="font-medium tabular-nums">{formatKurus(p.amountKurus)}</span>
                  <StatusDot tone={p.status === "GONDERILDI" ? "active" : p.status === "REDDEDILDI" ? "critical" : "muted"}>{payoutStatusLabels[p.status]}</StatusDot>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
