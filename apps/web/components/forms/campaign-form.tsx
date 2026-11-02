"use client";

import { useState } from "react";
import { KPI_KEYS, kpiLabels, type Kpi } from "@infulancer/core/domain/campaign-score";
import { ActionForm } from "@/components/forms/action-form";
import { Button, Field, Input, Select } from "@/components/ui/form";
import { saveCampaign } from "@/lib/actions/campaigns";

type TargetRow = { kpi: Kpi; target: string; weight: string; windowDays: string };

export type CampaignFormValues = {
  id: string;
  brandId: string;
  name: string;
  slug: string;
  budget: string;
  brandTotalFee: string;
  startsAt: string;
  endsAt: string;
  status: "TASLAK" | "AKTIF" | "KAPANDI" | "IPTAL";
  targets: { kpi: Kpi; target: number; weight: number; windowDays: number }[];
};

/** Kampanya formu + hedef (KPI) editörü. ER hedefi oran olarak girilir (ör. 0,045). */
export function CampaignForm({ campaign, brands }: { campaign?: CampaignFormValues; brands: { id: string; name: string }[] }) {
  const [rows, setRows] = useState<TargetRow[]>(
    campaign?.targets.map((t) => ({ kpi: t.kpi, target: String(t.target), weight: String(t.weight), windowDays: String(t.windowDays) })) ?? [
      { kpi: "reach", target: "", weight: "1", windowDays: "30" },
    ],
  );
  const update = (i: number, patch: Partial<TargetRow>) => setRows((r) => r.map((row, j) => (j === i ? { ...row, ...patch } : row)));
  const unused = KPI_KEYS.filter((k) => !rows.some((r) => r.kpi === k));

  return (
    <ActionForm action={saveCampaign} submitLabel={campaign ? "Değişiklikleri kaydet" : "Kampanyayı oluştur"} aria-label="Kampanya bilgileri">
      {campaign ? <input type="hidden" name="id" value={campaign.id} /> : null}
      <input type="hidden" name="targets" value={JSON.stringify(rows)} />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field label="Marka">
          {(p) => (
            <Select {...p} name="brandId" required defaultValue={campaign?.brandId ?? ""}>
              <option value="" disabled>
                Marka seçin
              </option>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Kampanya adı">{(p) => <Input {...p} name="name" required defaultValue={campaign?.name} />}</Field>
        <Field label="Kısa ad (UTM)" hint="Boş bırakılırsa addan üretilir.">
          {(p) => <Input {...p} name="slug" defaultValue={campaign?.slug} pattern="[a-z0-9\-]*" />}
        </Field>
        <Field label="Durum" hint="Kapatma için kampanya sayfasındaki 'Kampanyayı kapat' kullanılır.">
          {(p) =>
            campaign?.status === "KAPANDI" ? (
              <Input {...p} value="Kapandı" disabled readOnly />
            ) : (
              <Select {...p} name="status" defaultValue={campaign?.status ?? "TASLAK"}>
                <option value="TASLAK">Taslak</option>
                <option value="AKTIF">Aktif</option>
                <option value="IPTAL">İptal</option>
              </Select>
            )
          }
        </Field>
        <Field label="Bütçe (TL)" hint="Yalnız ajans görür.">
          {(p) => <Input {...p} name="budget" required inputMode="decimal" defaultValue={campaign?.budget} placeholder="450000" />}
        </Field>
        <Field label="Markadan alınan toplam bedel (TL)" hint="Marka bu tutarı görür.">
          {(p) => <Input {...p} name="brandTotalFee" required inputMode="decimal" defaultValue={campaign?.brandTotalFee} placeholder="380000" />}
        </Field>
        <Field label="Başlangıç">{(p) => <Input {...p} name="startsAt" type="date" required defaultValue={campaign?.startsAt} />}</Field>
        <Field label="Bitiş">{(p) => <Input {...p} name="endsAt" type="date" required defaultValue={campaign?.endsAt} />}</Field>
      </div>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 text-label text-fg-muted">Hedefler (ağırlıklı kampanya skoru)</legend>
        <div className="hidden grid-cols-[1.4fr_1fr_0.7fr_0.8fr_auto] gap-3 text-[12px] text-fg-passive md:grid">
          <span>KPI</span>
          <span>Hedef</span>
          <span>Ağırlık</span>
          <span>Pencere (gün)</span>
          <span className="sr-only">Sil</span>
        </div>
        {rows.map((row, i) => (
          <div key={i} className="grid grid-cols-2 gap-3 md:grid-cols-[1.4fr_1fr_0.7fr_0.8fr_auto]">
            <Select aria-label={`Hedef ${i + 1} KPI`} value={row.kpi} onChange={(e) => update(i, { kpi: e.target.value as Kpi })}>
              {[row.kpi, ...unused].map((k) => (
                <option key={k} value={k}>
                  {kpiLabels[k]}
                </option>
              ))}
            </Select>
            <Input
              aria-label={`Hedef ${i + 1} değer`}
              inputMode="decimal"
              value={row.target}
              placeholder={row.kpi === "er" ? "0,045" : "250000"}
              onChange={(e) => update(i, { target: e.target.value })}
              required
            />
            <Input aria-label={`Hedef ${i + 1} ağırlık`} inputMode="decimal" value={row.weight} onChange={(e) => update(i, { weight: e.target.value })} required />
            <Input
              aria-label={`Hedef ${i + 1} pencere (gün)`}
              type="number"
              min={1}
              max={365}
              value={row.windowDays}
              onChange={(e) => update(i, { windowDays: e.target.value })}
              required
            />
            <Button variant="ghost" size="md" onClick={() => setRows((r) => r.filter((_, j) => j !== i))} aria-label={`Hedef ${i + 1} sil`}>
              Sil
            </Button>
          </div>
        ))}
        {unused.length > 0 ? (
          <div>
            <Button variant="secondary" size="sm" onClick={() => setRows((r) => [...r, { kpi: unused[0]!, target: "", weight: "1", windowDays: "30" }])}>
              Hedef ekle
            </Button>
          </div>
        ) : null}
      </fieldset>
    </ActionForm>
  );
}
