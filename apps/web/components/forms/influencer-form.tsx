"use client";

import { useState } from "react";
import type { Platform } from "@infulancer/core/enums";
import { ActionForm } from "@/components/forms/action-form";
import { PlatformIcon } from "@/components/platform-icon";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { saveInfluencer } from "@/lib/actions/influencers";
import type { CategoryNode } from "@infulancer/core/domain/categories";
import { CategoryPicker } from "@/components/forms/category-picker";

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
  city?: string | null;
  bio?: string | null;
  categoryIds?: string[];
  primaryCategoryId?: string | null;
  accounts: { platform: Platform; handle: string; followers: number; erPercent: string; demographics: string }[];
};

type Demo = { gender?: { kadin?: number }; ageGroups?: Record<string, number>; topCities?: { city: string; share: number }[] };

/** Kitle verisi: yapılandırılmış alanlar (JSON yazmak gerekmez); gelişmiş JSON isteğe bağlı. */
function AudienceFields({ prefix, initial }: { prefix: string; initial?: string }) {
  let d: Demo = {};
  try {
    d = JSON.parse(initial ?? "{}") as Demo;
  } catch {
    d = {};
  }
  const pctOf = (v?: number) => (v == null ? "" : String(Math.round(v * 100)));
  const cities = (d.topCities ?? []).map((c) => `${c.city}:${Math.round(c.share * 100)}`).join(", ");
  return (
    <div className="flex flex-col gap-3 md:col-span-3">
      <p className="text-[13px] text-fg-muted">Kitle verisi platform API’lerinde herkese açık değildir; influencer’ın paylaştığı istatistik ekran görüntüsünden girilir.</p>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
        <Field label="Kadın %">{(f) => <Input {...f} name={`${prefix}w`} inputMode="numeric" defaultValue={pctOf(d.gender?.kadin)} />}</Field>
        {["13-17", "18-24", "25-34", "35-44", "45+"].map((g) => (
          <Field key={g} label={`${g} %`}>
            {(f) => <Input {...f} name={`${prefix}age_${g}`} inputMode="numeric" defaultValue={pctOf(d.ageGroups?.[g])} />}
          </Field>
        ))}
      </div>
      <Field label="Öne çıkan şehirler" hint="Şehir:% biçiminde, virgülle. Ör. İstanbul:38, Ankara:14">
        {(f) => <Input {...f} name={`${prefix}cities`} defaultValue={cities} />}
      </Field>
      <details>
        <summary className="cursor-pointer text-[12px] text-fg-passive">Gelişmiş: ham JSON</summary>
        <Textarea name={`${prefix}demographics`} rows={3} className="mt-2 font-mono text-[13px]" defaultValue={initial ?? "{}"} aria-label="Demografi JSON" />
      </details>
    </div>
  );
}

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
            className="h-4 w-4 accent-[var(--color-fg)]"
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
          <AudienceFields prefix={p} initial={initial?.demographics} />
        </div>
      ) : (
        <p className="text-[13px] text-fg-passive">Bu platformda hesap yok. Eklemek için işaretleyin.</p>
      )}
    </fieldset>
  );
}

/** Influencer oluşturma/düzenleme: kimlik, ödeme/vergi, kitle saat dilimi, hesaplar. */
export function InfluencerForm({ influencer, timeZones, categories }: { influencer?: InfluencerFormValues; timeZones: string[]; categories: CategoryNode[] }) {
  return (
    <ActionForm action={saveInfluencer} submitLabel={influencer ? "Değişiklikleri kaydet" : "Influencer oluştur"} aria-label="Influencer bilgileri">
      {influencer ? <input type="hidden" name="id" value={influencer.id} /> : null}
      <CategoryPicker tree={categories} selected={influencer?.categoryIds ?? []} primaryId={influencer?.primaryCategoryId} />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field label="Ad soyad">{(p) => <Input {...p} name="name" required defaultValue={influencer?.name} />}</Field>
        <Field label="Şehir" hint="Influencer'ın yaşadığı şehir (filtrelemede kullanılır).">
          {(p) => <Input {...p} name="city" defaultValue={influencer?.city ?? ""} placeholder="İstanbul" />}
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
                className="h-4 w-4 accent-[var(--color-fg)]"
              />
              {o.l}
            </label>
          ))}
        </div>
      </fieldset>
      <Field label="Kısa tanıtım" hint="Markaya gösterilecek kısa profil metni.">
        {(p) => <Textarea {...p} name="bio" rows={2} maxLength={1000} defaultValue={influencer?.bio ?? ""} />}
      </Field>
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
