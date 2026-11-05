"use client";
import { useState } from "react";
import { ActionForm } from "@/components/forms/action-form";
import { Button, Field, Input, Select, Textarea } from "@/components/ui/form";
import { ImageUpload } from "@/components/ui/image-upload";
import { InfluencerPicker, type PickItem } from "@/components/ui/influencer-picker";
import { createCouponAction, setCouponStatusAction, grantCouponAction } from "@/lib/actions/coupons";

/** Kupon oluşturma: solda form, sağda canlı önizleme kartı (sayfa değişmeden). */
export function CouponForm({ isAdmin, brands }: { isAdmin: boolean; brands?: { id: string; name: string }[] }) {
  const [kind, setKind] = useState("KUPON");
  const [title, setTitle] = useState("");
  const [valueType, setValueType] = useState("YUZDE");
  const [value, setValue] = useState("");
  const [color, setColor] = useState("#ff2bd6");
  const [code, setCode] = useState("");
  const valueLabel = valueType === "YUZDE" ? (value ? `%${value} indirim` : "%— indirim") : value ? `${value} TL değerinde` : "— TL değerinde";

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_340px]">
      <ActionForm action={createCouponAction} submitLabel="Oluştur ve kupona git" aria-label="Kupon oluştur">
        {isAdmin && brands ? (
          <Field label="Marka">
            {(p) => (
              <Select {...p} name="tenantId" defaultValue={brands[0]?.id}>
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </Select>
            )}
          </Field>
        ) : null}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Tür">
            {(p) => (
              <Select {...p} name="kind" defaultValue="KUPON" onChange={(e) => setKind(e.target.value)}>
                <option value="KUPON">İndirim kuponu</option>
                <option value="HEDIYE_CEKI">Hediye çeki</option>
              </Select>
            )}
          </Field>
          <Field label="Başlık">{(p) => <Input {...p} name="title" required placeholder="Hoş geldin %20" onChange={(e) => setTitle(e.target.value)} />}</Field>
        </div>
        <Field label="Açıklama">{(p) => <Textarea {...p} name="description" rows={2} placeholder="Kısa açıklama" />}</Field>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <ImageUpload name="logoKey" label="Marka logosu" />
          <ImageUpload name="heroImageKey" label="Kapak görseli" />
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Field label="Değer türü">
            {(p) => (
              <Select {...p} name="valueType" defaultValue="YUZDE" onChange={(e) => setValueType(e.target.value)}>
                <option value="YUZDE">Yüzde (%)</option>
                <option value="TUTAR">Tutar (TL)</option>
              </Select>
            )}
          </Field>
          <Field label={valueType === "YUZDE" ? "İndirim (%)" : "Tutar (TL)"}>
            {(p) => <Input {...p} name="value" inputMode="decimal" required placeholder={valueType === "YUZDE" ? "20" : "500"} onChange={(e) => setValue(e.target.value)} />}
          </Field>
          <Field label="Marka rengi">{(p) => <Input {...p} name="brandColor" type="color" defaultValue="#ff2bd6" onChange={(e) => setColor(e.target.value)} />}</Field>
        </div>
        <fieldset className="flex flex-col gap-2 rounded-[8px] border border-border p-3">
          <legend className="px-1 text-[12px] text-fg-muted">Kod üretimi</legend>
          <Field label="Herkese aynı kod (opsiyonel)" hint="Doldurursanız herkese bu kod gider. Boş bırakırsanız her kişiye otomatik benzersiz kod üretilir.">
            {(p) => <Input {...p} name="sharedCode" placeholder="LANSMAN20" onChange={(e) => setCode(e.target.value.toUpperCase())} />}
          </Field>
        </fieldset>
        <Field label="Son geçerlilik tarihi (opsiyonel)">{(p) => <Input {...p} name="validUntilDay" type="date" />}</Field>
        <Field label="Kullanım koşulları">{(p) => <Textarea {...p} name="terms" rows={2} placeholder="Tek kullanımlık, başka kampanyalarla birleştirilemez…" />}</Field>
      </ActionForm>

      {/* Canlı önizleme */}
      <div className="lg:sticky lg:top-6 lg:self-start">
        <span className="mb-2 block text-[12px] text-fg-muted">Önizleme</span>
        <div className="overflow-hidden rounded-[24px] border border-white/10 bg-black/40 shadow-xl">
          <div className="relative h-20" style={{ background: `linear-gradient(135deg, ${color}, #05050a 120%)` }}>
            <span className="absolute left-4 top-4 rounded-full bg-white/15 px-2 py-0.5 text-[10px] uppercase tracking-wider text-white">{kind === "HEDIYE_CEKI" ? "Hediye çeki" : "Kupon"}</span>
          </div>
          <div className="flex flex-col items-center gap-1 px-5 pb-3 pt-4 text-center">
            <h3 className="text-lg font-semibold text-white">{title || "Kupon başlığı"}</h3>
            <span className="bg-gradient-to-r from-white to-white/60 bg-clip-text text-3xl font-bold text-transparent">{valueLabel}</span>
          </div>
          <div className="relative flex items-center">
            <div className="h-4 w-4 -translate-x-1/2 rounded-full bg-[#111]" />
            <div className="flex-1 border-t border-dashed border-white/20" />
            <div className="h-4 w-4 translate-x-1/2 rounded-full bg-[#111]" />
          </div>
          <div className="flex flex-col items-center gap-2 px-5 pb-6 pt-3">
            <div className="h-24 w-24 rounded-xl bg-white/90" aria-hidden />
            <span className="rounded-lg border border-white/15 bg-white/5 px-3 py-1 font-mono text-sm tracking-[0.3em] text-white">{code || "KOD"}</span>
          </div>
        </div>
        <p className="mt-2 text-[11px] text-fg-passive">Kart, kayıttan sonra alıcıya bu görünümde gider.</p>
      </div>
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

/** Kuponu kayıtlı influencer'lara gönder: listeden seç veya tümü. */
export function GrantForm({ couponId, influencers }: { couponId: string; influencers: PickItem[] }) {
  return (
    <ActionForm action={grantCouponAction} submitLabel="Gönder" resetOnSuccess aria-label="Kupon gönder">
      <input type="hidden" name="couponId" value={couponId} />
      <span className="text-label text-fg-muted">İçerik üreticisi seç</span>
      <InfluencerPicker items={influencers} allLabel="Tümünü seç" />
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="all" value="true" className="h-4 w-4 accent-[var(--color-fg)]" />
        Veya tüm aktif içerik üreticilerine gönder
      </label>
    </ActionForm>
  );
}
