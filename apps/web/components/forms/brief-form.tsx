"use client";

import { ActionForm } from "@/components/forms/action-form";
import { Field, Input, Textarea } from "@/components/ui/form";
import { createBriefVersion } from "@/lib/actions/briefs";

export type BriefValues = {
  text: string;
  dos: string[];
  donts: string[];
  hashtags: string[];
  mentions: string[];
  requiredPhrases: string[];
  bannedPhrases: string[];
  disclosureRequired: boolean;
};

/** Yeni brief sürümü; son sürümle önceden doldurulur, kaydetmek yeni sürüm açar. */
export function BriefForm({ campaignId, latest, nextVersion }: { campaignId: string; latest?: BriefValues; nextVersion: number }) {
  return (
    <ActionForm action={createBriefVersion} submitLabel={`v${nextVersion} olarak kaydet`} aria-label="Brief sürümü">
      <input type="hidden" name="campaignId" value={campaignId} />
      <Field label="Brief metni">{(p) => <Textarea {...p} name="text" rows={8} required defaultValue={latest?.text} />}</Field>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field label="Yapılacaklar" hint="Her satıra bir madde.">
          {(p) => <Textarea {...p} name="dos" rows={4} defaultValue={latest?.dos.join("\n")} />}
        </Field>
        <Field label="Yapılmayacaklar" hint="Her satıra bir madde.">
          {(p) => <Textarea {...p} name="donts" rows={4} defaultValue={latest?.donts.join("\n")} />}
        </Field>
        <Field label="Hashtagler" hint="Boşluk veya virgülle ayırın.">
          {(p) => <Input {...p} name="hashtags" defaultValue={latest?.hashtags.join(" ")} placeholder="#lumikis #reklam" />}
        </Field>
        <Field label="Bahsetmeler" hint="Boşluk veya virgülle ayırın.">
          {(p) => <Input {...p} name="mentions" defaultValue={latest?.mentions.join(" ")} placeholder="@lumikozmetik" />}
        </Field>
        <Field label="Zorunlu ifadeler" hint="Her satıra bir ifade.">
          {(p) => <Textarea {...p} name="requiredPhrases" rows={3} defaultValue={latest?.requiredPhrases.join("\n")} />}
        </Field>
        <Field label="Yasaklı ifadeler" hint="Her satıra bir ifade.">
          {(p) => <Textarea {...p} name="bannedPhrases" rows={3} defaultValue={latest?.bannedPhrases.join("\n")} />}
        </Field>
      </div>
      <label className="flex items-center gap-2 text-sm text-fg-muted">
        <input type="checkbox" name="disclosureRequired" defaultChecked={latest?.disclosureRequired ?? true} className="h-4 w-4 accent-[var(--color-fg)]" />
        Reklam/işbirliği ibaresi zorunlu
      </label>
    </ActionForm>
  );
}
