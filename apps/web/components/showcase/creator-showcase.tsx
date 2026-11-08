import { getTT } from "@/lib/i18n/tt-server";
import type { ReactNode } from "react";
import Link from "next/link";
import { prisma, type Platform } from "@infulancer/core/db";
import { categoryLabel } from "@infulancer/core/domain/categories";
import { contentTypeLabels, formatKurus, platformLabels } from "@infulancer/core/domain/labels";
import { BrandBadge, type BrandLogoName } from "@/components/icons/brand-logos";
import { ExternalIcon } from "@/components/icons";
import { PlatformIcon } from "@/components/platform-icon";
import { Avatar, pickAvatar } from "@/components/ui/avatar";
import { fmtDate } from "@/lib/time";

const PUBLISHED = ["YAYINLANDI", "METRIK_BEKLIYOR", "TAMAMLANDI"] as const;
const LOGO: Record<Platform, BrandLogoName> = { INSTAGRAM: "instagram", TIKTOK: "tiktok", YOUTUBE: "youtube" };
const compact = new Intl.NumberFormat("tr-TR", { notation: "compact", maximumFractionDigits: 1 });
const pct = new Intl.NumberFormat("tr-TR", { style: "percent", maximumFractionDigits: 1 });

export function profileLink(platform: Platform, handle: string, profileUrl?: string | null): string {
  if (profileUrl && /^https:\/\//.test(profileUrl)) return profileUrl;
  const h = handle.replace(/^@/, "");
  return platform === "INSTAGRAM" ? `https://www.instagram.com/${h}` : platform === "TIKTOK" ? `https://www.tiktok.com/@${h}` : `https://www.youtube.com/@${h}`;
}

/**
 * İçerik üreticisinin vitrini: markalar (Influencer bul → profil) ve üreticinin kendi önizlemesi aynı görünümü kullanır.
 * Görünürlük tercihleri (fiyatlar, iş birlikleri) üreticinin "Vitrinim" ayarlarından gelir.
 */
export async function CreatorShowcase({ influencerId, actions }: { influencerId: string; actions?: ReactNode }) {
  const tt = await getTT();
  const inf = await prisma.influencer.findUnique({
    where: { id: influencerId },
    select: {
      id: true,
      name: true,
      city: true,
      bio: true,
      headline: true,
      category: true,
      showPrices: true,
      showCollaborations: true,
      avatarKey: true,
      categories: { include: { category: { include: { parent: { select: { name: true } } } } }, orderBy: { primary: "desc" } },
      socialAccounts: { orderBy: { followers: "desc" }, select: { platform: true, handle: true, followers: true, engagementRate: true, avatarUrl: true, profileUrl: true, postsCount: true, avgViews: true, verified: true, lastSyncedAt: true } },
    },
  });
  if (!inf) return null;
  const [rates, portfolio, collabs] = await Promise.all([
    inf.showPrices ? prisma.rateCard.findMany({ where: { influencerId, active: true }, orderBy: [{ platform: "asc" }, { priceKurus: "asc" }] }) : Promise.resolve([]),
    prisma.portfolioItem.findMany({ where: { influencerId }, orderBy: [{ sort: "asc" }, { createdAt: "desc" }], take: 24 }),
    inf.showCollaborations
      ? prisma.assignment.findMany({
          where: { influencerId, contractStatus: "KABUL" },
          orderBy: { createdAt: "desc" },
          take: 30,
          select: {
            id: true,
            feeKurus: true,
            campaign: { select: { name: true, startsAt: true, endsAt: true, brand: { select: { name: true } } } },
            deliverables: { where: { status: { in: [...PUBLISHED] } }, select: { platform: true, contentType: true, postUrl: true } },
          },
        })
      : Promise.resolve([]),
  ]);
  const total = inf.socialAccounts.reduce((s, a) => s + a.followers, 0);
  const bestEr = inf.socialAccounts.reduce((m, a) => Math.max(m, Number(a.engagementRate)), 0);
  const publishedCount = collabs.reduce((s, c) => s + c.deliverables.length, 0);

  return (
    <div className="flex flex-col gap-6">
      {/* Üst bilgi */}
      <section className="relative overflow-hidden rounded-3xl border border-line bg-glass p-6">
        <div aria-hidden className="pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full bg-neon-pink/20 blur-3xl" />
        <div className="relative flex flex-wrap items-start gap-5">
          <Avatar name={inf.name} src={pickAvatar(inf.socialAccounts, inf.avatarKey)} size={96} className="ring-2 ring-neon-pink/60" />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <h1 className="text-[30px] leading-tight font-semibold tracking-tight">{inf.name}</h1>
            {inf.headline ? <p className="text-[15px] text-fg">{inf.headline}</p> : null}
            <p className="text-[13px] text-fg-muted">
              {inf.categories[0] ? categoryLabel(inf.categories[0].category) : inf.category}
              {inf.city ? ` · ${inf.city}` : ""}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {inf.categories.slice(0, 6).map((c) => (
                <span key={c.categoryId} className="rounded-full border border-line px-2.5 py-0.5 text-[12px] text-fg-muted">
                  {c.category.name}
                </span>
              ))}
            </div>
          </div>
          {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
        {inf.bio ? <p className="relative mt-4 max-w-3xl text-sm leading-relaxed whitespace-pre-line text-fg-muted">{inf.bio}</p> : null}
        <dl className="relative mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ["Toplam takipçi", compact.format(total)],
            ["En iyi etkileşim", bestEr ? pct.format(bestEr) : "—"],
            ["İş birliği", inf.showCollaborations ? String(collabs.length) : "Gizli"],
            ["Yayınlanan içerik", inf.showCollaborations ? String(publishedCount) : "Gizli"],
          ].map(([k, v]) => (
            <div key={k} className="rounded-2xl border border-line bg-bg/40 p-3">
              <dt className="text-[12px] text-fg-muted">{k}</dt>
              <dd className="text-xl font-semibold tabular-nums">{v}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* Sosyal hesaplar */}
      <section aria-labelledby="sc-social" className="flex flex-col gap-3">
        <h2 id="sc-social" className="text-section">{" "}{tt("Sosyal medya")}</h2>
        {inf.socialAccounts.length === 0 ? (
          <p className="text-sm text-fg-passive">{tt("Bağlı hesap yok.")}</p>
        ) : (
          <ul className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {inf.socialAccounts.map((a) => (
              <li key={a.platform} className="flex flex-col gap-3 rounded-3xl border border-line bg-glass p-4">
                <div className="flex items-center gap-3">
                  <BrandBadge name={LOGO[a.platform]} size={40} />
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate font-medium">@{a.handle.replace(/^@/, "")}</span>
                    <span className="text-[12px] text-fg-muted">{platformLabels[a.platform]}{a.verified ? tt(" · doğrulanmış") : ""}</span>
                  </div>
                </div>
                <dl className="grid grid-cols-3 gap-2 text-[12px]">
                  <div>
                    <dt className="text-fg-passive">{tt("Takipçi")}</dt>
                    <dd className="text-base font-semibold tabular-nums">{compact.format(a.followers)}</dd>
                  </div>
                  <div>
                    <dt className="text-fg-passive">{tt("Etkileşim")}</dt>
                    <dd className="text-base font-semibold tabular-nums">{pct.format(Number(a.engagementRate))}</dd>
                  </div>
                  <div>
                    <dt className="text-fg-passive">{a.avgViews ? tt("Ort. izlenme") : tt("Gönderi")}</dt>
                    <dd className="text-base font-semibold tabular-nums">{a.avgViews ? compact.format(a.avgViews) : a.postsCount ? compact.format(a.postsCount) : "—"}</dd>
                  </div>
                </dl>
                <a
                  href={profileLink(a.platform, a.handle, a.profileUrl)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-auto inline-flex items-center justify-center gap-1.5 rounded-full border border-line-strong px-4 py-2 text-[13px] font-medium transition-standard hover:border-neon-pink hover:text-neon-pink"
                >
                  {platformLabels[a.platform]}{tt("'da aç")}{" "}<ExternalIcon size={13} />
                  <span className="sr-only">{tt("(yeni sekmede açılır)")}</span>
                </a>
                {a.lastSyncedAt ? <span className="text-[11px] text-fg-passive">{tt("Veriler")}{" "}{fmtDate(a.lastSyncedAt)}{" "}{tt("tarihinde resmî API'den güncellendi")}</span> : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Fiyat listesi */}
      {inf.showPrices ? (
        <section aria-labelledby="sc-rates" className="flex flex-col gap-3">
          <h2 id="sc-rates" className="text-section">{" "}{tt("İçerik ücretleri")}</h2>
          {rates.length === 0 ? (
            <p className="text-sm text-fg-passive">{tt("Fiyat listesi henüz girilmedi; teklif gönderebilirsiniz.")}</p>
          ) : (
            <ul className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {rates.map((r) => (
                <li key={r.id} className="flex flex-col gap-1 rounded-2xl border border-line bg-glass p-4">
                  <span className="flex items-center gap-1.5 text-[12px] text-fg-muted">
                    <PlatformIcon platform={r.platform} size={12} /> {platformLabels[r.platform]} {contentTypeLabels[r.contentType]}
                  </span>
                  <span className="text-xl font-semibold tabular-nums">{formatKurus(r.priceKurus)}</span>
                  {r.note ? <span className="text-[11px] text-fg-passive">{r.note}</span> : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {/* Öne çıkan işler */}
      <section aria-labelledby="sc-portfolio" className="flex flex-col gap-3">
        <h2 id="sc-portfolio" className="text-section">{" "}{tt("Öne çıkan işler")}</h2>
        {portfolio.length === 0 ? (
          <p className="text-sm text-fg-passive">{tt("Henüz öne çıkarılan iş yok.")}</p>
        ) : (
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {portfolio.map((p) => (
              <li key={p.id}>
                <a href={p.url} target="_blank" rel="noopener noreferrer" className="group flex h-full flex-col gap-2 rounded-3xl border border-line bg-glass p-4 transition-standard hover:-translate-y-0.5 hover:border-neon-pink/60">
                  <span className="flex items-center gap-2 text-[12px] text-fg-muted">
                    <BrandBadge name={LOGO[p.platform]} size={24} />
                    {platformLabels[p.platform]}
                    {p.brandName ? ` · ${p.brandName}` : ""}
                  </span>
                  <span className="font-medium group-hover:text-neon-pink">{p.title}</span>
                  {p.note ? <span className="text-[13px] text-fg-muted">{p.note}</span> : null}
                  <span className="mt-auto inline-flex items-center gap-1 text-[12px] text-fg-muted">{" "}{tt("İçeriği aç")}{" "}<ExternalIcon size={12} />
                    <span className="sr-only">{tt("(yeni sekmede açılır)")}</span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* İş birlikleri */}
      {inf.showCollaborations ? (
        <section aria-labelledby="sc-collabs" className="flex flex-col gap-3">
          <h2 id="sc-collabs" className="text-section">{" "}{tt("Yer aldığı iş birlikleri")}</h2>
          {collabs.length === 0 ? (
            <p className="text-sm text-fg-passive">{tt("Platformda tamamlanmış iş birliği yok.")}</p>
          ) : (
            <ul className="flex flex-col divide-y divide-line rounded-3xl border border-line">
              {collabs.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                  <span className="flex min-w-0 flex-col">
                    <span className="font-medium">{c.campaign.brand.name}</span>
                    <span className="text-[12px] text-fg-muted">
                      {c.campaign.name} · {fmtDate(c.campaign.startsAt)} – {fmtDate(c.campaign.endsAt)}
                    </span>
                    {c.deliverables.length ? (
                      <span className="mt-1 flex flex-wrap gap-2 text-[12px]">
                        {c.deliverables.map((d, i) =>
                          d.postUrl ? (
                            <a key={i} href={d.postUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-full border border-line px-2 py-0.5 hover:border-neon-pink">
                              <PlatformIcon platform={d.platform} size={11} /> {contentTypeLabels[d.contentType]} <ExternalIcon size={10} />
                            </a>
                          ) : (
                            <span key={i} className="inline-flex items-center gap-1 rounded-full border border-line px-2 py-0.5 text-fg-muted">
                              <PlatformIcon platform={d.platform} size={11} /> {contentTypeLabels[d.contentType]}
                            </span>
                          ),
                        )}
                      </span>
                    ) : null}
                  </span>
                  <span className="text-lg font-semibold tabular-nums">{formatKurus(c.feeKurus)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
      {!inf.showPrices || !inf.showCollaborations ? (
        <p className="text-[12px] text-fg-passive">{tt("Bazı bölümler içerik üreticisinin tercihiyle gizli.")}</p>
      ) : null}
      {/* Gezinme yardımı */}
      <Link href="#sc-social" className="sr-only focus:not-sr-only">{" "}{tt("Sosyal medya bölümüne git")}</Link>
    </div>
  );
}
