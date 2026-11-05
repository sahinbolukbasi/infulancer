import { prisma } from "@infulancer/core/db";
import { adGuidance, type GuidanceItem } from "@infulancer/core/ads/guidance";
import type { AdDraftStatus, AdPlatform } from "@infulancer/core/ads/drafts";
import { AdDraftTransition } from "@/components/ads/ad-draft-forms";
import { Card, CardTitle } from "@/components/ui/card";
import { StatusDot } from "@/components/ui/status";
import { fmtDateTime } from "@/lib/time";

const statusLabel: Record<string, string> = { TASLAK: "Taslak", ONAY_BEKLIYOR: "Onay bekliyor", ONAYLANDI: "Onaylandı", REDDEDILDI: "Reddedildi" };
const statusTone: Record<string, "active" | "muted" | "passive" | "critical"> = { TASLAK: "muted", ONAY_BEKLIYOR: "passive", ONAYLANDI: "active", REDDEDILDI: "critical" };
const platformLabel: Record<string, string> = { META: "Meta", TIKTOK: "TikTok" };
const tl = new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 });
const guidanceDot: Record<GuidanceItem["tone"], "active" | "muted" | "passive" | "critical"> = { ipucu: "muted", uyari: "critical", sonraki_adim: "passive" };

/** Reklam taslakları listesi + her birine AI yönlendirmesi ve durum geçişleri. */
export async function AdDraftList({ tenantId, isAdmin }: { tenantId?: string; isAdmin: boolean }) {
  const drafts = await prisma.adDraft.findMany({
    where: tenantId ? { tenantId } : {},
    orderBy: { createdAt: "desc" },
    take: 40,
  });
  if (!drafts.length) return <p className="text-sm text-fg-passive">Henüz reklam taslağı yok. Yukarıdaki formla bir tane oluşturun.</p>;
  return (
    <div className="flex flex-col gap-3">
      {drafts.map((d) => {
        const tips = adGuidance({
          platform: d.platform as AdPlatform,
          objective: d.objective,
          status: d.status as AdDraftStatus,
          dailyBudgetKurus: d.dailyBudgetKurus,
          primaryText: d.primaryText,
          hasAsset: !!d.assetId,
        });
        return (
          <Card key={d.id} interactive={false} className="flex flex-col gap-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex flex-col gap-1">
                <CardTitle>{d.name}</CardTitle>
                <p className="text-[12px] text-fg-muted">
                  {platformLabel[d.platform]} · {d.objective} · {tl.format(d.dailyBudgetKurus / 100)}/gün{d.assetId ? " · görsel bağlı" : ""}
                </p>
              </div>
              <StatusDot tone={statusTone[d.status]}>{statusLabel[d.status]}</StatusDot>
            </div>
            <p className="text-sm text-fg-muted">{d.primaryText}</p>
            {d.reviewNote ? <p className="text-[12px] text-critical">Not: {d.reviewNote}</p> : null}

            <details className="rounded-[8px] border border-border">
              <summary className="cursor-pointer px-3 py-2 text-[13px] text-fg-muted hover:text-fg">AI asistan yönlendirmesi ({tips.length})</summary>
              <ul className="flex flex-col gap-2 border-t border-border p-3 text-[13px]">
                {tips.map((t, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <StatusDot tone={guidanceDot[t.tone]}>{""}</StatusDot>
                    <span className="text-fg-muted">{t.text}</span>
                  </li>
                ))}
              </ul>
            </details>

            <div className="flex flex-wrap items-end gap-2">
              {d.status === "TASLAK" ? <AdDraftTransition id={d.id} to="ONAY_BEKLIYOR" label="Onaya gönder" variant="primary" /> : null}
              {d.status === "REDDEDILDI" ? <AdDraftTransition id={d.id} to="ONAY_BEKLIYOR" label="Yeniden onaya gönder" /> : null}
              {isAdmin && d.status === "ONAY_BEKLIYOR" ? (
                <>
                  <AdDraftTransition id={d.id} to="ONAYLANDI" label="Onayla" variant="primary" />
                  <AdDraftTransition id={d.id} to="REDDEDILDI" label="Reddet" variant="ghost" requireNote />
                </>
              ) : null}
            </div>
            <p className="text-[11px] text-fg-passive">Oluşturuldu: {fmtDateTime(d.createdAt)} · Onay akışı gerçek harcama başlatmaz.</p>
          </Card>
        );
      })}
    </div>
  );
}
