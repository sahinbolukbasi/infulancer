"use client";
import { useTT } from "@/lib/i18n/tt-client";
import { useState } from "react";
import { ActionForm } from "@/components/forms/action-form";
import { PlatformIcon } from "@/components/platform-icon";
import { Button, Input, Select, Textarea } from "@/components/ui/form";
import { assignFromOfferAction } from "@/lib/actions/assignments";
import { respondOfferAction, saveRateCardAction, withdrawOfferAction } from "@/lib/actions/offers";
import type { Platform } from "@infulancer/core/enums";

export type RateRow = { platform: Platform; platformLabel: string; contentType: string; contentLabel: string; priceTl: string };

/** Fiyat listesi: her platform için içerik türü başına fiyat (boş = sunulmuyor). */
export function RateCardForm({ rows }: { rows: RateRow[] }) {
  const tt = useTT();
  const platforms = [...new Set(rows.map((r) => r.platform))];
  return (
    <ActionForm action={saveRateCardAction} submitLabel={tt("Fiyat listesini kaydet")} aria-label={tt("Fiyat listesi")} className="gap-5">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {platforms.map((p) => (
          <fieldset key={p} className="flex flex-col gap-2 rounded-2xl border border-line bg-glass p-4">
            <legend className="mb-1 flex items-center gap-2 px-1 text-sm font-medium">
              <PlatformIcon platform={p} size={16} /> {rows.find((r) => r.platform === p)?.platformLabel}
            </legend>
            {rows
              .filter((r) => r.platform === p)
              .map((r) => (
                <label key={r.contentType} className="flex items-center justify-between gap-3 text-[13px] text-fg-muted">
                  {r.contentLabel}
                  <span className="relative">
                    <Input name={`p_${r.platform}_${r.contentType}`} defaultValue={r.priceTl} inputMode="decimal" placeholder="—" aria-label={`${r.platformLabel} ${r.contentLabel} fiyatı (TL)`} className="w-32 pr-8 text-right" />
                    <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-[12px] text-fg-passive">{tt("TL")}</span>
                  </span>
                </label>
              ))}
          </fieldset>
        ))}
      </div>
      <p className="text-[12px] text-fg-passive">{tt("Boş bıraktığınız içerik türü markalara sunulmaz. Fiyatlar KDV ve vergi kesintisi öncesi brüt tutardır.")}</p>
    </ActionForm>
  );
}

/** Gelen teklife yanıt: Kabul et / Reddet (not zorunlu). */
export function RespondOffer({ id }: { id: string }) {
  const tt = useTT();
  const [decline, setDecline] = useState(false);
  return (
    <ActionForm action={respondOfferAction} aria-label={tt("Teklife yanıt")} className="gap-2">
      <input type="hidden" name="id" value={id} />
      {decline ? <Textarea name="note" rows={2} required minLength={3} maxLength={1000} placeholder={tt("Neden reddediyorsunuz? (ör. tarih uymuyor, bütçe düşük)")} aria-label={tt("Red notu")} /> : null}
      <div className="flex flex-wrap gap-2">
        {decline ? (
          <>
            <Button type="submit" name="decision" value="RED" variant="secondary" size="sm">{tt("Reddet")}</Button>
            <Button variant="ghost" size="sm" onClick={() => setDecline(false)}>{tt("Vazgeç")}</Button>
          </>
        ) : (
          <>
            <Button type="submit" name="decision" value="KABUL" size="sm">{tt("Kabul et")}</Button>
            <Button variant="secondary" size="sm" onClick={() => setDecline(true)}>{tt("Reddet")}</Button>
          </>
        )}
      </div>
    </ActionForm>
  );
}

export function WithdrawOffer({ id }: { id: string }) {
  const tt = useTT();
  return (
    <ActionForm action={withdrawOfferAction} submitLabel={tt("Geri çek")} submitVariant="ghost" submitSize="sm" aria-label={tt("Teklifi geri çek")} className="gap-1">
      <input type="hidden" name="id" value={id} />
    </ActionForm>
  );
}

/** Ajans: kabul edilen teklifi kampanyaya ekle. */
export function ConvertOffer({ offerId, campaigns, defaultCampaignId }: { offerId: string; campaigns: { id: string; name: string }[]; defaultCampaignId?: string | null }) {
  const tt = useTT();
  if (campaigns.length === 0) return <p className="text-[12px] text-fg-passive">{tt("Markanın açık kampanyası yok; önce kampanya oluşturun.")}</p>;
  return (
    <ActionForm action={assignFromOfferAction} submitLabel={tt("Kampanyaya ekle")} submitSize="sm" aria-label={tt("Kampanyaya ekle")} className="gap-2">
      <input type="hidden" name="offerId" value={offerId} />
      <div className="flex flex-wrap items-center gap-2">
        <Select name="campaignId" defaultValue={defaultCampaignId ?? campaigns[0]?.id} aria-label={tt("Kampanya")} className="h-9 w-56">
          {campaigns.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
        <label className="flex items-center gap-1 text-[12px] text-fg-muted">{tt("Komisyon %")}<Input name="commissionPct" defaultValue="20" inputMode="decimal" className="h-9 w-16" aria-label={tt("Komisyon yüzdesi")} />
        </label>
      </div>
    </ActionForm>
  );
}
