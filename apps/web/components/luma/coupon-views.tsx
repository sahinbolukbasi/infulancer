import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@infulancer/core/db";
import { couponValueLabel } from "@infulancer/core/coupons/service";
import { CouponStatusButton, GrantForm } from "@/components/coupons/coupon-forms";
import { ButtonLink } from "@/components/ui/form";
import { Tabs } from "@/components/ui/tabs";
import { CopyCode } from "@/components/wallet/copy-code";
import { dateLong, pctOf } from "@/lib/event-format";
import { mediaSrc } from "@/lib/media";
import { fmtDate } from "@/lib/time";
import { CouponTile, couponStatusView } from "./list-items";
import { CouponCard } from "./pass-cards";
import { ListToolbar, type ToolbarSelect } from "./list-toolbar";
import { BackLink, FilterTabs, Pill, SectionHead, StatStrip, TagIcon, type PillTone } from "./primitives";

const FILTERS = [
  { id: "tumu", label: "Tümü" },
  { id: "yayinda", label: "Yayında" },
  { id: "taslak", label: "Taslak" },
  { id: "pasif", label: "Pasif" },
] as const;
const DAY = 86_400_000;

function kindLabel(kind: string) {
  return kind === "HEDIYE_CEKI" ? "Hediye çeki" : "Kupon";
}

/** Kupon listesi (admin: tümü; marka: kendi). Kart ızgarası + analitik şeridi. */
export async function CouponsIndex({
  basePath,
  tenantId,
  filter,
  query,
  brandFilter,
  kindFilter,
  title,
  description,
}: {
  basePath: string;
  tenantId?: string;
  filter?: string;
  query?: string;
  brandFilter?: string;
  kindFilter?: string;
  title: string;
  description: string;
}) {
  const coupons = await prisma.coupon.findMany({ where: tenantId ? { tenantId } : {}, orderBy: { createdAt: "desc" }, take: 300, include: { grants: { select: { status: true } } } });
  const brands = new Map((await prisma.brand.findMany({ where: { id: { in: [...new Set(coupons.map((c) => c.tenantId))] } }, select: { id: true, name: true } })).map((b) => [b.id, b.name]));
  const now = new Date().getTime();
  const brandName = (c: (typeof coupons)[number]) => brands.get(c.tenantId) ?? "Marka";
  // Arama (başlık, marka, kod, açıklama), marka ve tür filtreleri bucket'lardan ÖNCE uygulanır.
  const q = (query ?? "").trim().toLocaleLowerCase("tr");
  const canFilterBrand = !tenantId;
  const filtered = coupons.filter((c) => {
    if (canFilterBrand && brandFilter && c.tenantId !== brandFilter) return false;
    if (kindFilter && c.kind !== kindFilter) return false;
    if (q) {
      const hay = `${c.title} ${brandName(c)} ${c.sharedCode ?? ""} ${c.description ?? ""}`.toLocaleLowerCase("tr");
      if (!hay.includes(q)) return false;
    }
    return true;
  });
  const searching = !!q || (canFilterBrand && !!brandFilter) || !!kindFilter;
  const buckets = {
    tumu: filtered,
    yayinda: filtered.filter((c) => c.status === "YAYINDA"),
    taslak: filtered.filter((c) => c.status === "TASLAK"),
    pasif: filtered.filter((c) => c.status === "PASIF"),
  };
  const active = (FILTERS.some((f) => f.id === filter) ? filter : "tumu") as keyof typeof buckets;
  const list = buckets[active];
  const grants = coupons.flatMap((c) => c.grants);
  const used = grants.filter((g) => g.status === "KULLANILDI").length;
  const expiringSoon = coupons.filter((c) => c.status === "YAYINDA" && c.validUntil && c.validUntil.getTime() > now && c.validUntil.getTime() - now < 7 * DAY).length;
  const keep = (id: string) => `${basePath}?filtre=${id}${q ? `&ara=${encodeURIComponent(q)}` : ""}${canFilterBrand && brandFilter ? `&marka=${brandFilter}` : ""}${kindFilter ? `&tur=${kindFilter}` : ""}`;
  const brandOptions = canFilterBrand
    ? [...brands.entries()].map(([id, name]) => ({ value: id, label: name })).sort((a, b) => a.label.localeCompare(b.label, "tr"))
    : [];
  const selects: ToolbarSelect[] = [
    ...(brandOptions.length ? [{ param: "marka", label: "Tüm markalar", options: brandOptions }] : []),
    { param: "tur", label: "Tüm türler", options: [{ value: "KUPON", label: "Kupon" }, { value: "HEDIYE_CEKI", label: "Hediye çeki" }] },
  ];

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-title text-fg">{title}</h1>
          <p className="text-[14px] text-fg-muted">{description}</p>
        </div>
        <ButtonLink href={`${basePath}/yeni`}>+ Kupon oluştur</ButtonLink>
      </header>

      {coupons.length ? (
        <StatStrip
          stats={[
            { label: "Yayında", value: String(buckets.yayinda.length) },
            { label: "Taslak", value: String(buckets.taslak.length) },
            { label: "Gönderim", value: String(grants.length) },
            { label: "Kullanım", value: String(used) },
            { label: "Kullanım oranı", value: `%${pctOf(used, grants.length)}` },
            { label: "7 günde bitiyor", value: String(expiringSoon) },
          ]}
        />
      ) : null}

      {coupons.length ? (
        <ListToolbar
          searchPlaceholder="Kupon, marka veya kod ara"
          selects={selects}
          initialQuery={query ?? ""}
          resultLabel={searching ? `${filtered.length} sonuç${q ? ` · “${query}”` : ""}` : undefined}
        />
      ) : null}
      <FilterTabs active={active} items={FILTERS.map((f) => ({ id: f.id, label: f.label, href: keep(f.id), count: buckets[f.id].length }))} />

      {list.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-line px-6 py-14 text-center">
          <span className="text-fg-muted"><TagIcon /></span>
          <p className="font-medium text-fg">{searching ? "Aramanıza uyan kupon yok" : coupons.length ? "Bu görünümde kupon yok" : "Henüz kupon yok"}</p>
          <p className="max-w-sm text-[13px] text-fg-muted">
            {searching ? "Farklı bir anahtar kelime deneyin veya filtreyi temizleyin." : "Logolu indirim kuponu veya hediye çeki tasarlayın, içerik üreticilerine gönderin; kartlar cüzdana eklenebilir."}
          </p>
          {!searching ? <ButtonLink href={`${basePath}/yeni`} size="sm">Kupon oluştur</ButtonLink> : null}
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((c) => {
            const expired = !!c.validUntil && c.validUntil.getTime() < now;
            return (
              <CouponTile
                key={c.id}
                c={{
                  id: c.id,
                  href: `${basePath}/${c.id}`,
                  title: c.title,
                  brandName: brandName(c),
                  kindLabel: kindLabel(c.kind),
                  valueLabel: couponValueLabel(c.valueType, c.value),
                  status: c.status,
                  accent: c.brandColor ?? "#ff2bd6",
                  logoSrc: mediaSrc(c.logoKey),
                  sent: c.grants.length,
                  used: c.grants.filter((g) => g.status === "KULLANILDI").length,
                  validLabel: c.validUntil ? `Son kullanım ${fmtDate(c.validUntil)}` : "Süresiz",
                  expired,
                }}
              />
            );
          })}
        </ul>
      )}
    </div>
  );
}

const grantView: Record<string, { label: string; tone: PillTone }> = {
  GONDERILDI: { label: "Gönderildi", tone: "gray" },
  GORULDU: { label: "Görüldü", tone: "violet" },
  KULLANILDI: { label: "Kullanıldı", tone: "green" },
  IPTAL: { label: "İptal", tone: "red" },
};

/** Kupon yönetim sayfası: kart önizlemesi, ayrıntılar, analitik, alıcılar, gönderim. */
export async function CouponManage({ id, basePath, tenantId, tab }: { id: string; basePath: string; tenantId?: string; tab?: string }) {
  const c = await prisma.coupon.findUnique({ where: { id }, include: { grants: { orderBy: { createdAt: "desc" } } } });
  if (!c || (tenantId && c.tenantId !== tenantId)) notFound();
  const [brand, influencers, recipientNames] = await Promise.all([
    prisma.brand.findUnique({ where: { id: c.tenantId }, select: { name: true } }),
    prisma.influencer.findMany({ where: { user: { status: "ACTIVE" } }, orderBy: { name: "asc" }, select: { id: true, name: true, category: true } }),
    prisma.influencer.findMany({ where: { id: { in: c.grants.map((g) => g.influencerId).filter((x): x is string => !!x) } }, select: { id: true, name: true } }),
  ]);
  const names = new Map(recipientNames.map((x) => [x.id, x.name]));
  const sentTo = new Set(c.grants.map((g) => g.influencerId).filter(Boolean));
  const pickable = influencers.filter((i) => !sentTo.has(i.id));

  const now = new Date().getTime();
  const used = c.grants.filter((g) => g.status === "KULLANILDI").length;
  const expired = !!c.validUntil && c.validUntil.getTime() < now;
  const daysLeft = c.validUntil ? Math.max(0, Math.ceil((c.validUntil.getTime() - now) / DAY)) : null;
  const st = couponStatusView[c.status] ?? { label: c.status, tone: "gray" as PillTone };
  const shared = !!c.sharedCode;
  const brandName = brand?.name ?? "Marka";

  const recipients = (
    <section className="flex flex-col gap-3" aria-label="Alıcılar">
      <SectionHead title={`Alıcılar (${c.grants.length})`} action={c.grants.length ? <a href={`/api/kupon/${c.id}/csv`} className="rounded-full border border-line px-3 py-1 text-[12px] text-fg hover:border-line-strong">CSV indir</a> : null} />
      {c.grants.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line px-4 py-8 text-center text-[13px] text-fg-muted">Henüz gönderim yok. &quot;Gönder&quot; sekmesinden alıcı seçin.</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
          <table className="w-full text-sm">
            <caption className="sr-only">Kupon alıcıları ve kodları</caption>
            <thead className="text-left text-[12px] text-fg-muted">
              <tr className="border-b border-line">
                <th scope="col" className="px-4 py-2.5 font-medium">Alıcı</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Kod</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Durum</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Gönderim</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Kullanım</th>
                <th scope="col" className="px-4 py-2.5 font-medium"><span className="sr-only">Kart</span></th>
              </tr>
            </thead>
            <tbody>
              {c.grants.map((g) => {
                const v = grantView[g.status] ?? { label: g.status, tone: "gray" as PillTone };
                return (
                  <tr key={g.id} className="border-b border-line last:border-b-0">
                    <td className="px-4 py-2.5 font-medium text-fg">{g.influencerId ? (names.get(g.influencerId) ?? "İçerik üreticisi") : "—"}</td>
                    <td className="px-4 py-2.5">
                      <CopyCode code={c.sharedCode ?? g.code} tone="app" size="sm" />
                      {shared ? <span className="mt-0.5 block font-mono text-[11px] text-fg-passive">takip: {g.code}</span> : null}
                    </td>
                    <td className="px-4 py-2.5"><Pill tone={v.tone}>{v.label}</Pill></td>
                    <td className="px-4 py-2.5 tabular-nums text-fg-muted">{fmtDate(g.createdAt)}</td>
                    <td className="px-4 py-2.5 tabular-nums text-fg-muted">{g.redeemedAt ? fmtDate(g.redeemedAt) : "—"}</td>
                    <td className="px-4 py-2.5 text-right"><Link href={`/kupon/${g.id}`} className="text-[13px] font-medium text-fg underline-offset-4 hover:underline">Kart</Link></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );

  const send = (
    <section className="flex max-w-2xl flex-col gap-3" aria-label="Gönder">
      <SectionHead title="Alıcı seç ve gönder" />
      {c.status !== "YAYINDA" ? (
        <div className="flex flex-col gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
          <p className="text-[13px] text-fg">Gönderim için kuponu önce yayına alın.</p>
          <CouponStatusButton id={c.id} to="YAYINDA" label="Yayına al" variant="primary" />
        </div>
      ) : (
        <div className="rounded-2xl border border-line bg-surface p-4">
          <p className="mb-3 text-[13px] text-fg-muted">{shared ? `Alıcılar ortak kodu (${c.sharedCode}) görür; takip için her gönderime ayrı iz kodu verilir.` : "Her alıcıya benzersiz kod üretilir."} Daha önce gönderilenler listede yer almaz.</p>
          <GrantForm couponId={c.id} influencers={pickable} />
        </div>
      )}
    </section>
  );

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <BackLink href={basePath}>Kuponlar</BackLink>
      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            <Pill tone={st.tone}>{st.label}</Pill>
            <Pill>{kindLabel(c.kind)}</Pill>
            {expired ? <Pill tone="red">Süresi doldu</Pill> : null}
          </div>
          <h1 className="text-title text-fg">{c.title}</h1>
          <p className="text-[14px] text-fg-muted">{brandName} · {couponValueLabel(c.valueType, c.value)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/kupon/${c.id}`} target="_blank" className="inline-flex h-8 items-center rounded-[8px] border border-border px-3 text-[13px] text-fg hover:border-border-strong">Kartı önizle ↗</Link>
          {c.status !== "YAYINDA" ? <CouponStatusButton id={c.id} to="YAYINDA" label="Yayına al" variant="primary" /> : <CouponStatusButton id={c.id} to="PASIF" label="Pasife al" variant="ghost" />}
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
        <div className="flex justify-center rounded-3xl border border-line bg-bg p-5">
          <CouponCard
            kindLabel={kindLabel(c.kind)}
            title={c.title}
            brandName={brandName}
            valueLabel={couponValueLabel(c.valueType, c.value)}
            code={c.sharedCode ?? "KİŞİYE-ÖZEL"}
            codeHint={shared ? "Tüm alıcılara aynı kod" : "Her alıcı kendi kodunu görür"}
            validLabel={c.validUntil ? `Son kullanım: ${dateLong(c.validUntil)}` : "Süresiz"}
            expired={expired}
            logoSrc={mediaSrc(c.logoKey)}
            heroSrc={mediaSrc(c.heroImageKey)}
            accent={c.brandColor ?? "#ff2bd6"}
          />
        </div>
        <dl className="grid grid-cols-1 content-start gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2">
          {[
            ["Tür", kindLabel(c.kind)],
            ["Değer", couponValueLabel(c.valueType, c.value)],
            ["Kod üretimi", shared ? `Herkese aynı kod: ${c.sharedCode}` : "Kişiye özel benzersiz kod"],
            ["Son kullanım", c.validUntil ? `${dateLong(c.validUntil)}${daysLeft != null && !expired ? ` (${daysLeft} gün)` : ""}` : "Süresiz"],
            ["Oluşturma", dateLong(c.createdAt)],
            ["Marka", brandName],
          ].map(([k, v]) => (
            <div key={k} className="flex flex-col gap-0.5 bg-surface px-4 py-3">
              <dt className="text-[12px] text-fg-muted">{k}</dt>
              <dd className="text-[14px] font-medium text-fg">{v}</dd>
            </div>
          ))}
          <div className="flex flex-col gap-0.5 bg-surface px-4 py-3 sm:col-span-2">
            <dt className="text-[12px] text-fg-muted">Kullanım koşulları</dt>
            <dd className="whitespace-pre-line text-[14px] text-fg">{c.terms || "Belirtilmedi"}</dd>
          </div>
          {c.description ? (
            <div className="flex flex-col gap-0.5 bg-surface px-4 py-3 sm:col-span-2">
              <dt className="text-[12px] text-fg-muted">Açıklama</dt>
              <dd className="text-[14px] text-fg">{c.description}</dd>
            </div>
          ) : null}
        </dl>
      </div>

      <StatStrip
        stats={[
          { label: "Gönderim", value: String(c.grants.length) },
          { label: "Kullanıldı", value: String(used) },
          { label: "Kullanım oranı", value: `%${pctOf(used, c.grants.length)}` },
          { label: "Bekleyen", value: String(c.grants.filter((g) => g.status === "GONDERILDI" || g.status === "GORULDU").length) },
          { label: "Kalan gün", value: daysLeft == null ? "∞" : String(daysLeft) },
          { label: "Gönderilebilir", value: String(pickable.length), hint: "henüz almayan üretici" },
        ]}
      />

      <Tabs
        key={tab ?? (c.grants.length ? "alicilar" : "gonder")}
        label="Kupon yönetimi"
        defaultTab={tab ?? (c.grants.length ? "alicilar" : "gonder")}
        tabs={[
          { id: "alicilar", label: `Alıcılar (${c.grants.length})`, content: recipients },
          { id: "gonder", label: "Gönder", content: send },
        ]}
      />
    </div>
  );
}
