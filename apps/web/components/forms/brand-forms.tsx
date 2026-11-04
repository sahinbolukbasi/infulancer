"use client";

import { ActionForm } from "@/components/forms/action-form";
import { Field, Input } from "@/components/ui/form";
import { createBrandUser, saveBrand } from "@/lib/actions/brands";
import type { CategoryNode } from "@infulancer/core/domain/categories";
import { CategoryPicker } from "@/components/forms/category-picker";

export type BrandFormValues = {
  id: string;
  name: string;
  taxOffice: string;
  taxNumber: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  contractRef: string | null;
  contractStartsAt: string | null;
  category: string;
  competitorBrandIds: string[];
  categoryIds?: string[];
  primaryCategoryId?: string | null;
};

/** Marka oluşturma/düzenleme formu. */
export function BrandForm({ brand, otherBrands, categories }: { brand?: BrandFormValues; otherBrands: { id: string; name: string; category: string }[]; categories: CategoryNode[] }) {
  return (
    <ActionForm action={saveBrand} submitLabel={brand ? "Değişiklikleri kaydet" : "Markayı oluştur"} aria-label="Marka bilgileri">
      {brand ? <input type="hidden" name="id" value={brand.id} /> : null}
      <CategoryPicker tree={categories} selected={brand?.categoryIds ?? []} primaryId={brand?.primaryCategoryId} />
      <p className="-mt-2 text-[12px] text-fg-passive">Ana kategori rakip/münhasırlık tespitinde kullanılır.</p>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field label="Marka adı">{(p) => <Input {...p} name="name" required defaultValue={brand?.name} />}</Field>
        <Field label="Vergi dairesi">{(p) => <Input {...p} name="taxOffice" required defaultValue={brand?.taxOffice} />}</Field>
        <Field label="Vergi numarası">
          {(p) => <Input {...p} name="taxNumber" required inputMode="numeric" defaultValue={brand?.taxNumber} />}
        </Field>
        <Field label="Yetkili">{(p) => <Input {...p} name="contactName" required defaultValue={brand?.contactName} />}</Field>
        <Field label="Yetkili e-postası">
          {(p) => <Input {...p} name="contactEmail" type="email" required defaultValue={brand?.contactEmail} />}
        </Field>
        <Field label="Telefon">{(p) => <Input {...p} name="contactPhone" type="tel" required defaultValue={brand?.contactPhone} />}</Field>
        <Field label="Sözleşme no">{(p) => <Input {...p} name="contractRef" defaultValue={brand?.contractRef ?? ""} />}</Field>
        <Field label="Sözleşme başlangıcı">
          {(p) => <Input {...p} name="contractStartsAt" type="date" defaultValue={brand?.contractStartsAt ?? ""} />}
        </Field>
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-label text-fg-muted">Rakip markalar</legend>
        {otherBrands.length === 0 ? (
          <p className="text-[13px] text-fg-passive">Başka marka yok.</p>
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {otherBrands.map((b) => (
              <label key={b.id} className="flex items-center gap-2 text-sm text-fg-muted">
                <input
                  type="checkbox"
                  name="competitorBrandIds"
                  value={b.id}
                  defaultChecked={brand?.competitorBrandIds.includes(b.id)}
                  className="h-4 w-4 accent-[var(--color-fg)]"
                />
                {b.name} <span className="text-fg-passive">· {b.category}</span>
              </label>
            ))}
          </div>
        )}
      </fieldset>
    </ActionForm>
  );
}

/** Marka kullanıcısı: e-posta + geçici şifre. */
export function BrandUserForm({ brandId }: { brandId: string }) {
  return (
    <ActionForm action={createBrandUser} submitLabel="Kullanıcı oluştur" submitVariant="secondary" resetOnSuccess aria-label="Marka kullanıcısı">
      <input type="hidden" name="brandId" value={brandId} />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Field label="Ad soyad">{(p) => <Input {...p} name="name" required />}</Field>
        <Field label="E-posta">{(p) => <Input {...p} name="email" type="email" required autoComplete="off" />}</Field>
        <Field label="Geçici şifre" hint="En az 8 karakter; ilk girişte paylaşın.">
          {(p) => <Input {...p} name="password" type="text" required minLength={8} autoComplete="new-password" />}
        </Field>
      </div>
    </ActionForm>
  );
}
