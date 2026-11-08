import { getTT } from "@/lib/i18n/tt-server";
import Link from "next/link";
import { prisma } from "@infulancer/core/db";
import { campaignSetup } from "@infulancer/core/domain/campaign-setup";
import { cn } from "@/lib/cn";
import { fmtDate } from "@/lib/time";

type Stage = { key: string; title: string; detail: string; progress: number; href?: string };
const PUBLISHED = new Set(["YAYINLANDI", "METRIK_BEKLIYOR", "TAMAMLANDI"]);

/**
 * Kampanya yaşam döngüsü: Planlama → Teklif → Yayın → Ölçüm → Kapanış. Her aşamanın ilerlemesi
 * gerçek kayıtlardan hesaplanır; etkin aşama vurgulanır. `base` admin için bağlantıları açar.
 */
export async function CampaignLifecycle({ campaignId, base }: { campaignId: string; base?: string }) {
  const tt = await getTT();
  const c = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: {
      status: true,
      startsAt: true,
      endsAt: true,
      closedAt: true,
      reportSummary: true,
      brandPaymentReceivedAt: true,
      assignments: {
        where: { contractStatus: { not: "RED" } },
        select: { contractStatus: true, deliverables: { where: { status: { not: "IPTAL" } }, select: { status: true, _count: { select: { metricSnapshots: true } } } } },
      },
    },
  });
  if (!c) return null;
  const setup = await campaignSetup(campaignId);
  const planSteps = setup?.steps.filter((s) => s.key !== "yayin") ?? [];
  const planDone = planSteps.filter((s) => s.done).length;
  const people = c.assignments.length;
  const accepted = c.assignments.filter((a) => a.contractStatus === "KABUL").length;
  const ds = c.assignments.flatMap((a) => a.deliverables);
  const published = ds.filter((d) => PUBLISHED.has(d.status)).length;
  const measured = ds.filter((d) => PUBLISHED.has(d.status) && d._count.metricSnapshots > 0).length;
  const closeParts = [c.status === "KAPANDI", !!c.reportSummary, !!c.brandPaymentReceivedAt].filter(Boolean).length;
  const ratio = (a: number, b: number) => (b ? a / b : 0);
  const stages: Stage[] = [
    { key: "plan", title: "Planlama", detail: `${planDone}/${planSteps.length || 5} adım`, progress: ratio(planDone, planSteps.length || 5), href: base ? `${base}/kurulum` : undefined },
    { key: "teklif", title: "Teklif", detail: people ? `${accepted}/${people} kabul` : "Influencer yok", progress: ratio(accepted, people), href: base ? `${base}?sekme=influencerlar` : undefined },
    { key: "yayin", title: "Yayın", detail: ds.length ? `${published}/${ds.length} paylaşım` : "İş planlanmadı", progress: ratio(published, ds.length), href: base ? `${base}?sekme=teslimler` : undefined },
    { key: "olcum", title: "Ölçüm", detail: published ? `${measured}/${published} metrik` : "Yayın bekleniyor", progress: ratio(measured, published), href: base ? `${base}?sekme=teslimler` : undefined },
    { key: "kapanis", title: "Kapanış", detail: c.status === "KAPANDI" ? (c.brandPaymentReceivedAt ? "Tahsil edildi" : "Tahsilat bekliyor") : `Bitiş ${fmtDate(c.endsAt)}`, progress: closeParts / 3, href: base },
  ];
  const activeIdx = c.status === "IPTAL" ? -1 : Math.max(0, stages.findIndex((s) => s.progress < 1));
  const current = activeIdx === -1 ? stages.length - 1 : activeIdx;
  return (
    <nav aria-label={tt("Kampanya aşamaları")} className="rounded-3xl border border-line bg-glass p-4 backdrop-blur">
      <ol className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {stages.map((s, i) => {
          const done = s.progress >= 1;
          const active = i === current && !done;
          const body = (
            <>
              <span className="flex items-center gap-2 text-[12px]">
                <span
                  aria-hidden
                  className={cn(
                    "inline-flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold",
                    done ? "bg-neon-lime text-black" : active ? "bg-neon-pink text-black" : "border border-line-strong text-fg-passive",
                  )}
                >
                  {done ? "✓" : i + 1}
                </span>
                <span className={active ? "font-medium text-fg" : done ? "text-fg" : "text-fg-muted"}>{s.title}</span>
              </span>
              <span className="h-1.5 overflow-hidden rounded-full bg-line">
                <span className={cn("block h-full rounded-full transition-all", done ? "bg-neon-lime" : "bg-neon")} style={{ width: `${Math.round(s.progress * 100)}%` }} />
              </span>
              <span className="text-[12px] tabular-nums text-fg-muted">{s.detail}</span>
            </>
          );
          const cls = cn("flex flex-col gap-2 rounded-2xl p-2 transition-standard", active && "bg-surface ring-1 ring-neon-pink/40", s.href && "hover:bg-surface-hover");
          return (
            <li key={s.key} aria-current={active ? "step" : undefined}>
              {s.href ? (
                <Link href={s.href} className={cls}>
                  {body}
                </Link>
              ) : (
                <div className={cls}>{body}</div>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
