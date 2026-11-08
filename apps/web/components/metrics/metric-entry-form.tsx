"use client";

import { useTT } from "@/lib/i18n/tt-client";
import { useState } from "react";
import type { Platform } from "@infulancer/core/enums";
import { ActionForm } from "@/components/forms/action-form";
import { FileUploader } from "@/components/files/file-uploader";
import { Field, Input, Select } from "@/components/ui/form";
import { submitMetric } from "@/lib/actions/metrics";
import { commonMetricFields, platformMetricFields, type MetricField } from "@/lib/metric-fields";

const stages = [
  { value: "H24", label: "24. saat" },
  { value: "D7", label: "7. gün" },
  { value: "D30", label: "30. gün" },
  { value: "ARA", label: "Ara ölçüm" },
];

function NumberField({ name, field }: { name: string; field: MetricField }) {
  return (
    <Field label={field.label}>
      {(p) => (
        <Input
          {...p}
          name={name}
          inputMode={field.kind === "count" ? "numeric" : "decimal"}
          type="number"
          min={field.kind === "signed" ? undefined : 0}
          max={field.kind === "ratio" ? 100 : undefined}
          step={field.kind === "count" || field.kind === "signed" ? 1 : "any"}
        />
      )}
    </Field>
  );
}

/**
 * Metrik giriş formu: aşama + ortak alanlar + platforma özgü alanlar.
 * Ekran görüntüsü yüklenirse kaynak "Ekran görüntüsü" olur; influencer için ve
 * IG Story'de zorunludur. Kayıtlar eklenir, asla üzerine yazılmaz.
 */
export function MetricEntryForm({
  deliverableId,
  platform,
  isStory,
  role,
  tzLabel,
  screenshots,
}: {
  deliverableId: string;
  platform: Platform;
  isStory: boolean;
  role: "ADMIN" | "INFLUENCER";
  tzLabel: string;
  screenshots: { id: string; fileName: string }[];
}) {
  const tt = useTT();
  const [shot, setShot] = useState<string>(screenshots[0]?.id ?? "");
  const required = isStory || role === "INFLUENCER";
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <p className="text-label text-fg-muted">{tt("Ekran görüntüsü")}{" "}{required ? tt("(zorunlu)") : tt("(opsiyonel — yoksa kaynak: manuel)")}</p>
        {isStory ? (
          <p className="text-[13px] text-fg-muted">{tt("Story metrikleri 24 saatte kaybolur: ekran görüntüsü olmadan iş tamamlanamaz.")}</p>
        ) : null}
        <FileUploader
          target={{ type: "deliverable", id: deliverableId }}
          kinds={[{ value: "METRIK_SS", label: "Metrik ekran görüntüsü" }]}
          label={tt("Ekran görüntüsü yükle")}
          hint={tt("PNG/JPG; istatistik ekranının tamamı görünsün.")}
          accept="image/*"
          onUploaded={(a) => setShot(a.assetId)}
        />
        {screenshots.length > 0 ? (
          <Field label={tt("Kullanılacak ekran görüntüsü")}>
            {(p) => (
              <Select {...p} value={shot} onChange={(e) => setShot(e.target.value)}>
                {!required ? <option value="">{tt("Görüntüsüz (manuel giriş)")}</option> : null}
                {screenshots.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.fileName}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        ) : null}
      </div>
      <ActionForm action={submitMetric} submitLabel={tt("Metriği kaydet")} resetOnSuccess onSuccess={() => setShot("")} aria-label={tt("Metrik girişi")}>
        <input type="hidden" name="deliverableId" value={deliverableId} />
        <input type="hidden" name="screenshotAssetId" value={shot} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={tt("Ölçüm aşaması")}>
            {(p) => (
              <Select {...p} name="stage" defaultValue="H24" required>
                {stages.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label={tt("Ölçüm zamanı")} hint={`Boş bırakılırsa şimdi. Saat dilimi: ${tzLabel}`}>
            {(p) => <Input {...p} name="measuredAt" type="datetime-local" />}
          </Field>
        </div>
        <fieldset className="flex flex-col gap-3">
          <legend className="mb-3 text-label text-fg-muted">{tt("Ortak metrikler")}</legend>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {commonMetricFields.map((f) => (
              <NumberField key={f.key} name={`m_${f.key}`} field={f} />
            ))}
          </div>
        </fieldset>
        <fieldset className="flex flex-col gap-3">
          <legend className="mb-3 text-label text-fg-muted">{tt("Platforma özgü")}</legend>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {platformMetricFields[platform].map((f) => (
              <NumberField key={f.key} name={`pm_${f.key}`} field={f} />
            ))}
          </div>
        </fieldset>
      </ActionForm>
    </div>
  );
}
