import { getTT } from "@/lib/i18n/tt-server";
import type { Metadata } from "next";
import { prisma } from "@infulancer/core/db";
import { formatKurus } from "@infulancer/core/domain/labels";
import { ApplyForm } from "@/components/campaigns/open-call-forms";
import { Pill, StatStrip } from "@/components/luma/primitives";
import { RespondOffer } from "@/components/offers/offer-forms";
import { ButtonLink } from "@/components/ui/form";
import { Tabs } from "@/components/ui/tabs";
import { requireActor } from "@/lib/auth-guard";
import { applicationPill, offerPill } from "@/lib/offers-pills";
import { expiryText, itemsSummary } from "@/lib/offers-view";
import { fmtDate } from "@/lib/time";

export const metadata: Metadata = { title: "Teklifler" };
export const dynamic = "force-dynamic";

/**
 * İçerik üreticisi: markalardan gelen teklifler ve markaların açık çağrıları tek yerde.
 * Açık çağrıya başvuru marka kabul edince bu listede "kabul edilmiş teklif" olarak görünür.
 */
export default async function InfluencerOffersPage({ searchParams }: { searchParams: Promise<{ sekme?: string; sonuc?: string }> }) {
  const tt = await getTT();
  const actor = await requireActor("INFLUENCER");
  const { sekme, sonuc } = await searchParams;
  const id = actor.influencerId!;
  const now = new Date();
  const [offers, open, mine] = await Promise.all([
    prisma.offer.findMany({ where: { influencerId: id }, orderBy: { createdAt: "desc" }, take: 200 }),
    prisma.campaignOpenCall.findMany({ where: { status: "ACIK", OR: [{ deadline: null }, { deadline: { gte: now } }] }, orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.campaignApplication.findMany({ where: { influencerId: id }, orderBy: { createdAt: "desc" }, include: { openCall: { select: { title: true, tenantId: true } } } }),
  ]);
  const brands = new Map(
    (await prisma.brand.findMany({ where: { id: { in: [...new Set([...offers.map((o) => o.brandId), ...open.map((c) => c.tenantId), ...mine.map((m) => m.openCall.tenantId)])] } }, select: { id: true, name: true } })).map((b) => [b.id, b.name]),
  );
  const applied = new Set(mine.map((m) => m.openCallId));
  const fromApplication = new Set(mine.map((m) => m.offerId).filter(Boolean));
  const pending = offers.filter((o) => o.status === "GONDERILDI" && o.expiresAt > now);
  const openNotApplied = open.filter((c) => !applied.has(c.id));

  const offerCards = (items: typeof offers, actionable: boolean, emptyText: string) =>
    items.length === 0 ? (
      <p className="rounded-2xl border border-dashed border-line px-4 py-10 text-center text-[13px] text-fg-muted">{emptyText}</p>
    ) : (
      <ul className="flex flex-col gap-3">
        {items.map((o) => {
          const p = offerPill[o.status] ?? { label: o.status, tone: "gray" as const };
          return (
            <li key={o.id} className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex flex-col gap-1">
                  <span className="flex flex-wrap items-center gap-2 text-[12px] text-fg-muted">
                    {brands.get(o.brandId) ?? tt("Marka")}
                    <Pill tone={fromApplication.has(o.id) ? "violet" : "gray"}>{fromApplication.has(o.id) ? tt("Başvurunuzdan") : tt("Size özel teklif")}</Pill>
                  </span>
                  <span className="text-[17px] font-semibold text-fg">{o.title}</span>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="text-xl font-semibold tabular-nums text-fg">{formatKurus(o.totalKurus)}</span>
                  <Pill tone={p.tone}>{p.label}</Pill>
                </div>
              </div>
              <p className="whitespace-pre-line text-[14px] text-fg-muted">{o.message}</p>
              <ul className="flex flex-wrap gap-2 text-[12px] text-fg">
                {itemsSummary(o.items).map((t) => (
                  <li key={t} className="rounded-full border border-line px-2.5 py-0.5">{t}</li>
                ))}
                {o.publishBy ? <li className="rounded-full border border-line px-2.5 py-0.5">{tt("Yayın:")}{" "}{fmtDate(o.publishBy)}</li> : null}
              </ul>
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
                <span className="text-[12px] text-fg-passive">
                  {fmtDate(o.createdAt)} {expiryText(o.expiresAt, o.status)}
                  {o.responseNote ? ` · Not: ${o.responseNote}` : ""}
                </span>
                {actionable && o.status === "GONDERILDI" ? <RespondOffer id={o.id} /> : null}
              </div>
            </li>
          );
        })}
      </ul>
    );

  const calls =
    openNotApplied.length === 0 ? (
      <p className="rounded-2xl border border-dashed border-line px-4 py-10 text-center text-[13px] text-fg-muted">{tt("Şu an başvurabileceğiniz açık çağrı yok.")}</p>
    ) : (
      <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {openNotApplied.map((c) => (
          <li key={c.id} className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-5">
            <div className="flex flex-col gap-1">
              <span className="text-[12px] text-fg-muted">{brands.get(c.tenantId) ?? tt("Marka")}</span>
              <span className="text-[17px] font-semibold text-fg">{c.title}</span>
              <span className="text-[12px] text-fg-muted">
                {c.platforms.join(", ") || tt("Tüm platformlar")}
                {c.budgetMinKurus != null || c.budgetMaxKurus != null ? ` · ${c.budgetMinKurus != null ? formatKurus(Number(c.budgetMinKurus)) : "?"} – ${c.budgetMaxKurus != null ? formatKurus(Number(c.budgetMaxKurus)) : "?"}` : ""}
                {c.deadline ? ` · son başvuru ${fmtDate(c.deadline)}` : ""}
              </span>
            </div>
            <p className="line-clamp-4 whitespace-pre-line text-[13px] text-fg-muted">{c.description}</p>
            <details className="rounded-xl border border-line">
              <summary className="cursor-pointer px-3 py-2 text-[13px] font-medium text-fg">{tt("Başvur")}</summary>
              <div className="border-t border-line p-3"><ApplyForm openCallId={c.id} /></div>
            </details>
          </li>
        ))}
      </ul>
    );

  const applications =
    mine.length === 0 ? (
      <p className="rounded-2xl border border-dashed border-line px-4 py-10 text-center text-[13px] text-fg-muted">{tt("Henüz bir çağrıya başvurmadınız.")}</p>
    ) : (
      <ul className="flex flex-col divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
        {mine.map((m) => {
          const p = applicationPill[m.status] ?? { label: m.status, tone: "gray" as const };
          return (
            <li key={m.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <span className="flex flex-col">
                <span className="font-medium text-fg">{m.openCall.title}</span>
                <span className="text-[12px] text-fg-muted">{brands.get(m.openCall.tenantId) ?? tt("Marka")} · {fmtDate(m.createdAt)}{m.quotedKurus != null ? ` · ${formatKurus(Number(m.quotedKurus))}` : ""}</span>
              </span>
              <Pill tone={p.tone}>{p.label}</Pill>
            </li>
          );
        })}
      </ul>
    );

  const defaultTab = sekme ?? (pending.length ? "gelen" : "cagrilar");
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-title text-fg">{tt("Teklifler")}</h1>
          <p className="text-[14px] text-fg-muted">{tt("Markaların size gönderdiği teklifler ve başvurabileceğiniz açık çağrılar.")}</p>
        </div>
        <ButtonLink href="/profil?sekme=fiyat" variant="secondary" size="sm">{tt("Fiyat listem")}</ButtonLink>
      </header>
      {sonuc === "kabul" || sonuc === "red" ? (
        <p role="status" className="rounded-2xl border border-line bg-surface px-4 py-3 text-[14px] text-fg">
          {sonuc === "kabul" ? tt("Teklifi kabul ettiniz. Ajans kampanyaya ekleyince brief ve tarihler İşlerim'e düşecek.") : tt("Teklifi reddettiniz; markaya notunuz iletildi.")}
        </p>
      ) : null}
      <StatStrip
        stats={[
          { label: "Yanıt bekleyen", value: String(pending.length) },
          { label: "Kabul ettiğim", value: String(offers.filter((o) => o.status === "KABUL" || o.status === "KAMPANYAYA_EKLENDI").length) },
          { label: "Açık çağrı", value: String(openNotApplied.length) },
          { label: "Başvurularım", value: String(mine.length) },
          { label: "Kabul edilen başvuru", value: String(mine.filter((m) => m.status === "KABUL").length) },
          { label: "Toplam teklif", value: String(offers.length) },
        ]}
      />
      <Tabs
        key={defaultTab}
        label={tt("Teklifler")}
        defaultTab={defaultTab}
        tabs={[
          { id: "gelen", label: `Yanıt bekleyen (${pending.length})`, content: offerCards(pending, true, "Yanıt bekleyen teklif yok. Fiyat listenizi doldurun; markalar sizi bulsun.") },
          { id: "cagrilar", label: `Açık çağrılar (${openNotApplied.length})`, content: calls },
          { id: "basvurularim", label: `Başvurularım (${mine.length})`, content: applications },
          { id: "gecmis", label: `Tüm teklifler (${offers.length})`, content: offerCards(offers, false, "Henüz teklif yok.") },
        ]}
      />
    </div>
  );
}
