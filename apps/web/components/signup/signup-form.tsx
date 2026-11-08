"use client";
import { useTT } from "@/lib/i18n/tt-client";
import Link from "next/link";
import type { CategoryNode } from "@infulancer/core/domain/categories";
import { ActionForm } from "@/components/forms/action-form";
import { CategoryPicker } from "@/components/forms/category-picker";
import { Field, Input, Textarea } from "@/components/ui/form";
import { registerAction } from "@/lib/actions/invites";

export function SignupForm({ code, kind, categories }: { code: string; kind: "INFLUENCER" | "BRAND"; categories: CategoryNode[] }) {
  const tt = useTT();
  return (
    <ActionForm action={registerAction} submitLabel={tt("Başvuruyu gönder")} aria-label={tt("Kayıt formu")}>
      <input type="hidden" name="code" value={code} />
      <input type="hidden" name="kind" value={kind} />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field label={tt("Ad soyad")}>{(p) => <Input {...p} name="name" required autoComplete="name" minLength={3} maxLength={80} />}</Field>
        <Field label={tt("Telefon")}>{(p) => <Input {...p} name="phone" type="tel" required autoComplete="tel" placeholder="+90 5__ ___ __ __" />}</Field>
        <Field label={tt("E-posta")}>{(p) => <Input {...p} name="email" type="email" required autoComplete="email" />}</Field>
        <div />
        <Field label={tt("Şifre")} hint={tt("En az 10 karakter, harf ve rakam içermeli.")}>
          {(p) => <Input {...p} name="password" type="password" required minLength={10} autoComplete="new-password" />}
        </Field>
        <Field label={tt("Şifre (tekrar)")}>{(p) => <Input {...p} name="password2" type="password" required minLength={10} autoComplete="new-password" />}</Field>
      </div>
      {kind === "BRAND" ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label={tt("Şirket / marka adı")}>{(p) => <Input {...p} name="companyName" required autoComplete="organization" />}</Field>
          <Field label={tt("Web sitesi")}>{(p) => <Input {...p} name="website" type="url" placeholder="https://" />}</Field>
          <Field label={tt("Vergi dairesi")}>{(p) => <Input {...p} name="taxOffice" required />}</Field>
          <Field label={tt("Vergi / TC kimlik no")}>{(p) => <Input {...p} name="taxNumber" required inputMode="numeric" pattern="\d{10,11}" />}</Field>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label={tt("Instagram kullanıcı adı")}>{(p) => <Input {...p} name="instagram" placeholder={tt("@kullanici")} />}</Field>
          <Field label={tt("TikTok kullanıcı adı")}>{(p) => <Input {...p} name="tiktok" placeholder={tt("@kullanici")} />}</Field>
          <Field label={tt("YouTube kanal adı")}>{(p) => <Input {...p} name="youtube" placeholder={tt("@kanal")} />}</Field>
          <Field label={tt("Şehir")}>{(p) => <Input {...p} name="city" autoComplete="address-level2" />}</Field>
        </div>
      )}
      <CategoryPicker tree={categories} />
      <Field label={kind === "BRAND" ? tt("Markanızı kısaca anlatın") : tt("Kendinizi kısaca anlatın")}>
        {(p) => <Textarea {...p} name="about" rows={3} maxLength={1000} />}
      </Field>
      <label className="flex items-start gap-2 text-[13px] text-fg-muted">
        <input type="checkbox" name="acceptTerms" required className="mt-0.5 h-4 w-4 accent-[var(--color-fg)]" />
        <span>
          <Link href="/kullanim-kosullari" target="_blank" className="underline underline-offset-4">{tt("Kullanım koşullarını")}</Link>{" "}{tt("ve")}{" "}
          <Link href="/gizlilik" target="_blank" className="underline underline-offset-4">{tt("gizlilik politikasını")}</Link>{" "}{tt("okudum, kabul ediyorum.")}{" "}
          <Link href="/kvkk" target="_blank" className="underline underline-offset-4">{tt("KVKK Aydınlatma Metni")}</Link>{tt("'ni okudum.")}</span>
      </label>
    </ActionForm>
  );
}
