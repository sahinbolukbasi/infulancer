import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@infulancer/core/db";
import { formatKurus } from "@infulancer/core/domain/labels";
import { ReviewApplication } from "@/components/campaigns/open-call-forms";
import { Pill, StatStrip } from "@/components/luma/primitives";
import { WithdrawOffer } from "@/components/offers/offer-forms";
import { Avatar, pickAvatar } from "@/components/ui/avatar";
import { ButtonLink } from "@/components/ui/form";
import { Tabs } from "@/components/ui/tabs";
import { requireActor } from "@/lib/auth-guard";
import { applicationPill, callPill, offerPill } from "@/lib/offers-pills";
import { expiryText, itemsSummary } from "@/lib/offers-view";
import { fmtDate } from "@/lib/time";

export const metadata: Metadata = { title: "Teklifler" };
export const dynamic = "force-dynamic";

/**
 * Marka: iş birliği başlatmanın iki yolu tek yerde. Teklif = marka seçer ve fiyat önerir;
 * başvuru çağrısı = üreticiler başvurur. Kabul edilen başvuru otomatik "kabul edilmiş teklif" olur.
 */
export default async function BrandOffersPage({ searchParams }: { searchParams: Promise<{ sekme?: string }> }) {
  const actor = await requireActor("BRAND");
  const { sekme } = await searchParams;
  const brandId = actor.brandId!;
  const [offers, calls, apps] = await Promise.all([
    prisma.offer.findMany({ where: { brandId }, orderBy: { createdAt: "desc" }, take: 300 }),
    prisma.campaignOpenCall.findMany({ where: { tenantId: brandId }, orderBy: { createdAt: "desc" }, include: { applications: { select: { status: true } } } }),
    prisma.campaignApplication.findMany({ where: { openCall: { tenantId: brandId } }, orderBy: { createdAt: "desc" }, include: { openCall: { select: { id: true, title: true } } } }),
  ]);
  const infIds = [...new Set([...offers.map((o) => o.influencerId), ...apps.map((a) => a.influencerId)])];
  const infs = new Map((await prisma.influencer.findMany({ where: { id: { in: infIds } }, select: { id: true, name: true, category: true, socialAccounts: { select: { platform: true, avatarUrl: true } } } })).map((i) => [i.id, i]));
  const fromApplication = new Set(apps.map((a) => a.offerId).filter(Boolean));
  const pendingApps = apps.filter((a) => a.status === "BASVURULDU" || a.status === "INCELENIYOR");
  const count = (s: string) => offers.filter((o) => o.status === s).length;

  const offerList =
    offers.length === 0 ? (
      <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-line px-6 py-12 text-center">
        <p className="font-medium text-fg">Henüz teklif yok</p>
        <p className="max-w-md text-[13px] text-fg-muted">Influencer bul sayfasından üretici seçip teklif gönderin ya da başvuru çağrısı açın; kabul ettiğiniz başvurular da burada listelenir.</p>
        <ButtonLink href="/marka/kesfet" size="sm">Influencer bul</ButtonLink>
      </div>
    ) : (
      <ul className="flex flex-col divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
        {offers.map((o) => {
          const inf = infs.get(o.influencerId);
          const p = offerPill[o.status] ?? { label: o.status, tone: "gray" as const };
          return (
            <li key={o.id} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center">
              <Avatar name={inf?.name ?? "?"} src={inf ? pickAvatar(inf.socialAccounts) : null} size={40} />
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-fg">{inf?.name ?? "İçerik üreticisi"}</span>
                  <Pill tone={fromApplication.has(o.id) ? "violet" : "gray"}>{fromApplication.has(o.id) ? "Başvurudan" : "Doğrudan teklif"}</Pill>
                </span>
                <span className="text-[14px] text-fg">{o.title}</span>
                <span className="truncate text-[12px] text-fg-muted">{itemsSummary(o.items).join(" · ")}</span>
                {o.responseNote ? <span className="text-[12px] text-fg-muted">Not: {o.responseNote}</span> : null}
              </div>
              <div className="flex items-center gap-4 sm:flex-col sm:items-end sm:gap-1">
                <span className="text-[17px] font-semibold tabular-nums text-fg">{formatKurus(o.totalKurus)}</span>
                <Pill tone={p.tone}>{p.label}</Pill>
                <span className="text-[11px] text-fg-passive">{fmtDate(o.createdAt)} {expiryText(o.expiresAt, o.status)}</span>
              </div>
              {o.status === "GONDERILDI" ? <WithdrawOffer id={o.id} /> : null}
            </li>
          );
        })}
      </ul>
    );

  const appList =
    pendingApps.length === 0 ? (
      <p className="rounded-2xl border border-dashed border-line px-4 py-10 text-center text-[13px] text-fg-muted">Bekleyen başvuru yok. Açık bir çağrınız varsa yeni başvurular burada görünür.</p>
    ) : (
      <ul className="flex flex-col divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
        {pendingApps.map((a) => {
          const inf = infs.get(a.influencerId);
          const p = applicationPill[a.status] ?? { label: a.status, tone: "gray" as const };
          return (
            <li key={a.id} className="flex flex-col gap-3 px-4 py-4">
              <div className="flex flex-wrap items-center gap-3">
                <Avatar name={inf?.name ?? "?"} src={inf ? pickAvatar(inf.socialAccounts) : null} size={36} />
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="font-medium text-fg">{inf?.name ?? "İçerik üreticisi"}{inf?.category ? <span className="font-normal text-fg-muted"> · {inf.category}</span> : null}</span>
                  <Link href={`/marka/teklifler/cagri/${a.openCall.id}`} className="text-[12px] text-fg-muted underline-offset-4 hover:underline">{a.openCall.title}</Link>
                </div>
                {a.quotedKurus != null ? <span className="font-semibold tabular-nums text-fg">{formatKurus(Number(a.quotedKurus))}</span> : null}
                <Pill tone={p.tone}>{p.label}</Pill>
              </div>
              <p className="text-[13px] text-fg-muted">{a.pitch}</p>
              <ReviewApplication id={a.id} />
            </li>
          );
        })}
      </ul>
    );

  const callList =
    calls.length === 0 ? (
      <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-line px-6 py-12 text-center">
        <p className="font-medium text-fg">Henüz başvuru çağrısı yok</p>
        <p className="max-w-md text-[13px] text-fg-muted">Kampanyanızı anlatın, bütçe aralığını ve platformları belirtin; uygun içerik üreticileri size başvursun.</p>
        <ButtonLink href="/marka/teklifler/cagri/yeni" size="sm">Başvuru çağrısı aç</ButtonLink>
      </div>
    ) : (
      <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {calls.map((c) => {
          const p = callPill[c.status] ?? { label: c.status, tone: "gray" as const };
          const fresh = c.applications.filter((a) => a.status === "BASVURULDU").length;
          return (
            <li key={c.id}>
              <Link href={`/marka/teklifler/cagri/${c.id}`} className="flex h-full flex-col gap-2 rounded-2xl border border-line bg-surface p-4 transition-standard hover:border-line-strong">
                <span className="flex flex-wrap items-center gap-2">
                  <Pill tone={p.tone}>{p.label}</Pill>
                  {fresh ? <Pill tone="amber">{fresh} yeni</Pill> : null}
                </span>
                <span className="font-semibold text-fg">{c.title}</span>
                <span className="text-[12px] text-fg-muted">
                  {c.applications.length} başvuru · {c.platforms.join(", ") || "tüm platformlar"}
                  {c.budgetMinKurus != null || c.budgetMaxKurus != null ? ` · ${c.budgetMinKurus != null ? formatKurus(Number(c.budgetMinKurus)) : "?"} – ${c.budgetMaxKurus != null ? formatKurus(Number(c.budgetMaxKurus)) : "?"}` : ""}
                  {c.deadline ? ` · son ${fmtDate(c.deadline)}` : ""}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    );

  const defaultTab = sekme ?? (pendingApps.length ? "basvurular" : "teklifler");
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-title text-fg">Teklifler</h1>
          <p className="max-w-2xl text-[14px] text-fg-muted">İş birliğini iki yoldan başlatın: <strong className="font-medium text-fg">teklif gönderin</strong> (siz seçersiniz) ya da <strong className="font-medium text-fg">başvuru çağrısı açın</strong> (üreticiler size gelir). Kabul ettiğiniz başvuru otomatik teklife dönüşür.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ButtonLink href="/marka/teklifler/cagri/yeni" variant="secondary">+ Başvuru çağrısı</ButtonLink>
          <ButtonLink href="/marka/kesfet">+ Teklif gönder</ButtonLink>
        </div>
      </header>
      <StatStrip
        stats={[
          { label: "Yanıt bekleyen", value: String(count("GONDERILDI")) },
          { label: "Kabul edildi", value: String(count("KABUL")) },
          { label: "Kampanyada", value: String(count("KAMPANYAYA_EKLENDI")) },
          { label: "Reddedildi", value: String(count("RED")) },
          { label: "Açık çağrı", value: String(calls.filter((c) => c.status === "ACIK").length) },
          { label: "Bekleyen başvuru", value: String(pendingApps.length) },
        ]}
      />
      <Tabs
        key={defaultTab}
        label="Teklifler"
        defaultTab={defaultTab}
        tabs={[
          { id: "teklifler", label: `Teklifler (${offers.length})`, content: offerList },
          { id: "basvurular", label: `Gelen başvurular (${pendingApps.length})`, content: appList },
          { id: "cagrilar", label: `Başvuru çağrıları (${calls.length})`, content: callList },
        ]}
      />
    </div>
  );
}
