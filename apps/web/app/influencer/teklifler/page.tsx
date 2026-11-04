import type { Metadata } from "next";
import { prisma, type ContentType, type Platform } from "@infulancer/core/db";
import { contentTypeLabels, formatKurus, platformLabels } from "@infulancer/core/domain/labels";
import { platformRules } from "@infulancer/core/domain/platform-rules";
import { RateCardForm, RespondOffer, type RateRow } from "@/components/offers/offer-forms";
import { Card, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/layout";
import { StatusDot } from "@/components/ui/status";
import { Tabs } from "@/components/ui/tabs";
import { requireActor } from "@/lib/auth-guard";
import { expiryText, itemsSummary, statusLabel, statusTone } from "@/lib/offers-view";
import { fmtDate } from "@/lib/time";
export const metadata: Metadata = { title: "Teklifler" };
export const dynamic = "force-dynamic";

export default async function InfluencerOffersPage({ searchParams }: { searchParams: Promise<{ sekme?: string }> }) {
  const actor = await requireActor("INFLUENCER");
  const { sekme } = await searchParams;
  const id = actor.influencerId!;
  const [offers, cards] = await Promise.all([
    prisma.offer.findMany({ where: { influencerId: id }, orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.rateCard.findMany({ where: { influencerId: id, active: true } }),
  ]);
  const brands = new Map((await prisma.brand.findMany({ where: { id: { in: [...new Set(offers.map((o) => o.brandId))] } }, select: { id: true, name: true } })).map((b) => [b.id, b.name]));
  const pending = offers.filter((o) => o.status === "GONDERILDI" && o.expiresAt > new Date());
  const rows: RateRow[] = (Object.entries(platformRules) as [Platform, { contentTypes: readonly ContentType[] }][]).flatMap(([p, r]) =>
    r.contentTypes.map((ct) => {
      const c = cards.find((x) => x.platform === p && x.contentType === ct);
      return { platform: p, platformLabel: platformLabels[p], contentType: ct, contentLabel: contentTypeLabels[ct], priceTl: c ? String(c.priceKurus / 100) : "" };
    }),
  );
  const list = (items: typeof offers, actionable: boolean) =>
    items.length === 0 ? (
      <p className="rounded-2xl border border-dashed border-line p-8 text-center text-sm text-fg-passive">{actionable ? "Yanıt bekleyen teklif yok. Fiyat listenizi doldurun; markalar sizi bulsun." : "Henüz teklif yok."}</p>
    ) : (
      <ul className="flex flex-col gap-3">
        {items.map((o) => (
          <li key={o.id}>
            <Card interactive={false} className="flex flex-col gap-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex flex-col">
                  <span className="text-[12px] text-fg-muted">{brands.get(o.brandId) ?? "Marka"}</span>
                  <span className="text-lg font-semibold">{o.title}</span>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="text-gradient text-2xl font-semibold tabular-nums">{formatKurus(o.totalKurus)}</span>
                  <StatusDot tone={statusTone(o.status)}>{statusLabel(o.status)}</StatusDot>
                </div>
              </div>
              <p className="whitespace-pre-line text-sm text-fg-muted">{o.message}</p>
              <ul className="flex flex-wrap gap-2 text-[12px]">
                {itemsSummary(o.items).map((t) => (
                  <li key={t} className="rounded-full border border-line px-2.5 py-0.5">
                    {t}
                  </li>
                ))}
                {o.publishBy ? <li className="rounded-full border border-line px-2.5 py-0.5">Yayın: {fmtDate(o.publishBy)}</li> : null}
              </ul>
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
                <span className="text-[12px] text-fg-passive">
                  Gönderildi {fmtDate(o.createdAt)} {expiryText(o.expiresAt, o.status)}
                  {o.responseNote ? ` · Notunuz: ${o.responseNote}` : ""}
                </span>
                {actionable && o.status === "GONDERILDI" ? <RespondOffer id={o.id} /> : null}
              </div>
            </Card>
          </li>
        ))}
      </ul>
    );
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Teklifler" description={pending.length ? `${pending.length} teklif yanıtınızı bekliyor.` : "Fiyat listenizi güncel tutun, teklifleri buradan yanıtlayın."} />
      <Tabs
        key={sekme ?? "gelen"}
        label="Teklif bölümleri"
        defaultTab={sekme}
        tabs={[
          { id: "gelen", label: `Yanıt bekleyen (${pending.length})`, content: list(pending, true) },
          { id: "fiyat", label: `Fiyat listem (${cards.length})`, content: (
            <Card interactive={false} className="flex flex-col gap-4">
              <CardTitle>İçerik fiyatlarım</CardTitle>
              <RateCardForm rows={rows} />
            </Card>
          ) },
          { id: "gecmis", label: `Tüm teklifler (${offers.length})`, content: list(offers, false) },
        ]}
      />
    </div>
  );
}
