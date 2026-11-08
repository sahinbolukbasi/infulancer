"use client";

import { useTT } from "@/lib/i18n/tt-client";
import { useState } from "react";
import type { DeliverableStatus } from "@infulancer/core/enums";
import { ActionForm } from "@/components/forms/action-form";
import { Button, Field, Input, Select, Textarea } from "@/components/ui/form";
import { resolveAgentRun } from "@/lib/actions/agent-runs";
import { updateUsageRights } from "@/lib/actions/assets";
import { decideContract } from "@/lib/actions/assignments";
import { activateCampaign, closeCampaign, markBrandPaymentReceived } from "@/lib/actions/campaigns";
import { changeDeliverableStatus } from "@/lib/actions/deliverables";
import { submitBrandData } from "@/lib/actions/metrics";

/** İzin verilen durum geçişleri (core allowedTargets'tan gelir). */
export function TransitionPanel({
  deliverableId,
  targets,
  role,
  currentPostUrl,
}: {
  deliverableId: string;
  targets: { value: DeliverableStatus; label: string; backward: boolean }[];
  role: "ADMIN" | "INFLUENCER";
  currentPostUrl?: string | null;
}) {
  const tt = useTT();
  if (targets.length === 0) return <p className="text-[13px] text-fg-passive">{tt("Bu durumdan yapılabilecek geçiş yok.")}</p>;
  const needsUrl = targets.some((t) => t.value === "YAYINLANDI");
  return (
    <ActionForm action={changeDeliverableStatus} resetOnSuccess aria-label={tt("Durum değiştir")}>
      <input type="hidden" name="id" value={deliverableId} />
      {needsUrl ? (
        <Field label={tt("Paylaşım bağlantısı")} hint={tt("Yayınlandı işaretlemek için zorunlu.")}>
          {(p) => <Input {...p} name="postUrl" type="url" placeholder="https://www.instagram.com/p/…" defaultValue={currentPostUrl ?? ""} />}
        </Field>
      ) : null}
      {role === "ADMIN" ? (
        <Field label={tt("Not")} hint={tt("Revizyon ve iptal için zorunlu; influencer'a bildirilir.")}>
          {(p) => <Textarea {...p} name="note" rows={2} />}
        </Field>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {targets.map((t) => (
          <Button key={t.value} type="submit" name="to" value={t.value} variant={t.backward || t.value === "IPTAL" ? "ghost" : t.value === "REVIZYON" ? "secondary" : "primary"} size="sm">
            {t.backward ? `Geri al: ${t.label}` : t.label}
          </Button>
        ))}
      </div>
    </ActionForm>
  );
}

/** Sözleşme kararı (Kabul / Red). */
export function ContractDecision({ assignmentId, compact }: { assignmentId: string; compact?: boolean }) {
  const tt = useTT();
  const [rejecting, setRejecting] = useState(false);
  return (
    <ActionForm action={decideContract} aria-label={tt("Sözleşme kararı")} className="gap-3">
      <input type="hidden" name="assignmentId" value={assignmentId} />
      {rejecting && !compact ? (
        <Field label={tt("Red notu (opsiyonel)")}>{(p) => <Textarea {...p} name="note" rows={2} />}</Field>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" name="decision" value="KABUL" size="sm">{tt("Kabul et")}</Button>
        {rejecting || compact ? (
          <Button type="submit" name="decision" value="RED" variant="secondary" size="sm">{tt("Reddet")}</Button>
        ) : (
          <Button variant="ghost" size="sm" onClick={() => setRejecting(true)}>{tt("Reddet…")}</Button>
        )}
      </div>
    </ActionForm>
  );
}

/** Agent bulgusu: Onayla / Ez + opsiyonel not. */
export function AgentRunResolve({ id }: { id: string }) {
  const tt = useTT();
  const [withNote, setWithNote] = useState(false);
  return (
    <ActionForm action={resolveAgentRun} aria-label={tt("Agent bulgusunu sonuçlandır")} className="gap-2">
      <input type="hidden" name="id" value={id} />
      {withNote ? <Input name="note" aria-label={tt("Not")} placeholder={tt("Not (opsiyonel)")} maxLength={1000} className="h-8" /> : null}
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" name="decision" value="ONAYLANDI" size="sm">{tt("Onayla")}</Button>
        <Button type="submit" name="decision" value="EZILDI" variant="secondary" size="sm">{tt("Ez")}</Button>
        {!withNote ? (
          <Button variant="ghost" size="sm" onClick={() => setWithNote(true)}>{tt("Not ekle")}</Button>
        ) : null}
      </div>
    </ActionForm>
  );
}

/** Kullanım hakları (HAM_DOSYA / TASLAK). */
export function UsageRightsForm({
  assetId,
  values,
}: {
  assetId: string;
  values: { usageDurationDays: number | null; usageChannel: string | null; usageGeography: string[] };
}) {
  const tt = useTT();
  return (
    <ActionForm action={updateUsageRights} submitLabel={tt("Hakları kaydet")} submitVariant="secondary" submitSize="sm" aria-label={tt("Kullanım hakları")} className="gap-3">
      <input type="hidden" name="assetId" value={assetId} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field label={tt("Süre (gün)")}>
          {(p) => <Input {...p} name="usageDurationDays" type="number" min={0} max={3650} defaultValue={values.usageDurationDays ?? ""} className="h-8" />}
        </Field>
        <Field label={tt("Kanal")}>
          {(p) => (
            <Select {...p} name="usageChannel" defaultValue={values.usageChannel ?? ""} className="h-8">
              <option value="">{tt("Belirtilmedi")}</option>
              <option value="ORGANIK">{tt("Sadece organik")}</option>
              <option value="PAID_DAHIL">{tt("Paid reklam dahil")}</option>
            </Select>
          )}
        </Field>
        <Field label={tt("Coğrafya")} hint={tt("Virgülle: TR, DE")}>
          {(p) => <Input {...p} name="usageGeography" defaultValue={values.usageGeography.join(", ")} className="h-8" />}
        </Field>
      </div>
    </ActionForm>
  );
}

/** Marka tarafı veri: iş bazında ya da kupon koduyla (atamanın işlerine bölünür). */
export function BrandDataForm({ deliverableId, campaignId }: { deliverableId?: string; campaignId?: string }) {
  const tt = useTT();
  const coupon = !deliverableId;
  return (
    <ActionForm action={submitBrandData} submitLabel={tt("Marka verisini kaydet")} submitVariant="secondary" resetOnSuccess aria-label={tt("Marka verisi")}>
      <input type="hidden" name="mode" value={coupon ? "coupon" : "deliverable"} />
      {deliverableId ? <input type="hidden" name="deliverableId" value={deliverableId} /> : null}
      {campaignId ? <input type="hidden" name="campaignId" value={campaignId} /> : null}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        {coupon ? <Field label={tt("Kupon kodu")}>{(p) => <Input {...p} name="couponCode" required />}</Field> : null}
        <Field label={tt("Tıklama (UTM/kupon)")}>{(p) => <Input {...p} name="clicks" type="number" min={0} step={1} />}</Field>
        <Field label={tt("Satış (adet)")}>{(p) => <Input {...p} name="sales" type="number" min={0} step={1} />}</Field>
        <Field label={tt("Ciro (TL)")}>{(p) => <Input {...p} name="revenue" inputMode="decimal" />}</Field>
      </div>
    </ActionForm>
  );
}

export function CloseCampaignForm({ campaignId }: { campaignId: string }) {
  const tt = useTT();
  const [confirming, setConfirming] = useState(false);
  if (!confirming) {
    return (
      <Button variant="secondary" size="sm" onClick={() => setConfirming(true)}>{tt("Kampanyayı kapat")}</Button>
    );
  }
  return (
    <ActionForm action={closeCampaign} aria-label={tt("Kampanyayı kapat")} className="gap-2">
      <input type="hidden" name="id" value={campaignId} />
      <p className="text-[13px] text-fg-muted">{tt("Kapanan kampanya düzenlenemez; özet raporu agent'ı çalışır.")}</p>
      <div className="flex gap-2">
        <Button type="submit" size="sm">{tt("Evet, kapat")}</Button>
        <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>{tt("Vazgeç")}</Button>
      </div>
    </ActionForm>
  );
}

export function BrandPaymentForm({ campaignId }: { campaignId: string }) {
  const tt = useTT();
  return (
    <ActionForm action={markBrandPaymentReceived} submitLabel={tt("Marka ödemesi alındı")} submitVariant="secondary" submitSize="sm" aria-label={tt("Marka ödemesi")} className="gap-2">
      <input type="hidden" name="id" value={campaignId} />
      <Field label={tt("Ödeme tarihi")} hint={tt("Boşsa bugün.")}>
        {(p) => <Input {...p} name="receivedAt" type="date" className="h-8" />}
      </Field>
    </ActionForm>
  );
}

/** Kurulum sihirbazının son adımı: kontrollerden geçerse kampanyayı yayına alır. */
export function ActivateCampaignButton({ campaignId }: { campaignId: string }) {
  const tt = useTT();
  return (
    <ActionForm action={activateCampaign} aria-label={tt("Kampanyayı yayına al")}>
      <input type="hidden" name="id" value={campaignId} />
      <Button type="submit">{tt("Kampanyayı yayına al")}</Button>
    </ActionForm>
  );
}
