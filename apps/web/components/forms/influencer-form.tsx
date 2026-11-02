"use client";

import { useState } from "react";
import type { Platform } from "@infulancer/core/enums";
import { ActionForm } from "@/components/forms/action-form";
import { PlatformIcon } from "@/components/platform-icon";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { saveInfluencer } from "@/lib/actions/influencers";

const PLATFORMS: { value: Platform; label: string }[] = [
  { value: "INSTAGRAM", label: "Instagram" },
  { value: "TIKTOK", label: "TikTok" },
  { value: "YOUTUBE", label: "YouTube" },
];

export type InfluencerFormValues = {
  id: string;
  name: string;
  category: string;
  iban: string;
  ibanHolder: string;
  taxStatus: string;
  canIssueInvoice: boolean;
  audienceTimezone: string;
  accounts: { platform: Platform; handle: string; followers: number; erPercent: string; demographics: string }[];
};

function AccountFields({ platform, label, initial }: { platform: Platform; label: string; initial?: InfluencerFormValues["accounts"][number] }) {
  const [enabled, setEnabled] = useState(!!initial);
  const p = `acc_${platform}_`;
  return (
    <fieldset className="flex flex-col gap-4 rounded-[8px] border border-border p-4">
      <legend className="px-1">
        <label className="flex items-center gap-2 text-sm text-fg">
          <input
            type="checkbox"
            name={`${p}enabled`}
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="h-4 w-4 accent-[#fafafa]"
          />
          <PlatformIcon platform={platform} size={16} />
          {label}
        </label>
      </legend>
      {enabled ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Field label="Kullanıcı adı">{(f) => <Input {...f} name={`${p}handle`} required placeholder="@kullanici" defaultValue={initial?.handle} />}</Field>
          <Field label="Takipçi">
            {(f) => <Input {...f} name={`${p}followers`} type="number" min={0} step={1} required defaultValue={initial?.followers} />}
          </Field>
          <Field label="Etkileşim oranı (%)">
            {(f) => <Input {...f} name={`${p}er`} inputMode="decimal" required placeholder="4,2" defaultValue={initial?.erPercent} />}
          </Field>
          <Field label="Demografi (JSON)" hint='Ör. {"kadin": 0.72, "yas_18_24": 0.41, "sehir": {"İstanbul": 0.38}}' className="md:col-span-3">
            {(f) => <Textarea {...f} name={`${p}demographics`} rows={3} className="font-mono text-[13px]" defaultValue={initial?.demographics ?? "{}"} />}
          </Field>
        </div>
      ) : (
        <p className="text-[13px] text-fg-passive">Bu platformda hesap yok. Eklemek için işaretleyin.</p>
      )}
    </fieldset>
  );
}

/** Influencer oluşturma/düzenleme: kimlik, ödeme/vergi, kitle saat dilimi, hesaplar. */
export function InfluencerForm({ influencer, timeZones }: { influencer?: InfluencerFormValues; timeZones: string[] }) {
  return (
    <ActionForm action={saveInfluencer} submitLabel={influencer ? "Değişiklikleri kaydet" : "Influencer oluştur"} aria-label="Influencer bilgileri">
      {influencer ? <input type="hidden" name="id" value={influencer.id} /> : null}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field label="Ad soyad">{(p) => <Input {...p} name="name" required defaultValue={influencer?.name} />}</Field>
        <Field label="Kategori" hint="Ör. güzellik, yemek, teknoloji">
          {(p) => <Input {...p} name="category" required defaultValue={influencer?.category} />}
        </Field>
        <Field label="IBAN">
          {(p) => <Input {...p} name="iban" required placeholder="TR00 0000 0000 0000 0000 0000 00" defaultValue={influencer?.iban} autoComplete="off" />}
        </Field>
        <Field label="Hesap sahibi">{(p) => <Input {...p} name="ibanHolder" required defaultValue={influencer?.ibanHolder} />}</Field>
        <Field label="Vergi durumu">
          {(p) => (
            <Select {...p} name="taxStatus" required defaultValue={influencer?.taxStatus ?? ""}>
              <option value="" disabled>
                Seçin
              </option>
              <option value="FATURA">Fatura keser</option>
              <option value="SERBEST_MESLEK_MAKBUZU">Serbest meslek makbuzu</option>
              <option value="STOPAJLI">Stopajlı ödeme</option>
            </Select>
          )}
        </Field>
        <Field label="Kitle saat dilimi" hint="Paylaşım saatleri bu dilimde girilir ve gösterilir.">
          {(p) => (
            <Select {...p} name="audienceTimezone" required defaultValue={influencer?.audienceTimezone ?? "Europe/Istanbul"}>
              {timeZones.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-label text-fg-muted">Fatura kesebilir mi? (zorunlu)</legend>
        <div className="flex gap-6">
          {[
            { v: "true", l: "Evet" },
            { v: "false", l: "Hayır" },
          ].map((o) => (
            <label key={o.v} className="flex items-center gap-2 text-sm text-fg-muted">
              <input
                type="radio"
                name="canIssueInvoice"
                value={o.v}
                required
                defaultChecked={influencer ? String(influencer.canIssueInvoice) === o.v : false}
                className="h-4 w-4 accent-[#fafafa]"
              />
              {o.l}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="flex flex-col gap-4">
        <h2 className="text-label text-fg-muted">Sosyal medya hesapları</h2>
        {PLATFORMS.map((pl) => (
          <AccountFields key={pl.value} platform={pl.value} label={pl.label} initial={influencer?.accounts.find((a) => a.platform === pl.value)} />
        ))}
      </div>
      {!influencer ? (
        <fieldset className="flex flex-col gap-4 rounded-[8px] border border-border p-4">
          <legend className="px-1 text-label text-fg-muted">Giriş hesabı (opsiyonel)</legend>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="E-posta">{(p) => <Input {...p} name="userEmail" type="email" autoComplete="off" />}</Field>
            <Field label="Geçici şifre" hint="En az 8 karakter.">
              {(p) => <Input {...p} name="userPassword" type="text" minLength={8} autoComplete="new-password" />}
            </Field>
          </div>
        </fieldset>
      ) : null}
    </ActionForm>
  );
}
