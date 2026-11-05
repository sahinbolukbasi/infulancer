"use client";
import { useState } from "react";
import { ActionForm } from "@/components/forms/action-form";
import { Button, Field, Input, Select, Textarea } from "@/components/ui/form";
import { ImageUpload } from "@/components/ui/image-upload";
import { InfluencerPicker, type PickItem } from "@/components/ui/influencer-picker";
import { createCouponAction, setCouponStatusAction, grantCouponAction } from "@/lib/actions/coupons";

/** Kupon / hediye çeki oluşturma formu (logo, görsel, kod, değer, geçerlilik, koşullar). */
export function CouponForm({ isAdmin, brands }: { isAdmin: boolean; brands?: { id: string; name: string }[] }) {
  const [valueType, setValueType] = useState("YUZDE");
  return (
    <ActionForm action={createCouponAction} submitLabel="Oluştur" aria-label="Kupon oluştur">
      {isAdmin && brands ? (
        <Field label="Marka">
          {(p) => (
            <Select {...p} name="tenantId" defaultValue={brands[0]?.id}>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
      ) : null}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field label="Tür">
          {(p) => (
            <Select {...p} name="kind" defaultValue="KUPON">
              <option value="KUPON">İndirim kuponu</option>
              <option value="HEDIYE_CEKI">Hediye çeki</option>
            </Select>
          )}
        </Field>
        <Field label="Başlık">{(p) => <Input {...p} name="title" required placeholder="Hoş geldin %20" />}</Field>
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
          {(p) => <Input {...p} name="value" inputMode="decimal" required placeholder={valueType === "YUZDE" ? "20" : "500"} />}
        </Field>
        <Field label="Marka rengi (opsiyonel)">{(p) => <Input {...p} name="brandColor" type="color" defaultValue="#ff2bd6" />}</Field>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field label="Ortak kod (opsiyonel)" hint="Boş bırakılırsa her gönderime özel kod üretilir.">{(p) => <Input {...p} name="sharedCode" placeholder="LANSMAN20" />}</Field>
        <Field label="Son geçerlilik tarihi (opsiyonel)">{(p) => <Input {...p} name="validUntilDay" type="date" />}</Field>
      </div>
      <Field label="Kullanım koşulları">{(p) => <Textarea {...p} name="terms" rows={2} placeholder="Tek kullanımlık, başka kampanyalarla birleştirilemez…" />}</Field>
    </ActionForm>
  );
}

export function CouponStatusButton({ id, to, label, variant = "secondary" }: { id: string; to: string; label: string; variant?: "primary" | "secondary" | "ghost" }) {
  return (
    <ActionForm action={setCouponStatusAction} aria-label={label} className="!flex-row">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="to" value={to} />
      <Button type="submit" size="sm" variant={variant}>
        {label}
      </Button>
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
