"use client";
import { useTT } from "@/lib/i18n/tt-client";
import { ActionForm } from "@/components/forms/action-form";
import { Button } from "@/components/ui/form";
import { Card, CardTitle } from "@/components/ui/card";
import { setCampaignModeAction } from "@/lib/actions/execution-mode";

/**
 * Marka: kampanyanın yürütme modunu seçer.
 *  - SELF: influencer'ı kendisi atar, yayına kendisi alır.
 *  - AJANS: işi ajansa devreder, ajans yürütür, marka izler.
 * TASLAK iken iki yöne de geçilebilir; AKTIF SELF kampanya yalnız ajansa devredilebilir.
 */
export function ExecutionModeCard({ campaignId, mode, status }: { campaignId: string; mode: "SELF" | "AJANS"; status: string }) {
  const tt = useTT();
  const draft = status === "TASLAK";
  const self = mode === "SELF";
  return (
    <Card interactive={false} className="flex flex-col gap-4">
      <CardTitle>{tt("Bu kampanyayı kim yürütüyor?")}</CardTitle>
      <p className="text-sm text-fg-muted">
        {self
          ? tt("Bu kampanyayı kendiniz yürütüyorsunuz: influencer'ı siz atarsınız, içerik planını siz kurarsınız ve yayına siz alırsınız.")
          : tt("Bu kampanyayı ajansa devrettiniz: influencer ataması, bedeller ve yayın kontrolü ajansta. Siz süreci buradan izlersiniz.")}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-border px-3 py-1 text-[13px] text-fg">
          {self ? tt("Mod: Kendim yürütüyorum") : tt("Mod: Ajans yürütüyor")}
        </span>
      </div>
      <ActionForm action={setCampaignModeAction} aria-label={tt("Yürütme modu")} className="flex flex-row flex-wrap gap-2">
        <input type="hidden" name="campaignId" value={campaignId} />
        {self ? (
          <Button type="submit" name="mode" value="AJANS" variant="secondary" size="sm">{tt("Ajansa devret")}</Button>
        ) : draft ? (
          <Button type="submit" name="mode" value="SELF" size="sm">{tt("Kendim yürüteceğim")}</Button>
        ) : (
          <p className="text-[13px] text-fg-passive">{tt("Yayındaki kampanyayı tekrar kendiniz yürütmek için ajansa yazın.")}</p>
        )}
      </ActionForm>
    </Card>
  );
}
