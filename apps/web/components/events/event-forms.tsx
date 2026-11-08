"use client";
import { useTT } from "@/lib/i18n/tt-client";
import { useMemo, useState, type ReactNode } from "react";
import { ActionForm } from "@/components/forms/action-form";
import { Button, Field, Input, Select, Textarea } from "@/components/ui/form";
import { BRAND_NAME } from "@/lib/brand";
import { ImageUpload } from "@/components/ui/image-upload";
import { MapPicker } from "@/components/ui/map-picker";
import { InfluencerPicker, type PickItem } from "@/components/ui/influencer-picker";
import { CalIcon, DateBadge, InfoRow, PersonIcon, PinIcon, Pill } from "@/components/luma/primitives";
import { cn } from "@/lib/cn";
import { rangeLabel } from "@/lib/event-format";
import { AGENCY_TZ, isDay, isTime, zonedToUtc } from "@/lib/time";
import { checkInAction, createEventAction, inviteEventAction, respondInviteAction, setEventStatusAction } from "@/lib/actions/events";

/** Numaralı form bölümü. */
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

function toDate(day: string, time: string): Date | null {
  if (!isDay(day)) return null;
  return zonedToUtc(day, isTime(time) ? time : "19:00", AGENCY_TZ);
}

/**
 * Etkinlik oluşturma: dört bölüm (temel bilgiler, tarih, konum, katılım ayarları) ve sağda
 * yazdıkça güncellenen Luma tarzı etkinlik sayfası önizlemesi. Başarıda yönetim sayfasına gider.
 */
export function EventCreateForm({ isAdmin, brands, organizerName }: { isAdmin: boolean; brands?: { id: string; name: string }[]; organizerName: string }) {
  const tt = useTT();
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [cover, setCover] = useState<string | null>(null);
  const [startDay, setStartDay] = useState("");
  const [startTime, setStartTime] = useState("19:00");
  const [endDay, setEndDay] = useState("");
  const [endTime, setEndTime] = useState("23:00");
  const [venue, setVenue] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [visibility, setVisibility] = useState("KAPALI");
  const [capacity, setCapacity] = useState("");
  const [org, setOrg] = useState(organizerName);

  const start = useMemo(() => toDate(startDay, startTime), [startDay, startTime]);
  const end = useMemo(() => (endDay ? toDate(endDay, endTime) : null), [endDay, endTime]);
  const endBeforeStart = !!(start && end && end < start);

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
      <ActionForm action={createEventAction} submitLabel={tt("Etkinliği oluştur")} aria-label={tt("Etkinlik oluştur")} className="gap-5">
        <Section n={1} title={tt("Temel bilgiler")} hint={tt("Misafirlerin ilk göreceği bilgiler.")}>
          {isAdmin && brands ? (
            <Field label={tt("Düzenleyen")}>
              {(p) => (
                <Select {...p} name="tenantId" defaultValue="" onChange={(e) => setOrg(brands.find((b) => b.id === e.target.value)?.name ?? organizerName)}>
                  <option value="">{tt("Ajans (")}{BRAND_NAME})</option>
                  {brands.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </Select>
              )}
            </Field>
          ) : null}
          <Field label={tt("Etkinlik adı")}>{(p) => <Input {...p} name="title" required minLength={3} maxLength={140} placeholder={tt("Yaz lansman gecesi")} onChange={(e) => setTitle(e.target.value)} />}</Field>
          <Field label={tt("Açıklama")} hint={tt("Program, dress code, misafirlerin bilmesi gerekenler.")}>
            {(p) => <Textarea {...p} name="description" required minLength={5} rows={4} onChange={(e) => setDesc(e.target.value)} />}
          </Field>
          <ImageUpload name="coverImageKey" label={tt("Kapak görseli (önerilen 1:1 veya 16:9)")} onPreview={setCover} />
        </Section>

        <Section n={2} title={tt("Tarih ve saat")} hint={tt("İstanbul saatiyle.")}>
          <div className="grid grid-cols-2 gap-3">
            <Field label={tt("Başlangıç tarihi")}>{(p) => <Input {...p} name="startsAtDay" type="date" required onChange={(e) => setStartDay(e.target.value)} />}</Field>
            <Field label={tt("Başlangıç saati")}>{(p) => <Input {...p} name="startsAtTime" type="time" defaultValue="19:00" onChange={(e) => setStartTime(e.target.value)} />}</Field>
            <Field label={tt("Bitiş tarihi")}>{(p) => <Input {...p} name="endsAtDay" type="date" min={startDay || undefined} onChange={(e) => setEndDay(e.target.value)} />}</Field>
            <Field label={tt("Bitiş saati")}>{(p) => <Input {...p} name="endsAtTime" type="time" defaultValue="23:00" onChange={(e) => setEndTime(e.target.value)} />}</Field>
          </div>
          {endBeforeStart ? <p role="alert" className="text-[13px] text-critical">{tt("Bitiş, başlangıçtan önce olamaz.")}</p> : null}
        </Section>

        <Section n={3} title={tt("Konum")} hint={tt("Haritadan seçerseniz misafirler tek dokunuşla yol tarifi alır.")}>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Field label={tt("Mekan adı")}>{(p) => <Input {...p} name="venueName" placeholder={tt("Studio X")} onChange={(e) => setVenue(e.target.value)} />}</Field>
            <Field label={tt("Şehir")}>{(p) => <Input {...p} name="city" placeholder={tt("İstanbul")} onChange={(e) => setCity(e.target.value)} />}</Field>
          </div>
          <Field label={tt("Adres")}>{(p) => <Input {...p} name="address" placeholder={tt("Açık adres")} onChange={(e) => setAddress(e.target.value)} />}</Field>
          <MapPicker />
        </Section>

        <Section n={4} title={tt("Katılım")} hint={tt("Kimler katılabilir, kaç kişi?")}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2" role="radiogroup" aria-label={tt("Görünürlük")}>
            {[
              { v: "KAPALI", t: "Yalnız davetliler", d: "Misafirleri siz seçersiniz. Oluşturduktan sonra davet edin." },
              { v: "HERKESE_ACIK", t: "Herkese açık", d: "Etkinlik sayfası bağlantıyla herkese açık olur." },
            ].map((o) => (
              <label key={o.v} className={cn("flex cursor-pointer flex-col gap-1 rounded-xl border p-3 transition-standard", visibility === o.v ? "border-fg bg-surface-hover" : "border-line hover:border-line-strong")}>
                <span className="flex items-center gap-2 font-medium text-fg">
                  <input type="radio" name="visibility" value={o.v} checked={visibility === o.v} onChange={() => setVisibility(o.v)} className="h-4 w-4 accent-[var(--color-fg)]" />
                  {o.t}
                </span>
                <span className="text-[13px] text-fg-muted">{o.d}</span>
              </label>
            ))}
          </div>
          <Field label={tt("Kapasite (boş = sınırsız)")}>{(p) => <Input {...p} name="capacity" type="number" min={1} placeholder="100" onChange={(e) => setCapacity(e.target.value)} className="max-w-40" />}</Field>
        </Section>
      </ActionForm>

      <aside className="lg:sticky lg:top-6 lg:self-start" aria-label={tt("Etkinlik sayfası önizlemesi")}>
        <p className="mb-2 text-[12px] font-medium text-fg-muted">{tt("Önizleme · misafirlerin göreceği sayfa")}</p>
        <div className="overflow-hidden rounded-3xl border border-line bg-bg">
          <div className="aspect-[16/10] w-full overflow-hidden">
            {cover ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={cover} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-[linear-gradient(135deg,var(--color-neon-violet),var(--color-neon-pink))] text-[13px] text-white/80">{tt("Kapak görseli")}</div>
            )}
          </div>
          <div className="flex flex-col gap-4 p-5">
            <div className="flex flex-wrap gap-2">
              <Pill tone="gray">{tt("Taslak")}</Pill>
              <Pill>{visibility === "HERKESE_ACIK" ? tt("Herkese açık") : tt("Yalnız davetliler")}</Pill>
            </div>
            <h3 className="text-[22px] font-semibold leading-tight text-fg">{title || tt("Etkinlik adı")}</h3>
            <InfoRow icon={start ? <DateBadge date={start} size="sm" /> : <CalIcon />} title={start ? rangeLabel(start, end) : tt("Tarih seçilmedi")} />
            <InfoRow icon={<PinIcon />} title={venue || tt("Mekan")}>{[address, city].filter(Boolean).join(", ") || tt("Adres")}</InfoRow>
            <InfoRow icon={<PersonIcon />} title={org}>{capacity ? `${capacity} kişilik` : tt("Kapasite sınırsız")}</InfoRow>
            {desc ? <p className="line-clamp-4 whitespace-pre-line border-t border-line pt-3 text-[13px] text-fg-muted">{desc}</p> : null}
          </div>
        </div>
      </aside>
    </div>
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

/** Misafir davet et: kayıtlı içerik üreticilerinden çoklu seçim veya kayıtsız misafir adı. */
export function InviteForm({ eventId, influencers }: { eventId: string; influencers: PickItem[] }) {
  const tt = useTT();
  return (
    <ActionForm action={inviteEventAction} submitLabel={tt("Davet gönder")} resetOnSuccess aria-label={tt("Etkinlik daveti")}>
      <input type="hidden" name="eventId" value={eventId} />
      <InfluencerPicker items={influencers} allLabel="Tümünü seç" />
      <Field label={tt("Kayıtsız misafir (opsiyonel)")} hint={tt("Sistemde hesabı olmayan biri için ad soyad.")}>
        {(p) => <Input {...p} name="guestName" placeholder={tt("Ad Soyad")} />}
      </Field>
    </ActionForm>
  );
}

/**
 * Katılım seçimi: Katılıyorum / Katılmıyorum. İstenildiği zaman değiştirilebilir;
 * katılıyorum bilet üretir (ad sistemden gelir), katılmıyorum bileti iptal eder.
 */
export function AttendanceToggle({ inviteId, current, labels = ["Katılıyorum", "Katılmıyorum"] }: { inviteId: string; current: string; labels?: [string, string] }) {
  const tt = useTT();
  const opts: { value: "true" | "false"; label: string; on: boolean }[] = [
    { value: "true", label: labels[0], on: current === "KABUL" },
    { value: "false", label: labels[1], on: current === "RED" },
  ];
  return (
    <ActionForm action={respondInviteAction} aria-label={tt("Katılım durumu")} className="!gap-2">
      <input type="hidden" name="inviteId" value={inviteId} />
      <div className="inline-flex w-fit rounded-full border border-line bg-surface p-0.5" role="group" aria-label={tt("Katılım durumu")}>
        {opts.map((o) => (
          <button
            key={o.value}
            type="submit"
            name="accept"
            value={o.value}
            aria-pressed={o.on}
            disabled={o.on}
            className={cn(
              "rounded-full px-3 py-1 text-[13px] font-medium transition-standard disabled:cursor-default",
              o.on ? (o.value === "true" ? "bg-emerald-500 text-white" : "bg-fg text-bg") : "text-fg-muted hover:text-fg",
            )}
          >
            {o.on ? "✓ " : ""}
            {o.label}
          </button>
        ))}
      </div>
    </ActionForm>
  );
}

/** Yönetim sayfası için (organizatör misafir adına onaylar/reddeder). */
export function InviteResponse({ inviteId, current = "DAVET_EDILDI" }: { inviteId: string; current?: string }) {
  return <AttendanceToggle inviteId={inviteId} current={current} labels={["Onayla", "Reddet"]} />;
}

/** Kapıda bilet kodu ile giriş. */
export function CheckInForm() {
  const tt = useTT();
  return (
    <ActionForm action={checkInAction} submitLabel={tt("Girişi onayla")} resetOnSuccess aria-label={tt("Bilet girişi")}>
      <Field label={tt("Bilet kodu")} hint={tt("QR okutun veya kodu yazın.")}>
        {(p) => <Input {...p} name="code" required placeholder={tt("TKT-XXXXXXXXXX")} autoComplete="off" className="font-mono uppercase" />}
      </Field>
    </ActionForm>
  );
}
