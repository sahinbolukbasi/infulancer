"use client";

import { useState } from "react";
import type { DeliverableStatus } from "@infulancer/core/enums";
import { ActionForm } from "@/components/forms/action-form";
import { Button, Field, Input, Select, Textarea } from "@/components/ui/form";
import { resolveAgentRun } from "@/lib/actions/agent-runs";
import { updateUsageRights } from "@/lib/actions/assets";
import { decideContract } from "@/lib/actions/assignments";
import { closeCampaign, markBrandPaymentReceived } from "@/lib/actions/campaigns";
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
  if (targets.length === 0) return <p className="text-[13px] text-fg-passive">Bu durumdan yapılabilecek geçiş yok.</p>;
  const needsUrl = targets.some((t) => t.value === "YAYINLANDI");
  return (
    <ActionForm action={changeDeliverableStatus} resetOnSuccess aria-label="Durum değiştir">
      <input type="hidden" name="id" value={deliverableId} />
      {needsUrl ? (
        <Field label="Paylaşım bağlantısı" hint="Yayınlandı işaretlemek için zorunlu.">
          {(p) => <Input {...p} name="postUrl" type="url" placeholder="https://www.instagram.com/p/…" defaultValue={currentPostUrl ?? ""} />}
        </Field>
      ) : null}
      {role === "ADMIN" ? (
        <Field label="Not" hint="Revizyon ve iptal için zorunlu; influencer'a bildirilir.">
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
  const [rejecting, setRejecting] = useState(false);
  return (
    <ActionForm action={decideContract} aria-label="Sözleşme kararı" className="gap-3">
      <input type="hidden" name="assignmentId" value={assignmentId} />
      {rejecting && !compact ? (
        <Field label="Red notu (opsiyonel)">{(p) => <Textarea {...p} name="note" rows={2} />}</Field>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" name="decision" value="KABUL" size="sm">
          Kabul et
        </Button>
        {rejecting || compact ? (
          <Button type="submit" name="decision" value="RED" variant="secondary" size="sm">
            Reddet
          </Button>
        ) : (
          <Button variant="ghost" size="sm" onClick={() => setRejecting(true)}>
            Reddet…
          </Button>
        )}
      </div>
    </ActionForm>
  );
}

/** Agent bulgusu: Onayla / Ez + opsiyonel not. */
export function AgentRunResolve({ id }: { id: string }) {
  const [withNote, setWithNote] = useState(false);
  return (
    <ActionForm action={resolveAgentRun} aria-label="Agent bulgusunu sonuçlandır" className="gap-2">
      <input type="hidden" name="id" value={id} />
      {withNote ? <Input name="note" aria-label="Not" placeholder="Not (opsiyonel)" maxLength={1000} className="h-8" /> : null}
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" name="decision" value="ONAYLANDI" size="sm">
          Onayla
        </Button>
        <Button type="submit" name="decision" value="EZILDI" variant="secondary" size="sm">
          Ez
        </Button>
        {!withNote ? (
          <Button variant="ghost" size="sm" onClick={() => setWithNote(true)}>
            Not ekle
          </Button>
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
  return (
    <ActionForm action={updateUsageRights} submitLabel="Hakları kaydet" submitVariant="secondary" submitSize="sm" aria-label="Kullanım hakları" className="gap-3">
      <input type="hidden" name="assetId" value={assetId} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field label="Süre (gün)">
          {(p) => <Input {...p} name="usageDurationDays" type="number" min={0} max={3650} defaultValue={values.usageDurationDays ?? ""} className="h-8" />}
        </Field>
        <Field label="Kanal">
          {(p) => (
            <Select {...p} name="usageChannel" defaultValue={values.usageChannel ?? ""} className="h-8">
              <option value="">Belirtilmedi</option>
              <option value="ORGANIK">Sadece organik</option>
              <option value="PAID_DAHIL">Paid reklam dahil</option>
            </Select>
          )}
        </Field>
        <Field label="Coğrafya" hint="Virgülle: TR, DE">
          {(p) => <Input {...p} name="usageGeography" defaultValue={values.usageGeography.join(", ")} className="h-8" />}
        </Field>
      </div>
    </ActionForm>
  );
}

/** Marka tarafı veri: iş bazında ya da kupon koduyla (atamanın işlerine bölünür). */
export function BrandDataForm({ deliverableId, campaignId }: { deliverableId?: string; campaignId?: string }) {
  const coupon = !deliverableId;
  return (
    <ActionForm action={submitBrandData} submitLabel="Marka verisini kaydet" submitVariant="secondary" resetOnSuccess aria-label="Marka verisi">
      <input type="hidden" name="mode" value={coupon ? "coupon" : "deliverable"} />
      {deliverableId ? <input type="hidden" name="deliverableId" value={deliverableId} /> : null}
      {campaignId ? <input type="hidden" name="campaignId" value={campaignId} /> : null}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        {coupon ? <Field label="Kupon kodu">{(p) => <Input {...p} name="couponCode" required />}</Field> : null}
        <Field label="Tıklama (UTM/kupon)">{(p) => <Input {...p} name="clicks" type="number" min={0} step={1} />}</Field>
        <Field label="Satış (adet)">{(p) => <Input {...p} name="sales" type="number" min={0} step={1} />}</Field>
        <Field label="Ciro (TL)">{(p) => <Input {...p} name="revenue" inputMode="decimal" />}</Field>
      </div>
    </ActionForm>
  );
}

export function CloseCampaignForm({ campaignId }: { campaignId: string }) {
  const [confirming, setConfirming] = useState(false);
  if (!confirming) {
    return (
      <Button variant="secondary" size="sm" onClick={() => setConfirming(true)}>
        Kampanyayı kapat
      </Button>
    );
  }
  return (
    <ActionForm action={closeCampaign} aria-label="Kampanyayı kapat" className="gap-2">
      <input type="hidden" name="id" value={campaignId} />
      <p className="text-[13px] text-fg-muted">Kapanan kampanya düzenlenemez; özet raporu agent&apos;ı çalışır.</p>
      <div className="flex gap-2">
        <Button type="submit" size="sm">
          Evet, kapat
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
          Vazgeç
        </Button>
      </div>
    </ActionForm>
  );
}

export function BrandPaymentForm({ campaignId }: { campaignId: string }) {
  return (
    <ActionForm action={markBrandPaymentReceived} submitLabel="Marka ödemesi alındı" submitVariant="secondary" submitSize="sm" aria-label="Marka ödemesi" className="gap-2">
      <input type="hidden" name="id" value={campaignId} />
      <Field label="Ödeme tarihi" hint="Boşsa bugün.">
        {(p) => <Input {...p} name="receivedAt" type="date" className="h-8" />}
      </Field>
    </ActionForm>
  );
}
