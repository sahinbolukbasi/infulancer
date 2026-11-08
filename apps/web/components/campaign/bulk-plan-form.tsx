"use client";
import { useState } from "react";
import type { Platform } from "@infulancer/core/enums";
import type { ContentPlanItem } from "@infulancer/core/domain/campaign-plan";
import { ActionForm } from "@/components/forms/action-form";
import { Button, Field, Input, Select, Textarea } from "@/components/ui/form";
import { applyContentPlanBulk } from "@/lib/actions/deliverables-bulk";
import { defaultPlanRow, PlanEditor, type PlanRow } from "./wizard/wizard-steps";

export type BulkAssignment = { id: string; name: string; tz: string; deliverables: number };

/**
 * Ajans: içerik planını seçilen tüm influencerlara tek seferde uygular (kişi kişi form doldurmak yerine).
 * Varsayılan seçim: henüz içeriği olmayanlar. Plan, markanın sihirbazda girdiği plandan gelir.
 */
export function BulkPlanForm({
  campaignId,
  assignments,
  plan,
  platforms,
  defaults,
}: {
  campaignId: string;
  assignments: BulkAssignment[];
  plan: ContentPlanItem[];
  platforms: Platform[];
  defaults: { hashtags: string[]; mentions: string[]; geo: string[]; startDay: string; disclosureRequired: boolean };
}) {
  const [rows, setRows] = useState<PlanRow[]>(plan.length ? plan : [defaultPlanRow(platforms)]);
  const [picked, setPicked] = useState<Set<string>>(() => new Set(assignments.filter((a) => a.deliverables === 0).map((a) => a.id)));
  const all = assignments.length > 0 && picked.size === assignments.length;
  return (
    <ActionForm action={applyContentPlanBulk} aria-label="Toplu içerik planı" submitLabel={`Planı ${picked.size} influencer'a uygula`} className="gap-5">
      <input type="hidden" name="campaignId" value={campaignId} />
      <input type="hidden" name="plan" value={JSON.stringify(rows.map((r) => ({ ...r, count: Number(r.count) || 0 })))} />
      {[...picked].map((id) => (
        <input key={id} type="hidden" name="assignmentIds" value={id} />
      ))}
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 flex w-full items-center justify-between gap-3 text-label text-fg-muted">
          <span>Uygulanacak influencerlar ({picked.size}/{assignments.length})</span>
          <Button size="sm" variant="ghost" onClick={() => setPicked(all ? new Set() : new Set(assignments.map((a) => a.id)))}>
            {all ? "Seçimi kaldır" : "Tümünü seç"}
          </Button>
        </legend>
        <ul className="flex flex-wrap gap-2">
          {assignments.map((a) => {
            const on = picked.has(a.id);
            return (
              <li key={a.id}>
                <label className={`flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-[13px] ${on ? "border-fg bg-fg/[0.05]" : "border-line text-fg-muted"}`}>
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-[var(--color-fg)]"
                    checked={on}
                    onChange={() =>
                      setPicked((s) => {
                        const n = new Set(s);
                        if (n.has(a.id)) n.delete(a.id);
                        else n.add(a.id);
                        return n;
                      })
                    }
                  />
                  {a.name}
                  <span className="text-[11px] text-fg-passive">{a.deliverables ? `${a.deliverables} içerik var` : "içerik yok"}</span>
                </label>
              </li>
            );
          })}
        </ul>
      </fieldset>
      <PlanEditor rows={rows} setRows={setRows} platforms={platforms} />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Field label="İlk paylaşım günü">{(p) => <Input {...p} name="startDay" type="date" required defaultValue={defaults.startDay} />}</Field>
        <Field label="Saat (kitle saati)" hint="Her influencer kendi kitlesinin saatinde paylaşır.">
          {(p) => <Input {...p} name="time" type="time" required defaultValue="19:00" />}
        </Field>
        <Field label="İçerikler arası (gün)">{(p) => <Input {...p} name="spacingDays" type="number" min={0} max={30} defaultValue={2} />}</Field>
        <Field label="Onay (paylaşımdan kaç saat önce)">{(p) => <Input {...p} name="approvalHours" type="number" min={1} max={336} defaultValue={48} />}</Field>
      </div>
      <Field label="Caption (isteğe bağlı)" hint="Boşsa plan satırındaki not yazılır; sonra iş bazında düzenlenebilir.">
        {(p) => <Textarea {...p} name="caption" rows={3} />}
      </Field>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Field label="Hashtagler">{(p) => <Input {...p} name="hashtags" defaultValue={defaults.hashtags.join(" ")} />}</Field>
        <Field label="Bahsetmeler">{(p) => <Input {...p} name="mentions" defaultValue={defaults.mentions.join(" ")} />}</Field>
        <Field label="Hedef bağlantı" hint="UTM kişi ve iş başına eklenir.">{(p) => <Input {...p} name="baseLink" type="url" placeholder="https://marka.com/urun" />}</Field>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Field label="Kullanım hakkı (gün)">{(p) => <Input {...p} name="usageRightsDays" type="number" min={0} max={3650} defaultValue={365} />}</Field>
        <Field label="Mecra">
          {(p) => (
            <Select {...p} name="usageRightsChannel" defaultValue="ORGANIK">
              <option value="ORGANIK">Yalnız organik</option>
              <option value="PAID_DAHIL">Reklam (paid) dahil</option>
            </Select>
          )}
        </Field>
        <Field label="Coğrafya (ülke kodları)">{(p) => <Input {...p} name="usageRightsGeo" defaultValue={(defaults.geo.length ? defaults.geo : ["TR"]).join(" ")} />}</Field>
      </div>
      <label className="flex items-center gap-2 text-sm text-fg-muted">
        <input type="checkbox" name="disclosureRequired" defaultChecked={defaults.disclosureRequired} className="h-4 w-4 accent-[var(--color-fg)]" /> Reklam ibaresi zorunlu (platform etiketleri açık gelir)
      </label>
    </ActionForm>
  );
}
