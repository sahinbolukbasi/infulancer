"use client";

import { useTT } from "@/lib/i18n/tt-client";
import { ActionForm } from "@/components/forms/action-form";
import { Button, Field, Textarea } from "@/components/ui/form";
import { submitBrandReview } from "@/lib/actions/reviews";

/** Marka taslak görüşü: Onaylıyorum / Revizyon istiyorum + not (durumu ajans değiştirir). */
export function DeliverableReview({ deliverableId }: { deliverableId: string }) {
  const tt = useTT();
  return (
    <ActionForm action={submitBrandReview} resetOnSuccess aria-label={tt("Taslak görüşü")} className="gap-3">
      <input type="hidden" name="deliverableId" value={deliverableId} />
      <Field label={tt("Not")} hint={tt("Revizyon isterken zorunlu; ajansınıza iletilir.")}>
        {(p) => <Textarea {...p} name="note" rows={2} maxLength={2000} />}
      </Field>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" name="decision" value="ONAY" size="sm">{tt("Onaylıyorum")}</Button>
        <Button type="submit" name="decision" value="REVIZYON" variant="secondary" size="sm">{tt("Revizyon istiyorum")}</Button>
      </div>
    </ActionForm>
  );
}
