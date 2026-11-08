"use client";

import { useTT } from "@/lib/i18n/tt-client";
import { useState, useTransition } from "react";
import { ActionForm } from "@/components/forms/action-form";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { createAssignment, previewBrandConflict } from "@/lib/actions/assignments";

/**
 * Kampanyaya influencer ekleme. Seçimde marka çakışması kontrol edilir; çakışma
 * varsa bulgular gösterilir ve ezme gerekçesi (en az 10 karakter) istenir.
 */
export function AssignmentForm({ campaignId, influencers }: { campaignId: string; influencers: { id: string; name: string; category: string }[] }) {
  const tt = useTT();
  const [influencerId, setInfluencerId] = useState("");
  const [conflicts, setConflicts] = useState<string[]>([]);
  const [checking, startCheck] = useTransition();

  const onSelect = (id: string) => {
    setInfluencerId(id);
    setConflicts([]);
    if (!id) return;
    startCheck(async () => {
      const res = await previewBrandConflict({ campaignId, influencerId: id });
      setConflicts(res.conflicts);
    });
  };

  return (
    <ActionForm
      action={createAssignment}
      submitLabel={conflicts.length ? tt("Gerekçeyle ata") : tt("Influencer ata")}
      resetOnSuccess
      onSuccess={() => {
        setInfluencerId("");
        setConflicts([]);
      }}
      aria-label={tt("Influencer atama")}
    >
      <input type="hidden" name="campaignId" value={campaignId} />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Field label={tt("Influencer")} className="md:col-span-3">
          {(p) => (
            <Select {...p} name="influencerId" required value={influencerId} onChange={(e) => onSelect(e.target.value)}>
              <option value="">{tt("Influencer seçin")}</option>
              {influencers.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name} · {i.category}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label={tt("Influencer bedeli (TL)")}>{(p) => <Input {...p} name="fee" required inputMode="decimal" placeholder="45000" />}</Field>
        <Field label={tt("Ajans komisyonu (TL)")}>{(p) => <Input {...p} name="commission" inputMode="decimal" placeholder="9000" />}</Field>
        <Field label={tt("Kupon kodu")}>{(p) => <Input {...p} name="couponCode" placeholder={tt("ZEYNEP15")} />}</Field>
        <Field label={tt("Münhasırlık (gün)")} hint={tt("Kampanya bitişinden itibaren.")}>
          {(p) => <Input {...p} name="exclusivityDays" type="number" min={0} max={365} defaultValue={0} />}
        </Field>
        <Field label={tt("Münhasırlık kategorisi")} hint={tt("Boşsa marka kategorisi.")}>
          {(p) => <Input {...p} name="exclusivityCategory" />}
        </Field>
      </div>
      <div aria-live="polite">
        {checking ? <p className="text-[13px] text-fg-muted">{tt("Marka çakışması kontrol ediliyor…")}</p> : null}
        {conflicts.length > 0 ? (
          <div className="flex flex-col gap-3 rounded-[8px] border border-critical/40 p-4">
            <p className="text-sm text-critical">{tt("Marka çakışması — atama engellendi")}</p>
            <ul className="list-disc pl-4 text-[13px] text-fg-muted">
              {conflicts.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
            <Field label={tt("Ezme gerekçesi (zorunlu, en az 10 karakter)")} hint={tt("Gerekçe audit log'a ve agent kaydına yazılır.")}>
              {(p) => <Textarea {...p} name="overrideReason" rows={3} required minLength={10} />}
            </Field>
          </div>
        ) : null}
      </div>
    </ActionForm>
  );
}
