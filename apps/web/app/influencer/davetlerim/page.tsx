import { getTT } from "@/lib/i18n/tt-server";
import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@infulancer/core/db";
import { couponValueLabel } from "@infulancer/core/coupons/service";
import { AttendanceToggle } from "@/components/events/event-forms";
import { CouponTile } from "@/components/luma/list-items";
import { DateBadge, Pill, type PillTone } from "@/components/luma/primitives";
import { Tabs } from "@/components/ui/tabs";
import { requireActor } from "@/lib/auth-guard";
import { BRAND_NAME } from "@/lib/brand";
import { rangeLabel } from "@/lib/event-format";
import { mediaSrc } from "@/lib/media";
import { fmtDate } from "@/lib/time";

export const metadata: Metadata = { title: "Davetlerim" };
export const dynamic = "force-dynamic";

const inviteView: Record<string, { label: string; tone: PillTone }> = {
  DAVET_EDILDI: { label: "Yanıt bekliyor", tone: "amber" },
  KATILIM_TALEBI: { label: "Talebiniz iletildi", tone: "violet" },
  KABUL: { label: "Katılıyorsunuz", tone: "green" },
  RED: { label: "Katılmıyorsunuz", tone: "gray" },
  IPTAL: { label: "İptal", tone: "red" },
};
const grantView: Record<string, { label: string; tone: PillTone }> = {
  GONDERILDI: { label: "Kullanılabilir", tone: "green" },
  GORULDU: { label: "Kullanılabilir", tone: "green" },
  KULLANILDI: { label: "Kullanıldı", tone: "gray" },
  IPTAL: { label: "İptal", tone: "red" },
};

/** İçerik üreticisinin davetleri (katılım durumunu istediği zaman değiştirir) ve kuponları. */
export default async function InfluencerInvitesPage({ searchParams }: { searchParams: Promise<{ sekme?: string }> }) {
  const tt = await getTT();
  const actor = await requireActor("INFLUENCER");
  const { sekme } = await searchParams;
  const id = actor.influencerId!;
  const [invites, grants] = await Promise.all([
    prisma.eventInvite.findMany({ where: { influencerId: id }, include: { event: true, ticket: true } }),
    prisma.couponGrant.findMany({ where: { influencerId: id }, orderBy: { createdAt: "desc" }, include: { coupon: true } }),
  ]);
  const tenantIds = [...new Set([...invites.map((i) => i.event.tenantId), ...grants.map((g) => g.coupon.tenantId)].filter((x): x is string => !!x))];
  const brands = new Map((await prisma.brand.findMany({ where: { id: { in: tenantIds } }, select: { id: true, name: true } })).map((b) => [b.id, b.name]));
  const now = new Date();
  const visible = invites.filter((i) => i.event.status !== "TASLAK");
  const upcoming = visible.filter((i) => (i.event.endsAt ?? i.event.startsAt) >= now).sort((a, b) => +a.event.startsAt - +b.event.startsAt);
  const past = visible.filter((i) => (i.event.endsAt ?? i.event.startsAt) < now).sort((a, b) => +b.event.startsAt - +a.event.startsAt);

  const eventList = (items: typeof visible, emptyText: string) =>
    items.length === 0 ? (
      <p className="rounded-2xl border border-dashed border-line px-4 py-10 text-center text-[13px] text-fg-muted">{emptyText}</p>
    ) : (
      <ol className="flex flex-col gap-3">
        {items.map((inv) => {
          const e = inv.event;
          const ticket = inv.ticket && inv.ticket.status !== "IPTAL" ? inv.ticket : null;
          const v = inviteView[inv.status] ?? { label: inv.status, tone: "gray" as PillTone };
          const cover = mediaSrc(e.coverImageKey);
          const isPast = (e.endsAt ?? e.startsAt) < now;
          return (
            <li key={inv.id} className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-4 sm:flex-row sm:items-start">
              <DateBadge date={e.startsAt} />
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <Pill tone={v.tone}>{v.label}</Pill>
                  {e.status === "IPTAL" ? <Pill tone="red">{tt("Etkinlik iptal")}</Pill> : null}
                </div>
                <Link href={`/etkinlik/${e.id}`} className="text-[17px] font-semibold leading-snug text-fg underline-offset-4 hover:underline">{e.title}</Link>
                <span className="text-[13px] text-fg-muted">{rangeLabel(e.startsAt, e.endsAt)}</span>
                <span className="truncate text-[13px] text-fg-muted">{e.tenantId ? (brands.get(e.tenantId) ?? tt("Marka")) : BRAND_NAME}{e.venueName || e.city ? ` · ${[e.venueName, e.city].filter(Boolean).join(", ")}` : ""}</span>
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  {!isPast && e.status !== "IPTAL" && inv.status !== "IPTAL" ? <AttendanceToggle inviteId={inv.id} current={inv.status} /> : null}
                  {ticket ? (
                    <Link href={`/bilet/${ticket.id}`} className="inline-flex h-8 items-center rounded-full bg-fg px-3 text-[13px] font-medium text-bg hover:opacity-90">{tt("Biletim")}</Link>
                  ) : null}
                  <Link href={`/etkinlik/${e.id}`} className="text-[13px] font-medium text-fg-muted hover:text-fg">{tt("Etkinlik sayfası →")}</Link>
                  {ticket ? <a href={`/api/etkinlik/${e.id}/ics`} className="text-[13px] text-fg-muted hover:text-fg">{tt("Takvime ekle")}</a> : null}
                </div>
              </div>
              <div className="hidden h-24 w-24 shrink-0 overflow-hidden rounded-xl border border-line sm:block">
                {cover ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={cover} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="h-full w-full bg-[linear-gradient(135deg,var(--color-neon-violet),var(--color-neon-pink))] opacity-80" />
                )}
              </div>
            </li>
          );
        })}
      </ol>
    );

  const coupons =
    grants.length === 0 ? (
      <p className="rounded-2xl border border-dashed border-line px-4 py-10 text-center text-[13px] text-fg-muted">{tt("Henüz size gönderilmiş kupon yok.")}</p>
    ) : (
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {grants.map((g) => {
          const c = g.coupon;
          const expired = !!c.validUntil && c.validUntil < now;
          return (
            <CouponTile
              key={g.id}
              c={{
                id: g.id,
                href: `/kupon/${g.id}`,
                title: c.title,
                brandName: brands.get(c.tenantId) ?? "Marka",
                kindLabel: c.kind === "HEDIYE_CEKI" ? "Hediye çeki" : "Kupon",
                valueLabel: couponValueLabel(c.valueType, c.value),
                statusOverride: grantView[g.status] ?? null,
                accent: c.brandColor ?? "#ff2bd6",
                logoSrc: mediaSrc(c.logoKey),
                validLabel: c.validUntil ? `Son kullanım ${fmtDate(c.validUntil)} · kodu görmek için dokunun` : "Süresiz · kodu görmek için dokunun",
                expired,
              }}
            />
          );
        })}
      </ul>
    );

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-title text-fg">{tt("Davetlerim")}</h1>
        <p className="text-[14px] text-fg-muted">{tt("Etkinlik davetleriniz, biletleriniz ve markalardan gelen kupon ve hediye çekleriniz.")}</p>
      </div>
      <Tabs
        key={sekme ?? "yaklasan"}
        label={tt("Davetlerim")}
        defaultTab={sekme}
        tabs={[
          { id: "yaklasan", label: `Yaklaşan (${upcoming.length})`, content: eventList(upcoming, "Yaklaşan etkinlik davetiniz yok.") },
          { id: "gecmis", label: `Geçmiş (${past.length})`, content: eventList(past, "Geçmiş etkinlik yok.") },
          { id: "kupon", label: `Kuponlar (${grants.length})`, content: coupons },
        ]}
      />
    </div>
  );
}
