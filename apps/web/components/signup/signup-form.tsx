"use client";
import Link from "next/link";
import type { CategoryNode } from "@infulancer/core/domain/categories";
import { ActionForm } from "@/components/forms/action-form";
import { CategoryPicker } from "@/components/forms/category-picker";
import { Field, Input, Textarea } from "@/components/ui/form";
import { registerAction } from "@/lib/actions/invites";

export function SignupForm({ code, kind, categories }: { code: string; kind: "INFLUENCER" | "BRAND"; categories: CategoryNode[] }) {
  return (
    <ActionForm action={registerAction} submitLabel="Başvuruyu gönder" aria-label="Kayıt formu">
      <input type="hidden" name="code" value={code} />
      <input type="hidden" name="kind" value={kind} />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field label="Ad soyad">{(p) => <Input {...p} name="name" required autoComplete="name" minLength={3} maxLength={80} />}</Field>
        <Field label="Telefon">{(p) => <Input {...p} name="phone" type="tel" required autoComplete="tel" placeholder="+90 5__ ___ __ __" />}</Field>
        <Field label="E-posta">{(p) => <Input {...p} name="email" type="email" required autoComplete="email" />}</Field>
        <div />
        <Field label="Şifre" hint="En az 10 karakter, harf ve rakam içermeli.">
          {(p) => <Input {...p} name="password" type="password" required minLength={10} autoComplete="new-password" />}
        </Field>
        <Field label="Şifre (tekrar)">{(p) => <Input {...p} name="password2" type="password" required minLength={10} autoComplete="new-password" />}</Field>
      </div>
      {kind === "BRAND" ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Şirket / marka adı">{(p) => <Input {...p} name="companyName" required autoComplete="organization" />}</Field>
          <Field label="Web sitesi">{(p) => <Input {...p} name="website" type="url" placeholder="https://" />}</Field>
          <Field label="Vergi dairesi">{(p) => <Input {...p} name="taxOffice" required />}</Field>
          <Field label="Vergi / TC kimlik no">{(p) => <Input {...p} name="taxNumber" required inputMode="numeric" pattern="\d{10,11}" />}</Field>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Instagram kullanıcı adı">{(p) => <Input {...p} name="instagram" placeholder="@kullanici" />}</Field>
          <Field label="TikTok kullanıcı adı">{(p) => <Input {...p} name="tiktok" placeholder="@kullanici" />}</Field>
          <Field label="YouTube kanal adı">{(p) => <Input {...p} name="youtube" placeholder="@kanal" />}</Field>
          <Field label="Şehir">{(p) => <Input {...p} name="city" autoComplete="address-level2" />}</Field>
        </div>
      )}
      <CategoryPicker tree={categories} />
      <Field label={kind === "BRAND" ? "Markanızı kısaca anlatın" : "Kendinizi kısaca anlatın"}>
        {(p) => <Textarea {...p} name="about" rows={3} maxLength={1000} />}
      </Field>
      <label className="flex items-start gap-2 text-[13px] text-fg-muted">
        <input type="checkbox" name="acceptTerms" required className="mt-0.5 h-4 w-4 accent-[#fafafa]" />
        <span>
          <Link href="/kullanim-kosullari" target="_blank" className="underline underline-offset-4">
            Kullanım koşullarını
          </Link>{" "}
          ve{" "}
          <Link href="/gizlilik" target="_blank" className="underline underline-offset-4">
            gizlilik politikasını
          </Link>{" "}
          okudum, kabul ediyorum.
        </span>
      </label>
    </ActionForm>
  );
}
