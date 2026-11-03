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
  frameCount?: number;
  frameTexts?: string[];
  paidPartnershipToggle?: boolean;
  commercialContentToggle?: boolean;
  hasAudio?: boolean;
  spokenDisclosure?: boolean;
  isLive?: boolean;
  usageRightsDays?: number | null;
  usageRightsChannel?: "ORGANIK" | "PAID_DAHIL" | null;
  usageRightsGeo?: string[];
};

function Check({ name, label, defaultChecked, hint }: { name: string; label: string; defaultChecked?: boolean; hint?: string }) {
  return (
    <label className="flex items-start gap-2 text-sm text-fg-muted">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="mt-0.5 h-4 w-4 accent-[#fafafa]" />
      <span>
        {label}
        {hint ? <span className="block text-[12px] text-fg-passive">{hint}</span> : null}
      </span>
    </label>
  );
}

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
  defaults: { hashtags: string[]; mentions: string[]; disclosureRequired: boolean; advertiser?: string };
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
        {contentType === "STORY" ? (
          <fieldset className="flex flex-col gap-4 rounded-[8px] border border-border p-4">
            <legend className="px-1 text-sm text-fg">Story kareleri</legend>
            <p className="text-[13px] text-fg-muted">
              md. 23/A story serisinde her kareyi ayrı denetler: her karede ilk unsur olarak “Reklam” veya “Tanıtım” ve reklam verenin adı görünmeli.
            </p>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-[160px_1fr]">
              <Field label="Kare sayısı">
                {(p) => <Input {...p} name="frameCount" type="number" min={1} max={30} defaultValue={deliverable?.frameCount ?? 3} />}
              </Field>
              <Field label="Kare metinleri (her satır bir kare)" hint={`Örn: Reklam | ${defaults.advertiser ?? "Marka"} — ...`}>
                {(p) => <Textarea {...p} name="frameTexts" rows={4} defaultValue={(deliverable?.frameTexts ?? []).join("\n")} />}
              </Field>
            </div>
          </fieldset>
        ) : null}
        <fieldset className="flex flex-col gap-3 rounded-[8px] border border-border p-4">
          <legend className="px-1 text-sm text-fg">Reklam açıklaması (md. 23/A)</legend>
          <Check name="disclosureRequired" label={`Reklam ibaresi zorunlu (${platformRules[platform].disclosureLabel})`} defaultChecked={deliverable?.disclosureRequired ?? defaults.disclosureRequired} />
          {platform === "INSTAGRAM" ? <Check name="paidPartnershipToggle" label="Instagram “Ücretli ortaklık” etiketi açılacak" defaultChecked={deliverable?.paidPartnershipToggle ?? true} /> : null}
          {platform === "TIKTOK" ? <Check name="commercialContentToggle" label="TikTok ticari içerik açıklaması açılacak" defaultChecked={deliverable?.commercialContentToggle ?? true} hint="Eksikse 24 saatte düzeltilmezse video For You akışından çıkarılabilir." /> : null}
          <Check name="hasAudio" label="Sesli anlatım var" defaultChecked={deliverable?.hasAudio} />
          <Check name="spokenDisclosure" label="Reklamdan önce sözlü açılış yapılacak (“… hakkında reklam/tanıtım içerir”)" defaultChecked={deliverable?.spokenDisclosure} />
          {contentType === "LIVE" ? <input type="hidden" name="isLive" value="on" /> : null}
        </fieldset>
        <fieldset className="flex flex-col gap-3 rounded-[8px] border border-border p-4">
          <legend className="px-1 text-sm text-fg">Kullanım hakkı</legend>
          <p className="text-[13px] text-fg-muted">Süre, mecra ve coğrafya tanımlanmadan kampanya yayına alınamaz (faturayı ve fiyatı değiştirir).</p>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Field label="Süre (gün)">{(p) => <Input {...p} name="usageRightsDays" type="number" min={0} max={3650} defaultValue={deliverable?.usageRightsDays ?? 365} />}</Field>
            <Field label="Mecra">
              {(p) => (
                <Select {...p} name="usageRightsChannel" defaultValue={deliverable?.usageRightsChannel ?? "ORGANIK"}>
                  <option value="ORGANIK">Yalnız organik</option>
                  <option value="PAID_DAHIL">Reklam (paid) dahil</option>
                </Select>
              )}
            </Field>
            <Field label="Coğrafya (ülke kodları)">{(p) => <Input {...p} name="usageRightsGeo" defaultValue={(deliverable?.usageRightsGeo?.length ? deliverable.usageRightsGeo : ["TR"]).join(" ")} />}</Field>
          </div>
        </fieldset>
      </ActionForm>
      <PlatformRulePanel platform={platform} contentType={contentType} />
    </div>
  );
}
