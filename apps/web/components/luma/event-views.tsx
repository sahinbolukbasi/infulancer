import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@infulancer/core/db";
import { envStr } from "@infulancer/core/env";
import { googleCalendarUrl } from "@infulancer/core/wallet/ical";
import { mapLinks } from "@infulancer/core/wallet/maps";
import { CheckInForm, EventStatusButton, InviteForm, InviteResponse } from "@/components/events/event-forms";
import { ButtonLink } from "@/components/ui/form";
import { Tabs } from "@/components/ui/tabs";
import { CopyCode } from "@/components/wallet/copy-code";
import { dateLong, pctOf, rangeLabel, timeShort } from "@/lib/event-format";
import { mediaSrc } from "@/lib/media";
import { fmtDateTime } from "@/lib/time";
import { EventListItem, eventStatusView } from "./list-items";
import { ListToolbar, type ToolbarSelect } from "./list-toolbar";
import { BackLink, CalIcon, DateBadge, FilterTabs, InfoRow, PersonIcon, PinIcon, Pill, SectionHead, StatStrip, type PillTone } from "./primitives";
const FILTERS = [
  { id: "yaklasan", label: "Yaklaşan" },
  { id: "gecmis", label: "Geçmiş" },
  { id: "taslak", label: "Taslak" },
  { id: "tumu", label: "Tümü" },
] as const;
const monthYear = new Intl.DateTimeFormat("tr-TR", { month: "long", year: "numeric", timeZone: "Europe/Istanbul" });
/** Etkinlik listesi (admin: tüm etkinlikler; marka: yalnız kendi). Luma zaman çizelgesi düzeni. */
export async function EventsIndex({
  basePath,
  tenantId,
  filter,
  query,
  brandFilter,
  title,
  description,
}: {
  basePath: string;
  tenantId?: string;
  filter?: string;
  query?: string;
  brandFilter?: string;
  title: string;
  description: string;
}) {
  const where = tenantId ? { tenantId } : {};
  const events = await prisma.event.findMany({
    where,
    orderBy: { startsAt: "asc" },
    take: 300,
    include: { invites: { select: { status: true } }, tickets: { select: { status: true } } },
  });
  const brands = new Map((await prisma.brand.findMany({ where: { id: { in: [...new Set(events.map((e) => e.tenantId).filter((x): x is string => !!x))] } }, select: { id: true, name: true } })).map((b) => [b.id, b.name]));
  const now = new Date();
  const isPast = (e: (typeof events)[number]) => (e.endsAt ?? e.startsAt) < now || e.status === "TAMAMLANDI";
  const orgName = (e: (typeof events)[number]) => (e.tenantId ? (brands.get(e.tenantId) ?? "Marka") : "Infulancer");
  // Arama (başlık, mekan, şehir, düzenleyen) ve marka filtresi bucket'lardan ÖNCE uygulanır;
  // böylece sekme sayıları da filtrelenmiş sonucu yansıtır.
  const q = (query ?? "").trim().toLocaleLowerCase("tr");
  const canFilterBrand = !tenantId; // yalnız admin/ajans görünümünde marka seçilebilir
  const filtered = events.filter((e) => {
    if (canFilterBrand && brandFilter && e.tenantId !== brandFilter) return false;
    if (q) {
      const hay = `${e.title} ${e.venueName ?? ""} ${e.city ?? ""} ${e.address ?? ""} ${orgName(e)}`.toLocaleLowerCase("tr");
      if (!hay.includes(q)) return false;
    }
    return true;
  });
  const buckets = {
    yaklasan: filtered.filter((e) => !isPast(e) && e.status !== "IPTAL" && e.status !== "TASLAK"),
    gecmis: filtered.filter((e) => isPast(e)).reverse(),
    taslak: filtered.filter((e) => e.status === "TASLAK"),
    tumu: [...filtered].reverse(),
  };
  const searching = !!q || (canFilterBrand && !!brandFilter);
  // Arama/filtre varken "Tümü"ne düş ki sonuçlar sekmeyle gizlenmesin.
  const active = (FILTERS.some((f) => f.id === filter) ? filter : searching ? "tumu" : buckets.yaklasan.length || !events.length ? "yaklasan" : "tumu") as keyof typeof buckets;
  const list = buckets[active];
  const invites = events.flatMap((e) => e.invites);
  const going = invites.filter((i) => i.status === "KABUL").length;
  const checkedIn = events.flatMap((e) => e.tickets).filter((t) => t.status === "KULLANILDI").length;
  const keep = (id: string) => `${basePath}?filtre=${id}${q ? `&ara=${encodeURIComponent(q)}` : ""}${canFilterBrand && brandFilter ? `&marka=${brandFilter}` : ""}`;
  const brandOptions = canFilterBrand
    ? [...brands.entries()].map(([id, name]) => ({ value: id, label: name })).sort((a, b) => a.label.localeCompare(b.label, "tr"))
    : [];
  const selects: ToolbarSelect[] = brandOptions.length ? [{ param: "marka", label: "Tüm markalar", options: brandOptions }] : [];
  // Ay başlıklarıyla grupla.
  const groups: { key: string; items: typeof list }[] = [];
  for (const e of list) {
    const key = monthYear.format(e.startsAt);
    const g = groups.at(-1);
    if (g && g.key === key) g.items.push(e);
    else groups.push({ key, items: [e] });
  }
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-title text-fg">{title}</h1>
          <p className="text-[14px] text-fg-muted">{description}</p>
        </div>
        <ButtonLink href={`${basePath}/yeni`}>+ Etkinlik oluştur</ButtonLink>
      </header>
      {events.length ? (
        <StatStrip
          stats={[
            { label: "Yaklaşan", value: String(buckets.yaklasan.length) },
            { label: "Taslak", value: String(buckets.taslak.length) },
            { label: "Davet", value: String(invites.length) },
            { label: "Katılıyor", value: String(going) },
            { label: "Katılım oranı", value: `%${pctOf(going, invites.length)}` },
            { label: "Giriş yapan", value: String(checkedIn) },
          ]}
        />
      ) : null}
      {events.length ? (
        <ListToolbar
          searchPlaceholder="Etkinlik, mekan veya şehir ara"
          selects={selects}
          initialQuery={query ?? ""}
          resultLabel={searching ? `${filtered.length} sonuç${q ? ` · “${query}”` : ""}` : undefined}
        />
      ) : null}
      <FilterTabs active={active} items={FILTERS.map((f) => ({ id: f.id, label: f.label, href: keep(f.id), count: buckets[f.id].length }))} />
      {list.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-line px-6 py-14 text-center">
          <span className="text-fg-muted"><CalIcon /></span>
          <p className="font-medium text-fg">{searching ? "Aramanıza uyan etkinlik yok" : events.length ? "Bu görünümde etkinlik yok" : "Henüz etkinlik yok"}</p>
          <p className="max-w-sm text-[13px] text-fg-muted">
            {searching ? "Farklı bir anahtar kelime deneyin veya filtreyi temizleyin." : "Etkinlik oluşturun, misafirlerinizi davet edin; katılanlara QR'lı bilet otomatik gider."}
          </p>
          {!searching ? <ButtonLink href={`${basePath}/yeni`} size="sm">Etkinlik oluştur</ButtonLink> : null}
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {groups.map((g) => (
            <section key={g.key} className="flex flex-col gap-3" aria-label={g.key}>
              <h2 className="text-[13px] font-semibold uppercase tracking-wide text-fg-muted">{g.key}</h2>
              <ol className="flex flex-col gap-3">
                {g.items.map((e) => (
                  <EventListItem
                    key={e.id}
                    e={{
                      id: e.id,
                      href: `${basePath}/${e.id}`,
                      title: e.title,
                      organizer: orgName(e),
                      startsAt: e.startsAt,
                      venueLabel: [e.venueName, e.city].filter(Boolean).join(", ") || null,
                      coverSrc: mediaSrc(e.coverImageKey),
                      status: e.status,
                      visibility: e.visibility,
                      guests: e.invites.length,
                      going: e.invites.filter((i) => i.status === "KABUL").length,
                      capacity: e.capacity,
                    }}
                  />
                ))}
              </ol>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
const inviteView: Record<string, { label: string; tone: PillTone }> = {
  DAVET_EDILDI: { label: "Yanıt bekliyor", tone: "amber" },
  KATILIM_TALEBI: { label: "Katılım talebi", tone: "violet" },
  KABUL: { label: "Katılıyor", tone: "green" },
  RED: { label: "Katılmıyor", tone: "red" },
  IPTAL: { label: "İptal", tone: "gray" },
};
/** Etkinlik yönetim sayfası (Luma "manage event"): genel bakış, misafirler, giriş, paylaş. */
export async function EventManage({ id, basePath, tenantId, tab }: { id: string; basePath: string; tenantId?: string; tab?: string }) {
  const e = await prisma.event.findUnique({
    where: { id },
    include: { invites: { orderBy: { createdAt: "desc" }, include: { ticket: true } }, tickets: { orderBy: { checkedInAt: "desc" } } },
  });
  if (!e || (tenantId && e.tenantId !== tenantId)) notFound();
  const [organizer, influencers, invitedNames] = await Promise.all([
    e.tenantId ? prisma.brand.findUnique({ where: { id: e.tenantId }, select: { name: true } }) : null,
    prisma.influencer.findMany({ where: { user: { status: "ACTIVE" } }, orderBy: { name: "asc" }, select: { id: true, name: true, category: true } }),
    prisma.influencer.findMany({ where: { id: { in: e.invites.map((i) => i.influencerId).filter((x): x is string => !!x) } }, select: { id: true, name: true } }),
  ]);
  const names = new Map(invitedNames.map((x) => [x.id, x.name]));
  const orgName = organizer?.name ?? "Infulancer";
  const invitedIds = new Set(e.invites.map((i) => i.influencerId).filter(Boolean));
  const pickable = influencers.filter((i) => !invitedIds.has(i.id));
  const going = e.invites.filter((i) => i.status === "KABUL").length;
  const declined = e.invites.filter((i) => i.status === "RED").length;
  const pending = e.invites.filter((i) => i.status === "DAVET_EDILDI" || i.status === "KATILIM_TALEBI").length;
  const liveTickets = e.tickets.filter((t) => t.status !== "IPTAL");
  const checkedIn = e.tickets.filter((t) => t.status === "KULLANILDI");
  const st = eventStatusView[e.status] ?? { label: e.status, tone: "gray" as PillTone };
  const cover = mediaSrc(e.coverImageKey);
  const map = mapLinks({ latitude: e.latitude, longitude: e.longitude, address: e.address, venueName: e.venueName });
  const location = [e.venueName, e.address, e.city].filter(Boolean).join(", ");
  const base = envStr("APP_URL", "").replace(/\/$/, "");
  const publicUrl = `${base}/etkinlik/${e.id}`;
  const gcal = googleCalendarUrl({ uid: e.id, title: e.title, description: e.description, location: location || null, startsAt: e.startsAt, endsAt: e.endsAt });
  const needsGuests = e.invites.length === 0 && e.status !== "IPTAL";
  const guests = (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
      <section className="flex flex-col gap-3" aria-label="Misafir listesi">
        <SectionHead title={`Misafirler (${e.invites.length})`} />
        {e.invites.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line px-4 py-8 text-center text-[13px] text-fg-muted">Henüz misafir yok. Sağdaki listeden içerik üreticisi seçip davet gönderin.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
            {e.invites.map((inv) => {
              const name = inv.influencerId ? (names.get(inv.influencerId) ?? "İçerik üreticisi") : (inv.guestName ?? "Misafir");
              const view = inviteView[inv.status] ?? { label: inv.status, tone: "gray" as PillTone };
              const ticket = inv.ticket && inv.ticket.status !== "IPTAL" ? inv.ticket : null;
              return (
                <li key={inv.id} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-hover text-[13px] font-semibold text-fg" aria-hidden>
                      {name.slice(0, 1).toLocaleUpperCase("tr")}
                    </span>
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate font-medium text-fg">{name}</span>
                      <span className="flex flex-wrap items-center gap-2 text-[12px] text-fg-muted">
                        <Pill tone={view.tone}>{view.label}</Pill>
                        {inv.isRequest ? <span>talep</span> : null}
                        {ticket?.status === "KULLANILDI" && ticket.checkedInAt ? <span>Giriş {timeShort(ticket.checkedInAt)}</span> : null}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    {ticket ? (
                      <>
                        <CopyCode code={ticket.code} tone="app" size="sm" />
                        <Link href={`/bilet/${ticket.id}`} className="text-[13px] font-medium text-fg underline-offset-4 hover:underline">Bilet</Link>
                      </>
                    ) : null}
                    {inv.status !== "IPTAL" ? <InviteResponse inviteId={inv.id} current={inv.status} /> : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
      <section className="flex flex-col gap-3 xl:sticky xl:top-6 xl:self-start" aria-label="Misafir davet et">
        <SectionHead title="Misafir davet et" />
        <div className="rounded-2xl border border-line bg-surface p-4">
          {e.status === "IPTAL" ? <p className="text-[13px] text-fg-muted">İptal edilmiş etkinliğe davet gönderilemez.</p> : <InviteForm eventId={e.id} influencers={pickable} />}
        </div>
      </section>
    </div>
  );
  const checkin = (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
      <section className="flex flex-col gap-3">
        <SectionHead title="Kapıda giriş" />
        <div className="rounded-2xl border border-line bg-surface p-4">
          <CheckInForm />
        </div>
      </section>
      <section className="flex flex-col gap-3">
        <SectionHead title={`Giriş yapanlar (${checkedIn.length}/${liveTickets.length})`} />
        {checkedIn.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line px-4 py-8 text-center text-[13px] text-fg-muted">Henüz giriş yapan yok.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface text-sm">
            {checkedIn.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <span className="font-medium text-fg">{t.holderName}</span>
                <span className="text-[12px] tabular-nums text-fg-muted">{t.checkedInAt ? fmtDateTime(t.checkedInAt) : ""}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
  const share = (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <section className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-5">
        <h3 className="font-semibold text-fg">Etkinlik sayfası</h3>
        <p className="text-[13px] text-fg-muted">{e.visibility === "HERKESE_ACIK" ? "Bağlantıya sahip herkes sayfayı görebilir." : "Sayfa bağlantıyla açılır; bilet yalnız davetlilere verilir."}</p>
        <CopyCode code={publicUrl} tone="app" size="sm" />
        <Link href={`/etkinlik/${e.id}`} target="_blank" className="w-fit text-[13px] font-medium text-fg underline-offset-4 hover:underline">Sayfayı aç ↗</Link>
      </section>
      <section className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-5">
        <h3 className="font-semibold text-fg">Takvim ve konum</h3>
        <div className="flex flex-wrap gap-2 text-[13px]">
          <a href={gcal} target="_blank" rel="noreferrer" className="rounded-full border border-line px-3 py-1.5 hover:border-line-strong">Google Takvim</a>
          <a href={`/api/etkinlik/${e.id}/ics`} className="rounded-full border border-line px-3 py-1.5 hover:border-line-strong">Apple / Outlook (.ics)</a>
          {map.hasCoords || e.address ? (
            <>
              <a href={map.google} target="_blank" rel="noreferrer" className="rounded-full border border-line px-3 py-1.5 hover:border-line-strong">Google Haritalar</a>
              <a href={map.apple} target="_blank" rel="noreferrer" className="rounded-full border border-line px-3 py-1.5 hover:border-line-strong">Apple Haritalar</a>
            </>
          ) : null}
        </div>
      </section>
    </div>
  );
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <BackLink href={basePath}>Etkinlikler</BackLink>
      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            <Pill tone={st.tone}>{st.label}</Pill>
            <Pill>{e.visibility === "HERKESE_ACIK" ? "Herkese açık" : "Yalnız davetliler"}</Pill>
          </div>
          <h1 className="text-title text-fg">{e.title}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/etkinlik/${e.id}`} target="_blank" className="inline-flex h-8 items-center rounded-[8px] border border-border px-3 text-[13px] text-fg hover:border-border-strong">Etkinlik sayfası ↗</Link>
          {e.status === "TASLAK" ? <EventStatusButton id={e.id} to="YAYINDA" label="Yayınla" variant="primary" /> : null}
          {e.status === "YAYINDA" ? <EventStatusButton id={e.id} to="TAMAMLANDI" label="Tamamlandı" /> : null}
          {e.status === "TASLAK" || e.status === "YAYINDA" ? <EventStatusButton id={e.id} to="IPTAL" label="İptal et" variant="ghost" /> : null}
        </div>
      </header>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-[280px_minmax(0,1fr)]">
        <div className="aspect-square w-full overflow-hidden rounded-3xl border border-line">
          {cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cover} alt={`${e.title} kapak görseli`} className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full bg-[linear-gradient(135deg,var(--color-neon-violet),var(--color-neon-pink))] opacity-85" />
          )}
        </div>
        <div className="flex flex-col gap-4">
          <InfoRow icon={<DateBadge date={e.startsAt} size="sm" />} title={rangeLabel(e.startsAt, e.endsAt)}>{dateLong(e.startsAt)}</InfoRow>
          <InfoRow icon={<PinIcon />} title={e.venueName || "Konum eklenmedi"}>
            {[e.address, e.city].filter(Boolean).join(", ") || null}
            {map.hasCoords || e.address ? (
              <span className="ml-1">
                · <a href={map.google} target="_blank" rel="noreferrer" className="underline-offset-4 hover:underline">Google</a> · <a href={map.apple} target="_blank" rel="noreferrer" className="underline-offset-4 hover:underline">Apple</a>
              </span>
            ) : null}
          </InfoRow>
          <InfoRow icon={<PersonIcon />} title={`Düzenleyen: ${orgName}`}>{e.capacity ? `${liveTickets.length}/${e.capacity} bilet` : `${liveTickets.length} bilet · kapasite sınırsız`}</InfoRow>
          <p className="line-clamp-4 whitespace-pre-line text-[14px] text-fg-muted">{e.description}</p>
        </div>
      </div>
      <StatStrip
        stats={[
          { label: "Davet", value: String(e.invites.length) },
          { label: "Katılıyor", value: String(going) },
          { label: "Katılmıyor", value: String(declined) },
          { label: "Yanıt bekliyor", value: String(pending) },
          { label: "Giriş yapan", value: String(checkedIn.length), hint: `bilet: ${liveTickets.length}` },
          { label: "Doluluk", value: e.capacity ? `%${pctOf(liveTickets.length, e.capacity)}` : "—", hint: e.capacity ? `${e.capacity} kapasite` : "sınırsız" },
        ]}
      />
      {needsGuests ? (
        <div className="flex flex-col gap-1 rounded-2xl border border-violet-500/30 bg-violet-500/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-medium text-fg">{e.visibility === "KAPALI" ? "Bu etkinlik yalnız davetliler için" : "İlk misafirlerinizi davet edin"}</p>
            <p className="text-[13px] text-fg-muted">Aşağıdaki &quot;Misafirler&quot; bölümünden içerik üreticisi seçip davet gönderin; kabul edenlere bilet otomatik oluşur.</p>
          </div>
          {e.status === "TASLAK" ? <p className="text-[12px] text-fg-muted">Davetten önce yayınlamanız önerilir.</p> : null}
        </div>
      ) : null}
      <Tabs
        key={tab ?? "misafirler"}
        label="Etkinlik yönetimi"
        defaultTab={tab}
        tabs={[
          { id: "misafirler", label: `Misafirler (${e.invites.length})`, content: guests },
          { id: "giris", label: `Giriş (${checkedIn.length})`, content: checkin },
          { id: "paylas", label: "Paylaş", content: share },
        ]}
      />
    </div>
  );
}
