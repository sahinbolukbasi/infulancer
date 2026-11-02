"use client";

import { useState } from "react";
import type { ContentType, Platform } from "@infulancer/core/enums";
import { contentTypeLabels, platformLabels } from "@infulancer/core/domain/labels";
import { platformRules } from "@infulancer/core/domain/platform-rules";
import { ActionForm } from "@/components/forms/action-form";
import { PlatformIcon } from "@/components/platform-icon";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { saveDeliverable } from "@/lib/actions/deliverables";
import { AGENCY_TZ, fmtDateTime, parseLocalInput, zonedToUtc } from "@/lib/time";

const PLATFORMS: Platform[] = ["INSTAGRAM", "TIKTOK", "YOUTUBE"];

export type DeliverableFormValues = {
  id: string;
  platform: Platform;
  contentType: ContentType;
  plannedAt: string;
  approvalDeadline: string;
  caption: string;
  hashtags: string[];
  mentions: string[];
  baseLink: string;
  disclosureRequired: boolean;
};

function AgencyTime({ value, tz }: { value: string; tz: string }) {
  const parsed = parseLocalInput(value);
  if (!parsed || tz === AGENCY_TZ) return null;
  return <span>İstanbul: {fmtDateTime(zonedToUtc(parsed.day, parsed.time, tz), AGENCY_TZ)}</span>;
}

/** Platform kuralı ipucu paneli: format, ibare, link yeri, kritik kısıt. */
export function PlatformRulePanel({ platform, contentType }: { platform: Platform; contentType?: ContentType }) {
  const rule = platformRules[platform];
  return (
    <aside className="flex flex-col gap-3 rounded-[8px] border border-border p-4 text-[13px]" aria-label={`${platformLabels[platform]} kuralları`}>
      <p className="flex items-center gap-2 text-sm text-fg">
        <PlatformIcon platform={platform} size={16} /> {platformLabels[platform]} kuralları
      </p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-fg-muted">
        <dt className="text-fg-passive">Format</dt>
        <dd>{rule.formatConstraints.join(" · ")}</dd>
        <dt className="text-fg-passive">İbare</dt>
        <dd>{rule.disclosureLabel}</dd>
        <dt className="text-fg-passive">Link yeri</dt>
        <dd>{rule.linkPlacement}</dd>
        <dt className="text-fg-passive">Ana metrik</dt>
        <dd>{rule.mainMetrics.join(", ")}</dd>
        <dt className="text-fg-passive">Kritik</dt>
        <dd className="text-fg">{rule.criticalConstraint}</dd>
      </dl>
      {platform === "INSTAGRAM" && contentType === "STORY" ? (
        <p className="text-fg">Story: yayından 20 saat sonra hatırlatma gider; ekran görüntülü metrik olmadan iş tamamlanamaz.</p>
      ) : null}
      {platform === "TIKTOK" ? <p className="text-fg">TikTok: ham video dosyası arşiv için yüklenmeli (silinme riski).</p> : null}
      {platform === "YOUTUBE" ? <p className="text-fg">YouTube: metrikler 48–72 saatte oturur; bu süre dolmadan “ulaşılamadı” denmez.</p> : null}
    </aside>
  );
}

/**
 * İş (deliverable) formu: platforma göre içerik tipi, kitle saat diliminde
 * paylaşım zamanı ve onay son tarihi, caption/hashtag/bahsetme (brief'ten), UTM link.
 */
export function DeliverableForm({
  assignmentId,
  tz,
  tzLabel,
  defaults,
  deliverable,
}: {
  assignmentId: string;
  tz: string;
  tzLabel: string;
  defaults: { hashtags: string[]; mentions: string[]; disclosureRequired: boolean };
  deliverable?: DeliverableFormValues;
}) {
  const [platform, setPlatform] = useState<Platform>(deliverable?.platform ?? "INSTAGRAM");
  const [contentType, setContentType] = useState<ContentType>(deliverable?.contentType ?? platformRules[platform].contentTypes[0]!);
  const [planned, setPlanned] = useState(deliverable?.plannedAt ?? "");
  const [deadline, setDeadline] = useState(deliverable?.approvalDeadline ?? "");
  const types = platformRules[platform].contentTypes;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_280px]">
      <ActionForm
        action={saveDeliverable}
        submitLabel={deliverable ? "İşi güncelle" : "İşi planla"}
        resetOnSuccess={!deliverable}
        aria-label="İş planı"
      >
        {deliverable ? <input type="hidden" name="id" value={deliverable.id} /> : null}
        <input type="hidden" name="assignmentId" value={assignmentId} />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Platform">
            {(p) => (
              <Select
                {...p}
                name="platform"
                value={platform}
                onChange={(e) => {
                  const next = e.target.value as Platform;
                  setPlatform(next);
                  if (!platformRules[next].contentTypes.includes(contentType)) setContentType(platformRules[next].contentTypes[0]!);
                }}
              >
                {PLATFORMS.map((pl) => (
                  <option key={pl} value={pl}>
                    {platformLabels[pl]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="İçerik tipi">
            {(p) => (
              <Select {...p} name="contentType" value={contentType} onChange={(e) => setContentType(e.target.value as ContentType)}>
                {types.map((t) => (
                  <option key={t} value={t}>
                    {contentTypeLabels[t]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label={`Paylaşım zamanı (${tzLabel})`}>
            {(p) => (
              <div className="flex flex-col gap-1">
                <Input {...p} name="plannedAt" type="datetime-local" required value={planned} onChange={(e) => setPlanned(e.target.value)} />
                <span className="text-[12px] text-fg-passive">
                  <AgencyTime value={planned} tz={tz} />
                </span>
              </div>
            )}
          </Field>
          <Field label={`Onay son tarihi (${tzLabel})`} hint="Paylaşım zamanından önce olmalı.">
            {(p) => (
              <div className="flex flex-col gap-1">
                <Input {...p} name="approvalDeadline" type="datetime-local" required value={deadline} max={planned || undefined} onChange={(e) => setDeadline(e.target.value)} />
                <span className="text-[12px] text-fg-passive">
                  <AgencyTime value={deadline} tz={tz} />
                </span>
              </div>
            )}
          </Field>
        </div>
        <Field label="Caption">{(p) => <Textarea {...p} name="caption" rows={4} defaultValue={deliverable?.caption} />}</Field>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Hashtagler" hint="Brief'ten önerildi.">
            {(p) => <Input {...p} name="hashtags" defaultValue={(deliverable?.hashtags ?? defaults.hashtags).join(" ")} />}
          </Field>
          <Field label="Bahsetmeler" hint="Brief'ten önerildi.">
            {(p) => <Input {...p} name="mentions" defaultValue={(deliverable?.mentions ?? defaults.mentions).join(" ")} />}
          </Field>
        </div>
        <Field label="Hedef bağlantı" hint="UTM parametreleri (kaynak, kampanya, influencer, iş) otomatik eklenir.">
          {(p) => <Input {...p} name="baseLink" type="url" placeholder="https://marka.com/urun" defaultValue={deliverable?.baseLink} />}
        </Field>
        <label className="flex items-center gap-2 text-sm text-fg-muted">
          <input
            type="checkbox"
            name="disclosureRequired"
            defaultChecked={deliverable?.disclosureRequired ?? defaults.disclosureRequired}
            className="h-4 w-4 accent-[#fafafa]"
          />
          Reklam ibaresi zorunlu ({platformRules[platform].disclosureLabel})
        </label>
      </ActionForm>
      <PlatformRulePanel platform={platform} contentType={contentType} />
    </div>
  );
}
