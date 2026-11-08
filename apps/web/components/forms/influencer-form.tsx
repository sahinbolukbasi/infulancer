"use client";

import { useTT } from "@/lib/i18n/tt-client";
import { useState } from "react";
import type { Platform } from "@infulancer/core/enums";
import { ActionForm } from "@/components/forms/action-form";
import { PlatformIcon } from "@/components/platform-icon";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { saveInfluencer } from "@/lib/actions/influencers";
import type { CategoryNode } from "@infulancer/core/domain/categories";
import { REGIONS } from "@infulancer/core/i18n/regions";
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
  country?: string;
  city?: string | null;
  bio?: string | null;
  categoryIds?: string[];
  primaryCategoryId?: string | null;
  accounts: { platform: Platform; handle: string; followers: number; erPercent: string; demographics: string }[];
};

type Demo = { gender?: { kadin?: number }; ageGroups?: Record<string, number>; topCities?: { city: string; share: number }[] };

/** Kitle verisi: yapılandırılmış alanlar (JSON yazmak gerekmez); gelişmiş JSON isteğe bağlı. */
function AudienceFields({ prefix, initial }: { prefix: string; initial?: string }) {
  const tt = useTT();
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
      <p className="text-[13px] text-fg-muted">{tt("Kitle verisi platform API’lerinde herkese açık değildir; influencer’ın paylaştığı istatistik ekran görüntüsünden girilir.")}</p>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
        <Field label={tt("Kadın %")}>{(f) => <Input {...f} name={`${prefix}w`} inputMode="numeric" defaultValue={pctOf(d.gender?.kadin)} />}</Field>
        {["13-17", "18-24", "25-34", "35-44", "45+"].map((g) => (
          <Field key={g} label={`${g} %`}>
            {(f) => <Input {...f} name={`${prefix}age_${g}`} inputMode="numeric" defaultValue={pctOf(d.ageGroups?.[g])} />}
          </Field>
        ))}
      </div>
      <Field label={tt("Öne çıkan şehirler")} hint={tt("Şehir:% biçiminde, virgülle. Ör. İstanbul:38, Ankara:14")}>
        {(f) => <Input {...f} name={`${prefix}cities`} defaultValue={cities} />}
      </Field>
      <details>
        <summary className="cursor-pointer text-[12px] text-fg-passive">{tt("Gelişmiş: ham JSON")}</summary>
        <Textarea name={`${prefix}demographics`} rows={3} className="mt-2 font-mono text-[13px]" defaultValue={initial ?? "{}"} aria-label={tt("Demografi JSON")} />
      </details>
    </div>
  );
}

function AccountFields({ platform, label, initial }: { platform: Platform; label: string; initial?: InfluencerFormValues["accounts"][number] }) {
  const tt = useTT();
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
          <Field label={tt("Kullanıcı adı")}>{(f) => <Input {...f} name={`${p}handle`} required placeholder={tt("@kullanici")} defaultValue={initial?.handle} />}</Field>
          <Field label={tt("Takipçi")}>
            {(f) => <Input {...f} name={`${p}followers`} type="number" min={0} step={1} required defaultValue={initial?.followers} />}
          </Field>
          <Field label={tt("Etkileşim oranı (%)")}>
            {(f) => <Input {...f} name={`${p}er`} inputMode="decimal" required placeholder="4,2" defaultValue={initial?.erPercent} />}
          </Field>
          <AudienceFields prefix={p} initial={initial?.demographics} />
        </div>
      ) : (
        <p className="text-[13px] text-fg-passive">{tt("Bu platformda hesap yok. Eklemek için işaretleyin.")}</p>
      )}
    </fieldset>
  );
}

/** Influencer oluşturma/düzenleme: kimlik, ödeme/vergi, kitle saat dilimi, hesaplar. */
export function InfluencerForm({ influencer, timeZones, categories }: { influencer?: InfluencerFormValues; timeZones: string[]; categories: CategoryNode[] }) {
  const tt = useTT();
  return (
    <ActionForm action={saveInfluencer} submitLabel={influencer ? tt("Değişiklikleri kaydet") : tt("Influencer oluştur")} aria-label={tt("Influencer bilgileri")}>
      {influencer ? <input type="hidden" name="id" value={influencer.id} /> : null}
      <CategoryPicker tree={categories} selected={influencer?.categoryIds ?? []} primaryId={influencer?.primaryCategoryId} />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field label={tt("Ad soyad")}>{(p) => <Input {...p} name="name" required defaultValue={influencer?.name} />}</Field>
        <Field label={tt("Şehir")} hint={tt("Influencer'ın yaşadığı şehir (filtrelemede kullanılır).")}>
          {(p) => <Input {...p} name="city" defaultValue={influencer?.city ?? ""} placeholder={tt("İstanbul")} />}
        </Field>
        <Field label={tt("IBAN")}>
          {(p) => <Input {...p} name="iban" required placeholder={tt("TR00 0000 0000 0000 0000 0000 00")} defaultValue={influencer?.iban} autoComplete="off" />}
        </Field>
        <Field label={tt("Hesap sahibi")}>{(p) => <Input {...p} name="ibanHolder" required defaultValue={influencer?.ibanHolder} />}</Field>
        <Field label={tt("Vergi durumu")}>
          {(p) => (
            <Select {...p} name="taxStatus" required defaultValue={influencer?.taxStatus ?? ""}>
              <option value="" disabled>{tt("Seçin")}</option>
              <option value="FATURA">{tt("Fatura keser")}</option>
              <option value="SERBEST_MESLEK_MAKBUZU">{tt("Serbest meslek makbuzu")}</option>
              <option value="STOPAJLI">{tt("Stopajlı ödeme")}</option>
            </Select>
          )}
        </Field>
        <Field label={tt("Kayıtlı ülke")} hint={tt("Para birimi (hakediş/ödeme), reklam ibaresi kuralları ve marka keşfi buna göre.")}>
          {(p) => (
            <Select {...p} name="country" defaultValue={influencer?.country ?? "TR"}>
              {REGIONS.map((r) => (
                <option key={r.code} value={r.code}>
                  {r.name} · {r.currency}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label={tt("Kitle saat dilimi")} hint={tt("Paylaşım saatleri bu dilimde girilir ve gösterilir.")}>
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
        <legend className="mb-2 text-label text-fg-muted">{tt("Fatura kesebilir mi? (zorunlu)")}</legend>
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
      <Field label={tt("Kısa tanıtım")} hint={tt("Markaya gösterilecek kısa profil metni.")}>
        {(p) => <Textarea {...p} name="bio" rows={2} maxLength={1000} defaultValue={influencer?.bio ?? ""} />}
      </Field>
      <div className="flex flex-col gap-4">
        <h2 className="text-label text-fg-muted">{tt("Sosyal medya hesapları")}</h2>
        {PLATFORMS.map((pl) => (
          <AccountFields key={pl.value} platform={pl.value} label={pl.label} initial={influencer?.accounts.find((a) => a.platform === pl.value)} />
        ))}
      </div>
      {!influencer ? (
        <fieldset className="flex flex-col gap-4 rounded-[8px] border border-border p-4">
          <legend className="px-1 text-label text-fg-muted">{tt("Giriş hesabı (opsiyonel)")}</legend>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label={tt("E-posta")}>{(p) => <Input {...p} name="userEmail" type="email" autoComplete="off" />}</Field>
            <Field label={tt("Geçici şifre")} hint={tt("En az 8 karakter.")}>
              {(p) => <Input {...p} name="userPassword" type="text" minLength={8} autoComplete="new-password" />}
            </Field>
          </div>
        </fieldset>
      ) : null}
    </ActionForm>
  );
}
