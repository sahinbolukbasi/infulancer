"use client";
import { useTT } from "@/lib/i18n/tt-client";
import { useState, type ReactNode } from "react";
import { ActionForm } from "@/components/forms/action-form";
import { Button, Field, Input, Select, Textarea } from "@/components/ui/form";
import { ImageUpload } from "@/components/ui/image-upload";
import { InfluencerPicker, type PickItem } from "@/components/ui/influencer-picker";
import { CouponCard } from "@/components/luma/pass-cards";
import { cn } from "@/lib/cn";
import { dateLong } from "@/lib/event-format";
import { AGENCY_TZ, isDay, zonedToUtc } from "@/lib/time";
import { createCouponAction, grantCouponAction, setCouponStatusAction } from "@/lib/actions/coupons";

function Section({ n, title, hint, children }: { n: number; title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-fg text-[13px] font-semibold text-bg" aria-hidden>
          {n}
        </span>
        <div className="flex flex-col">
          <h2 className="font-semibold text-fg">{title}</h2>
          {hint ? <p className="text-[13px] text-fg-muted">{hint}</p> : null}
        </div>
      </div>
      {children}
    </section>
  );
}

function Choice({ name, value, checked, onChange, title, desc }: { name: string; value: string; checked: boolean; onChange: () => void; title: string; desc: string }) {
  return (
    <label className={cn("flex cursor-pointer flex-col gap-1 rounded-xl border p-3 transition-standard", checked ? "border-fg bg-surface-hover" : "border-line hover:border-line-strong")}>
      <span className="flex items-center gap-2 font-medium text-fg">
        <input type="radio" name={name} value={value} checked={checked} onChange={onChange} className="h-4 w-4 accent-[var(--color-fg)]" />
        {title}
      </span>
      <span className="text-[13px] text-fg-muted">{desc}</span>
    </label>
  );
}

const PRESET_COLORS = ["#ff2bd6", "#7c3aed", "#2563eb", "#0891b2", "#059669", "#d97706", "#dc2626", "#111827"];

/**
 * Kupon / hediye çeki oluşturma: dört bölüm (tür ve değer, tasarım, kod, geçerlilik) ve sağda
 * alıcının göreceği kartın canlı önizlemesi. Başarıda kupon yönetim sayfasına gider.
 */
export function CouponCreateForm({ isAdmin, brands, brandName }: { isAdmin: boolean; brands?: { id: string; name: string }[]; brandName: string }) {
  const tt = useTT();
  const [kind, setKind] = useState("KUPON");
  const [title, setTitle] = useState("");
  const [valueType, setValueType] = useState("YUZDE");
  const [value, setValue] = useState("");
  const [color, setColor] = useState(PRESET_COLORS[0]!);
  const [codeMode, setCodeMode] = useState<"unique" | "shared">("unique");
  const [shared, setShared] = useState("");
  const [validDay, setValidDay] = useState("");
  const [logo, setLogo] = useState<string | null>(null);
  const [hero, setHero] = useState<string | null>(null);
  const [brand, setBrand] = useState(brands?.[0]?.name ?? brandName);

  const valueLabel = valueType === "YUZDE" ? `%${value || "—"} indirim` : `${value || "—"} TL`;
  const validDate = isDay(validDay) ? zonedToUtc(validDay, "23:59", AGENCY_TZ) : null;

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
      <ActionForm action={createCouponAction} submitLabel={tt("Kuponu oluştur")} aria-label={tt("Kupon oluştur")} className="gap-5">
        <Section n={1} title={tt("Tür ve değer")}>
          {isAdmin && brands ? (
            <Field label={tt("Marka")}>
              {(p) => (
                <Select {...p} name="tenantId" defaultValue={brands[0]?.id} onChange={(e) => setBrand(brands.find((b) => b.id === e.target.value)?.name ?? brandName)}>
                  {brands.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </Select>
              )}
            </Field>
          ) : null}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2" role="radiogroup" aria-label={tt("Tür")}>
            <Choice name="kind" value="KUPON" checked={kind === "KUPON"} onChange={() => setKind("KUPON")} title={tt("İndirim kuponu")} desc="Yüzde veya tutar indirimi." />
            <Choice name="kind" value="HEDIYE_CEKI" checked={kind === "HEDIYE_CEKI"} onChange={() => setKind("HEDIYE_CEKI")} title={tt("Hediye çeki")} desc="Belirli tutarda harcama hakkı." />
          </div>
          <Field label={tt("Başlık")}>{(p) => <Input {...p} name="title" required minLength={3} maxLength={140} placeholder={tt("Yaz koleksiyonu için özel")} onChange={(e) => setTitle(e.target.value)} />}</Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={tt("Değer türü")}>
              {(p) => (
                <Select {...p} name="valueType" defaultValue="YUZDE" onChange={(e) => setValueType(e.target.value)}>
                  <option value="YUZDE">{tt("Yüzde (%)")}</option>
                  <option value="TUTAR">{tt("Tutar (TL)")}</option>
                </Select>
              )}
            </Field>
            <Field label={valueType === "YUZDE" ? tt("İndirim oranı (%)") : tt("Tutar (TL)")}>
              {(p) => <Input {...p} name="value" inputMode="decimal" required placeholder={valueType === "YUZDE" ? "20" : "500"} onChange={(e) => setValue(e.target.value)} />}
            </Field>
          </div>
          <Field label={tt("Açıklama (opsiyonel)")}>{(p) => <Textarea {...p} name="description" rows={2} placeholder={tt("Kuponun kısa açıklaması")} />}</Field>
        </Section>

        <Section n={2} title={tt("Tasarım")} hint={tt("Kart marka renginizle oluşturulur.")}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <ImageUpload name="logoKey" label={tt("Marka logosu")} onPreview={setLogo} />
            <ImageUpload name="heroImageKey" label={tt("Arka plan görseli (opsiyonel)")} onPreview={setHero} />
          </div>
          <fieldset className="flex flex-col gap-2">
            <legend className="text-label text-fg-muted">{tt("Marka rengi")}</legend>
            <div className="flex flex-wrap items-center gap-2">
              {PRESET_COLORS.map((c) => (
                <button key={c} type="button" onClick={() => setColor(c)} aria-label={`Renk ${c}`} aria-pressed={color === c} className={cn("h-8 w-8 rounded-full ring-offset-2 ring-offset-bg transition-standard", color === c ? "ring-2 ring-fg" : "ring-1 ring-line")} style={{ background: c }} />
              ))}
              <label className="ml-1 flex items-center gap-2 text-[13px] text-fg-muted">{tt("Özel")}<input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-8 w-10 cursor-pointer rounded border border-line bg-transparent" aria-label={tt("Özel renk seç")} />
              </label>
            </div>
            <input type="hidden" name="brandColor" value={color} />
          </fieldset>
        </Section>

        <Section n={3} title={tt("Kod")} hint={tt("Alıcılara nasıl kod verileceğini seçin.")}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2" role="radiogroup" aria-label={tt("Kod üretimi")}>
            <Choice name="codeModeUi" value="unique" checked={codeMode === "unique"} onChange={() => setCodeMode("unique")} title={tt("Kişiye özel kod")} desc="Her alıcıya otomatik benzersiz kod üretilir; kime hangi kodun gittiği CSV ile indirilebilir." />
            <Choice name="codeModeUi" value="shared" checked={codeMode === "shared"} onChange={() => setCodeMode("shared")} title={tt("Herkese aynı kod")} desc="Tüm alıcılar sizin belirlediğiniz tek kodu görür." />
          </div>
          {codeMode === "shared" ? (
            <Field label={tt("Ortak kod")} hint={tt("Harf ve rakam, 4-24 karakter.")}>
              {(p) => (
                <Input
                  {...p}
                  name="sharedCode"
                  required
                  minLength={4}
                  maxLength={24}
                  pattern="[A-Za-z0-9-]+"
                  placeholder={tt("YAZ20")}
                  value={shared}
                  onChange={(e) => setShared(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ""))}
                  className="font-mono uppercase tracking-widest"
                />
              )}
            </Field>
          ) : null}
        </Section>

        <Section n={4} title={tt("Geçerlilik ve koşullar")}>
          <Field label={tt("Son kullanım tarihi (boş = süresiz)")}>{(p) => <Input {...p} name="validUntilDay" type="date" onChange={(e) => setValidDay(e.target.value)} className="max-w-52" />}</Field>
          <Field label={tt("Kullanım koşulları")}>{(p) => <Textarea {...p} name="terms" rows={3} placeholder={tt("Tek kullanımlık. Diğer kampanyalarla birleştirilemez.")} />}</Field>
        </Section>
      </ActionForm>

      <aside className="lg:sticky lg:top-6 lg:self-start" aria-label={tt("Kupon önizlemesi")}>
        <p className="mb-2 text-[12px] font-medium text-fg-muted">{tt("Önizleme · alıcının göreceği kart")}</p>
        <div className="flex justify-center rounded-3xl border border-line bg-bg p-5">
          <CouponCard
            kindLabel={kind === "HEDIYE_CEKI" ? "Hediye çeki" : "Kupon"}
            title={title || tt("Kupon başlığı")}
            brandName={brand}
            valueLabel={valueLabel}
            code={codeMode === "shared" ? shared || "ORTAKKOD" : "KPN-XXXXXXXXXX"}
            codeHint={codeMode === "unique" ? "Her alıcıya farklı kod" : "Tüm alıcılara aynı kod"}
            validLabel={validDate ? `Son kullanım: ${dateLong(validDate)}` : "Süresiz"}
            logoSrc={logo}
            heroSrc={hero}
            accent={color}
          />
        </div>
      </aside>
    </div>
  );
}

export function CouponStatusButton({ id, to, label, variant = "secondary" }: { id: string; to: string; label: string; variant?: "primary" | "secondary" | "ghost" }) {
  return (
    <ActionForm action={setCouponStatusAction} aria-label={label} className="!flex-row">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="to" value={to} />
      <Button type="submit" size="sm" variant={variant}>{label}</Button>
    </ActionForm>
  );
}

/** Kuponu kayıtlı içerik üreticilerine gönder: listeden seç veya tüm aktif üreticiler. */
export function GrantForm({ couponId, influencers }: { couponId: string; influencers: PickItem[] }) {
  const tt = useTT();
  return (
    <ActionForm action={grantCouponAction} submitLabel={tt("Gönder")} resetOnSuccess aria-label={tt("Kupon gönder")}>
      <input type="hidden" name="couponId" value={couponId} />
      <InfluencerPicker items={influencers} allLabel="Tümünü seç" />
      <label className="flex items-center gap-2 text-sm text-fg-muted">
        <input type="checkbox" name="all" value="true" className="h-4 w-4 accent-[var(--color-fg)]" />{tt("Seçim yerine tüm aktif içerik üreticilerine gönder")}</label>
    </ActionForm>
  );
}
