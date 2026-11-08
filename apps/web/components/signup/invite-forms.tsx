"use client";
import { useTT } from "@/lib/i18n/tt-client";
import { useState } from "react";
import { ActionForm } from "@/components/forms/action-form";
import { Button, Field, Input, Select, Textarea } from "@/components/ui/form";
import { createInviteAction, reviewApplicationAction, revokeInviteAction } from "@/lib/actions/invites";

export function CreateInviteForm({ allowBrand, appUrl, limits }: { allowBrand: boolean; appUrl: string; limits?: { maxUses: number; maxDays: number } }) {
  const tt = useTT();
  const [code, setCode] = useState<string | null>(null);
  const link = code ? `${appUrl}/kayit?kod=${code}` : "";
  return (
    <div className="flex flex-col gap-4">
      <ActionForm action={createInviteAction} submitLabel={tt("Davet oluştur")} aria-label={tt("Davet oluştur")} onSuccess={(s) => setCode(s.data?.code ?? null)}>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          {allowBrand ? (
            <Field label={tt("Kimi davet ediyorsunuz?")}>
              {(p) => (
                <Select {...p} name="targetRole" defaultValue="INFLUENCER">
                  <option value="INFLUENCER">{tt("Influencer")}</option>
                  <option value="BRAND">{tt("Marka")}</option>
                </Select>
              )}
            </Field>
          ) : (
            <input type="hidden" name="targetRole" value="INFLUENCER" />
          )}
          <Field label={tt("Kullanım hakkı")} hint={limits ? `En fazla ${limits.maxUses}` : tt("Kaç kişi kullanabilir")}>
            {(p) => <Input {...p} name="maxUses" type="number" min={1} max={limits?.maxUses ?? 500} defaultValue={1} />}
          </Field>
          <Field label={tt("Geçerlilik (gün)")} hint={limits ? `En fazla ${limits.maxDays}` : undefined}>
            {(p) => <Input {...p} name="days" type="number" min={1} max={limits?.maxDays ?? 365} defaultValue={14} />}
          </Field>
          <Field label={tt("Not (kime, neden)")}>{(p) => <Input {...p} name="note" maxLength={200} placeholder={tt("Örn. bahar kampanyası adayları")} />}</Field>
        </div>
      </ActionForm>
      {code ? (
        <div className="flex flex-col gap-2 rounded-[8px] border border-fg p-4" role="status">
          <span className="text-[13px] text-fg-muted">{tt("Davet linki (kopyalayıp gönderin):")}</span>
          <div className="flex flex-wrap items-center gap-2">
            <code className="break-all text-sm">{link}</code>
            <Button type="button" size="sm" variant="secondary" onClick={() => navigator.clipboard?.writeText(link)}>{tt("Kopyala")}</Button>
          </div>
          <span className="text-[12px] text-fg-passive">{tt("Kod:")}{" "}<span className="font-mono tracking-widest">{code}</span>
          </span>
        </div>
      ) : null}
    </div>
  );
}

export function CopyLinkButton({ link }: { link: string }) {
  const tt = useTT();
  const [done, setDone] = useState(false);
  return (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      onClick={() => {
        void navigator.clipboard?.writeText(link);
        setDone(true);
      }}
    >
      {done ? tt("Kopyalandı") : tt("Linki kopyala")}
    </Button>
  );
}

export function RevokeInviteButton({ id }: { id: string }) {
  const tt = useTT();
  return (
    <ActionForm action={revokeInviteAction} aria-label={tt("Daveti iptal et")}>
      <input type="hidden" name="id" value={id} />
      <Button type="submit" size="sm" variant="ghost">{tt("İptal et")}</Button>
    </ActionForm>
  );
}

export function ReviewApplicationForm({ id, isBrand, brands }: { id: string; isBrand: boolean; brands: { id: string; name: string }[] }) {
  const tt = useTT();
  const [mode, setMode] = useState<"approve" | "reject">("approve");
  return (
    <ActionForm action={reviewApplicationAction} submitLabel={mode === "approve" ? tt("Onayla") : tt("Reddet")} submitSize="sm" aria-label={tt("Başvuruyu değerlendir")}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="decision" value={mode} />
      <div className="flex gap-4 text-sm">
        <label className="flex items-center gap-2">
          <input type="radio" checked={mode === "approve"} onChange={() => setMode("approve")} className="accent-[var(--color-fg)]" />{" "}{tt("Onayla")}</label>
        <label className="flex items-center gap-2">
          <input type="radio" checked={mode === "reject"} onChange={() => setMode("reject")} className="accent-[var(--color-fg)]" />{" "}{tt("Reddet")}</label>
      </div>
      {mode === "approve" && isBrand ? (
        <Field label={tt("Marka")} hint={tt("Boş bırakılırsa başvurudaki bilgilerle yeni marka oluşturulur.")}>
          {(p) => (
            <Select {...p} name="existingBrandId" defaultValue="">
              <option value="">{tt("Yeni marka oluştur")}</option>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>{tt("Mevcut markaya bağla:")}{" "}{b.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
      ) : null}
      <Field label={mode === "reject" ? tt("Red gerekçesi (başvurana gösterilir)") : tt("Not (opsiyonel)")}>
        {(p) => <Textarea {...p} name="note" rows={2} required={mode === "reject"} minLength={mode === "reject" ? 5 : undefined} maxLength={500} />}
      </Field>
    </ActionForm>
  );
}
