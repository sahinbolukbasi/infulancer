import type { Metadata } from "next";
import { prisma } from "@infulancer/core/db";
import { formatKurus } from "@infulancer/core/domain/labels";
import { RespondOffer } from "@/components/offers/offer-forms";
import { Card } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/form";
import { PageHeader } from "@/components/ui/layout";
import { StatusDot } from "@/components/ui/status";
import { Tabs } from "@/components/ui/tabs";
import { requireActor } from "@/lib/auth-guard";
import { expiryText, itemsSummary, statusLabel, statusTone } from "@/lib/offers-view";
import { fmtDate } from "@/lib/time";
export const metadata: Metadata = { title: "Teklifler" };
export const dynamic = "force-dynamic";

export default async function InfluencerOffersPage({ searchParams }: { searchParams: Promise<{ sekme?: string; sonuc?: string }> }) {
  const actor = await requireActor("INFLUENCER");
  const { sekme, sonuc } = await searchParams;
  const id = actor.influencerId!;
  const offers = await prisma.offer.findMany({ where: { influencerId: id }, orderBy: { createdAt: "desc" }, take: 100 });
  const brands = new Map((await prisma.brand.findMany({ where: { id: { in: [...new Set(offers.map((o) => o.brandId))] } }, select: { id: true, name: true } })).map((b) => [b.id, b.name]));
  const pending = offers.filter((o) => o.status === "GONDERILDI" && o.expiresAt > new Date());
  const list = (items: typeof offers, actionable: boolean) =>
    items.length === 0 ? (
      <p className="rounded-2xl border border-dashed border-line p-8 text-center text-sm text-fg-passive">
        {actionable ? "Yanıt bekleyen teklif yok. Fiyat listenizi Profilim&apos;den doldurun; markalar sizi bulsun." : "Henüz teklif yok."}
      </p>
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
      <PageHeader
        title="Teklifler"
        description={pending.length ? `${pending.length} teklif yanıtınızı bekliyor.` : "Gelen teklifleri buradan yanıtlayın."}
        actions={
          <ButtonLink href="/profil?sekme=fiyat" variant="secondary" size="sm">
            Fiyat listem →
          </ButtonLink>
        }
      />
      {sonuc === "kabul" || sonuc === "red" ? (
        <p role="status" className={`rounded-2xl border px-4 py-3 text-sm ${sonuc === "kabul" ? "border-neon-lime/50 bg-neon-lime/10" : "border-line bg-glass"}`}>
          {sonuc === "kabul" ? "✓ Teklifi kabul ettiniz. Ajans kampanyaya ekleyince brief ve tarihler İşlerim'e düşecek." : "Teklifi reddettiniz; markaya notunuz iletildi."}
        </p>
      ) : null}
      <Tabs
        key={sekme ?? "gelen"}
        label="Teklif bölümleri"
        defaultTab={sekme}
        tabs={[
          { id: "gelen", label: `Yanıt bekleyen (${pending.length})`, content: list(pending, true) },
          { id: "gecmis", label: `Tüm teklifler (${offers.length})`, content: list(offers, false) },
        ]}
      />
    </div>
  );
}
