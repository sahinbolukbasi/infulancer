import type { Metadata } from "next";
import { prisma } from "@infulancer/core/db";
import { formatKurus } from "@infulancer/core/domain/labels";
import { WithdrawOffer } from "@/components/offers/offer-forms";
import { Avatar, pickAvatar } from "@/components/ui/avatar";
import { ButtonLink } from "@/components/ui/form";
import { PageHeader } from "@/components/ui/layout";
import { StatusDot } from "@/components/ui/status";
import { requireActor } from "@/lib/auth-guard";
import { expiryText, itemsSummary, statusLabel, statusTone } from "@/lib/offers-view";
import { fmtDate } from "@/lib/time";
export const metadata: Metadata = { title: "Teklifler" };
export const dynamic = "force-dynamic";

export default async function BrandOffersPage() {
  const actor = await requireActor("BRAND");
  const offers = await prisma.offer.findMany({ where: { brandId: actor.brandId! }, orderBy: { createdAt: "desc" }, take: 200 });
  const infs = new Map(
    (await prisma.influencer.findMany({ where: { id: { in: [...new Set(offers.map((o) => o.influencerId))] } }, select: { id: true, name: true, socialAccounts: { select: { platform: true, avatarUrl: true } } } })).map((i) => [i.id, i]),
  );
  const count = (s: string) => offers.filter((o) => o.status === s).length;
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Teklifler"
        description={`${count("GONDERILDI")} yanıt bekliyor · ${count("KABUL") + count("KAMPANYAYA_EKLENDI")} kabul · ${count("RED")} red`}
        actions={<ButtonLink href="/marka/kesfet">+ Yeni teklif</ButtonLink>}
      />
      {offers.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line p-10 text-center text-sm text-fg-passive">Henüz teklif göndermediniz. Influencer bul sayfasından başlayın.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {offers.map((o) => {
            const inf = infs.get(o.influencerId);
            return (
              <li key={o.id} className="flex flex-wrap items-center gap-4 rounded-3xl border border-line bg-glass p-4">
                <Avatar name={inf?.name ?? "?"} src={inf ? pickAvatar(inf.socialAccounts) : null} size={44} />
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="font-medium">
                    {inf?.name ?? "İçerik üreticisi"} · {o.title}
                  </span>
                  <span className="truncate text-[12px] text-fg-muted">{itemsSummary(o.items).join(" · ")}</span>
                  {o.responseNote ? <span className="text-[12px] text-fg">Yanıt: {o.responseNote}</span> : null}
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="text-lg font-semibold tabular-nums">{formatKurus(o.totalKurus)}</span>
                  <StatusDot tone={statusTone(o.status)}>{statusLabel(o.status)}</StatusDot>
                  <span className="text-[11px] text-fg-passive">
                    {fmtDate(o.createdAt)} {expiryText(o.expiresAt, o.status)}
                  </span>
                </div>
                {o.status === "GONDERILDI" ? <WithdrawOffer id={o.id} /> : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
