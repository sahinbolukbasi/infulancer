"use client";
import { ActionForm } from "@/components/forms/action-form";
import { Button, Field, Input, Select, Textarea } from "@/components/ui/form";
import { ImageUpload } from "@/components/ui/image-upload";
import { applyOpenCallAction, createOpenCallAction, reviewApplicationAction, setOpenCallStatusAction } from "@/lib/actions/open-call";

/** Marka: başvuru çağrısı oluşturma. */
export function OpenCallForm({ isAdmin, brands }: { isAdmin: boolean; brands?: { id: string; name: string }[] }) {
  return (
    <ActionForm action={createOpenCallAction} submitLabel="Çağrı oluştur" aria-label="Başvuru çağrısı">
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
      <Field label="Başlık">{(p) => <Input {...p} name="title" required placeholder="Yaz koleksiyonu için içerik üreticileri" />}</Field>
      <Field label="Açıklama ve beklentiler">{(p) => <Textarea {...p} name="description" required rows={3} placeholder="Kitle, içerik türü, aranan profil…" />}</Field>
      <ImageUpload name="coverImageKey" label="Kapak görseli (opsiyonel)" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Field label="Kategori (opsiyonel)">{(p) => <Input {...p} name="category" placeholder="Moda" />}</Field>
        <Field label="Bütçe alt (TL, ops.)">{(p) => <Input {...p} name="budgetMin" inputMode="decimal" placeholder="5000" />}</Field>
        <Field label="Bütçe üst (TL, ops.)">{(p) => <Input {...p} name="budgetMax" inputMode="decimal" placeholder="20000" />}</Field>
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="text-label text-fg-muted">Platformlar</legend>
        <div className="flex flex-wrap gap-4 text-[13px]">
          {[["INSTAGRAM", "Instagram"], ["TIKTOK", "TikTok"], ["YOUTUBE", "YouTube"]].map(([v, l]) => (
            <label key={v} className="flex items-center gap-1.5">
              <input type="checkbox" name="platforms" value={v} defaultChecked={v === "INSTAGRAM"} className="h-4 w-4 accent-[var(--color-fg)]" />
              {l}
            </label>
          ))}
        </div>
      </fieldset>
      <Field label="Son başvuru tarihi (opsiyonel)">{(p) => <Input {...p} name="deadlineDay" type="date" />}</Field>
    </ActionForm>
  );
}

export function OpenCallStatusButton({ id, to, label, variant = "secondary" }: { id: string; to: string; label: string; variant?: "primary" | "secondary" | "ghost" }) {
  return (
    <ActionForm action={setOpenCallStatusAction} aria-label={label} className="!flex-row">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="to" value={to} />
      <Button type="submit" size="sm" variant={variant}>{label}</Button>
    </ActionForm>
  );
}

/** Influencer: çağrıya başvuru. */
export function ApplyForm({ openCallId }: { openCallId: string }) {
  return (
    <ActionForm action={applyOpenCallAction} submitLabel="Başvur" resetOnSuccess aria-label="Çağrıya başvur">
      <input type="hidden" name="openCallId" value={openCallId} />
      <Field label="Neden siz? (kısa pitch)">{(p) => <Textarea {...p} name="pitch" required rows={3} placeholder="Kitleniz, fikriniz, benzer işleriniz…" />}</Field>
      <Field label="Fiyat teklifiniz (TL, opsiyonel)">{(p) => <Input {...p} name="quote" inputMode="decimal" placeholder="10000" />}</Field>
    </ActionForm>
  );
}

/** Marka: başvuruyu kabul et (teklife dönüşür) veya reddet. Tek form, tek mesaj. */
export function ReviewApplication({ id }: { id: string }) {
  return (
    <ActionForm action={reviewApplicationAction} aria-label="Başvuruyu değerlendir" className="gap-2">
      <input type="hidden" name="id" value={id} />
      <div className="flex flex-wrap items-center gap-2">
        <Input name="reviewNote" placeholder="Not (opsiyonel)" aria-label="Değerlendirme notu" className="h-8 max-w-64 text-[12px]" />
        <Button type="submit" name="to" value="KABUL" size="sm" variant="primary">Kabul et · teklife dönüştür</Button>
        <Button type="submit" name="to" value="RED" size="sm" variant="ghost">Reddet</Button>
      </div>
    </ActionForm>
  );
}
