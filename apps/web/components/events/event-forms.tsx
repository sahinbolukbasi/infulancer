"use client";
import { ActionForm } from "@/components/forms/action-form";
import { Button, Field, Input, Select, Textarea } from "@/components/ui/form";
import { ImageUpload } from "@/components/ui/image-upload";
import { MapPicker } from "@/components/ui/map-picker";
import { InfluencerPicker, type PickItem } from "@/components/ui/influencer-picker";
import { createEventAction, setEventStatusAction, inviteEventAction, respondInviteAction, checkInAction } from "@/lib/actions/events";

/** Etkinlik oluşturma formu: harita seçici + başlangıç/bitiş tarihi + kapak. */
export function EventForm({ isAdmin, brands, defaultTenantId }: { isAdmin: boolean; brands?: { id: string; name: string }[]; defaultTenantId?: string }) {
  return (
    <ActionForm action={createEventAction} submitLabel="Etkinlik oluştur" aria-label="Etkinlik oluştur">
      {isAdmin && brands ? (
        <Field label="Marka (opsiyonel, ajans etkinliği için boş bırakın)">
          {(p) => (
            <Select {...p} name="tenantId" defaultValue={defaultTenantId ?? ""}>
              <option value="">Ajans etkinliği</option>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </Select>
          )}
        </Field>
      ) : null}
      <Field label="Başlık">{(p) => <Input {...p} name="title" required placeholder="Yaz lansman gecesi" />}</Field>
      <Field label="Açıklama">{(p) => <Textarea {...p} name="description" required rows={3} placeholder="Etkinlik detayları, program, dress code…" />}</Field>
      <ImageUpload name="coverImageKey" label="Kapak görseli" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field label="Mekan adı">{(p) => <Input {...p} name="venueName" placeholder="Studio X" />}</Field>
        <Field label="Şehir">{(p) => <Input {...p} name="city" placeholder="İstanbul" />}</Field>
      </div>
      <Field label="Adres">{(p) => <Input {...p} name="address" placeholder="Açık adres" />}</Field>
      <MapPicker />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="grid grid-cols-2 gap-2">
          <Field label="Başlangıç tarihi">{(p) => <Input {...p} name="startsAtDay" type="date" required />}</Field>
          <Field label="Başlangıç saati">{(p) => <Input {...p} name="startsAtTime" type="time" defaultValue="19:00" />}</Field>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Bitiş tarihi (ops.)">{(p) => <Input {...p} name="endsAtDay" type="date" />}</Field>
          <Field label="Bitiş saati (ops.)">{(p) => <Input {...p} name="endsAtTime" type="time" defaultValue="23:00" />}</Field>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field label="Kapasite (opsiyonel)">{(p) => <Input {...p} name="capacity" type="number" min={1} placeholder="100" />}</Field>
        <Field label="Görünürlük">
          {(p) => (
            <Select {...p} name="visibility" defaultValue="KAPALI">
              <option value="KAPALI">Kapalı (yalnız davetliler)</option>
              <option value="HERKESE_ACIK">Herkese açık (katılım talebi alınabilir)</option>
            </Select>
          )}
        </Field>
      </div>
    </ActionForm>
  );
}

export function EventStatusButton({ id, to, label, variant = "secondary" }: { id: string; to: string; label: string; variant?: "primary" | "secondary" | "ghost" }) {
  return (
    <ActionForm action={setEventStatusAction} aria-label={label} className="!flex-row">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="to" value={to} />
      <Button type="submit" size="sm" variant={variant}>{label}</Button>
    </ActionForm>
  );
}

/** Davet formu: kayıtlı influencer'lardan çoklu seçim veya tek misafir adı. */
export function InviteForm({ eventId, influencers }: { eventId: string; influencers: PickItem[] }) {
  return (
    <ActionForm action={inviteEventAction} submitLabel="Davet gönder" resetOnSuccess aria-label="Etkinlik daveti">
      <input type="hidden" name="eventId" value={eventId} />
      <span className="text-label text-fg-muted">İçerik üreticisi seç</span>
      <InfluencerPicker items={influencers} allLabel="Tümünü davet et" />
      <Field label="…veya sisteme kayıtsız misafir adı">{(p) => <Input {...p} name="guestName" placeholder="Ad Soyad" />}</Field>
    </ActionForm>
  );
}

export function InviteResponse({ inviteId }: { inviteId: string }) {
  return (
    <div className="flex flex-wrap items-end gap-2">
      <ActionForm action={respondInviteAction} aria-label="Daveti kabul et" className="!flex-row items-end gap-2">
        <input type="hidden" name="inviteId" value={inviteId} />
        <input type="hidden" name="accept" value="true" />
        <Input name="holderName" placeholder="Bilet üzerindeki ad (opsiyonel)" className="h-8 text-[12px]" />
        <Button type="submit" size="sm" variant="primary">Kabul et</Button>
      </ActionForm>
      <ActionForm action={respondInviteAction} aria-label="Daveti reddet" className="!flex-row">
        <input type="hidden" name="inviteId" value={inviteId} />
        <input type="hidden" name="accept" value="false" />
        <Button type="submit" size="sm" variant="ghost">Reddet</Button>
      </ActionForm>
    </div>
  );
}

/** Kapıda QR/kod ile giriş doğrulama. */
export function CheckInForm() {
  return (
    <ActionForm action={checkInAction} submitLabel="Girişi doğrula" resetOnSuccess aria-label="Bilet girişi">
      <Field label="Bilet kodu (QR'dan okunan)">{(p) => <Input {...p} name="code" required placeholder="TKT-XXXXXXXXXX" />}</Field>
    </ActionForm>
  );
}
