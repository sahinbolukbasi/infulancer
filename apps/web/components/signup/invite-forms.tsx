"use client";
import { useState } from "react";
import { ActionForm } from "@/components/forms/action-form";
import { Button, Field, Input, Select, Textarea } from "@/components/ui/form";
import { createInviteAction, reviewApplicationAction, revokeInviteAction } from "@/lib/actions/invites";

export function CreateInviteForm({ allowBrand, appUrl, limits }: { allowBrand: boolean; appUrl: string; limits?: { maxUses: number; maxDays: number } }) {
  const [code, setCode] = useState<string | null>(null);
  const link = code ? `${appUrl}/kayit?kod=${code}` : "";
  return (
    <div className="flex flex-col gap-4">
      <ActionForm action={createInviteAction} submitLabel="Davet oluştur" aria-label="Davet oluştur" onSuccess={(s) => setCode(s.data?.code ?? null)}>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          {allowBrand ? (
            <Field label="Kimi davet ediyorsunuz?">
              {(p) => (
                <Select {...p} name="targetRole" defaultValue="INFLUENCER">
                  <option value="INFLUENCER">Influencer</option>
                  <option value="BRAND">Marka</option>
                </Select>
              )}
            </Field>
          ) : (
            <input type="hidden" name="targetRole" value="INFLUENCER" />
          )}
          <Field label="Kullanım hakkı" hint={limits ? `En fazla ${limits.maxUses}` : "Kaç kişi kullanabilir"}>
            {(p) => <Input {...p} name="maxUses" type="number" min={1} max={limits?.maxUses ?? 500} defaultValue={1} />}
          </Field>
          <Field label="Geçerlilik (gün)" hint={limits ? `En fazla ${limits.maxDays}` : undefined}>
            {(p) => <Input {...p} name="days" type="number" min={1} max={limits?.maxDays ?? 365} defaultValue={14} />}
          </Field>
          <Field label="Not (kime, neden)">{(p) => <Input {...p} name="note" maxLength={200} placeholder="Örn. bahar kampanyası adayları" />}</Field>
        </div>
      </ActionForm>
      {code ? (
        <div className="flex flex-col gap-2 rounded-[8px] border border-fg p-4" role="status">
          <span className="text-[13px] text-fg-muted">Davet linki (kopyalayıp gönderin):</span>
          <div className="flex flex-wrap items-center gap-2">
            <code className="break-all text-sm">{link}</code>
            <Button type="button" size="sm" variant="secondary" onClick={() => navigator.clipboard?.writeText(link)}>
              Kopyala
            </Button>
          </div>
          <span className="text-[12px] text-fg-passive">
            Kod: <span className="font-mono tracking-widest">{code}</span>
          </span>
        </div>
      ) : null}
    </div>
  );
}

export function CopyLinkButton({ link }: { link: string }) {
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
      {done ? "Kopyalandı" : "Linki kopyala"}
    </Button>
  );
}

export function RevokeInviteButton({ id }: { id: string }) {
  return (
    <ActionForm action={revokeInviteAction} aria-label="Daveti iptal et">
      <input type="hidden" name="id" value={id} />
      <Button type="submit" size="sm" variant="ghost">
        İptal et
      </Button>
    </ActionForm>
  );
}

export function ReviewApplicationForm({ id, isBrand, brands }: { id: string; isBrand: boolean; brands: { id: string; name: string }[] }) {
  const [mode, setMode] = useState<"approve" | "reject">("approve");
  return (
    <ActionForm action={reviewApplicationAction} submitLabel={mode === "approve" ? "Onayla" : "Reddet"} submitSize="sm" aria-label="Başvuruyu değerlendir">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="decision" value={mode} />
      <div className="flex gap-4 text-sm">
        <label className="flex items-center gap-2">
          <input type="radio" checked={mode === "approve"} onChange={() => setMode("approve")} className="accent-[var(--color-fg)]" /> Onayla
        </label>
        <label className="flex items-center gap-2">
          <input type="radio" checked={mode === "reject"} onChange={() => setMode("reject")} className="accent-[var(--color-fg)]" /> Reddet
        </label>
      </div>
      {mode === "approve" && isBrand ? (
        <Field label="Marka" hint="Boş bırakılırsa başvurudaki bilgilerle yeni marka oluşturulur.">
          {(p) => (
            <Select {...p} name="existingBrandId" defaultValue="">
              <option value="">Yeni marka oluştur</option>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  Mevcut markaya bağla: {b.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
      ) : null}
      <Field label={mode === "reject" ? "Red gerekçesi (başvurana gösterilir)" : "Not (opsiyonel)"}>
        {(p) => <Textarea {...p} name="note" rows={2} required={mode === "reject"} minLength={mode === "reject" ? 5 : undefined} maxLength={500} />}
      </Field>
    </ActionForm>
  );
}
