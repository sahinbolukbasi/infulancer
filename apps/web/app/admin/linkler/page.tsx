import { getTT } from "@/lib/i18n/tt-server";
import type { Metadata } from "next";
import { prisma } from "@infulancer/core/db";
import { envStr } from "@infulancer/core/env";
import { PageHeader } from "@/components/ui/layout";
import { StatStrip } from "@/components/luma/primitives";
import { ShortLinkCreate, ShortLinkList, type ShortLinkRow } from "@/components/notify/shortlink-manager";
import { DocLink } from "@/components/docs/doc-components";
import { requireActor } from "@/lib/auth-guard";

export const metadata: Metadata = { title: "Linkler" };
export const dynamic = "force-dynamic";

/** Link kısaltma ve tıklama takibi: /l/<slug> bağlantıları, tıklama ve son tıklama. */
export default async function AdminLinksPage() {
  const tt = await getTT();
  await requireActor("ADMIN");
  const base = envStr("APP_URL", "http://localhost:3000").replace(/\/$/, "");
  const raw = await prisma.shortLink.findMany({ orderBy: { createdAt: "desc" }, take: 500 });
  const links: ShortLinkRow[] = raw.map((l) => ({ id: l.id, slug: l.slug, shortUrl: `${base}/l/${l.slug}`, targetUrl: l.targetUrl, label: l.label, clicks: l.clicks, lastClickAt: l.lastClickAt, createdAt: l.createdAt }));
  const totalClicks = links.reduce((s, l) => s + l.clicks, 0);
  const active = links.filter((l) => l.clicks > 0).length;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={tt("Linkler")} description={tt("Uzun bağlantıları kısaltın ve her tıklamayı ölçün. Kampanya, duyuru ve sosyal paylaşımlarda kullanın.")} />
      {links.length ? (
        <StatStrip
          stats={[
            { label: "Toplam link", value: String(links.length) },
            { label: "Toplam tıklama", value: String(totalClicks) },
            { label: "Tıklanan link", value: String(active) },
            { label: "Ortalama tıklama", value: links.length ? String(Math.round(totalClicks / links.length)) : "0" },
          ]}
        />
      ) : null}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
        <section className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-5 lg:sticky lg:top-6 lg:self-start" aria-label={tt("Link kısalt")}>
          <h2 className="text-[15px] font-semibold text-fg">{tt("Yeni kısa link")}</h2>
          <ShortLinkCreate />
          <p className="text-[12px] text-fg-passive">{tt("Kısa link biçimi:")}{" "}{base}{tt("/l/xxxxxxx")}</p>
          <DocLink slug="link-kisaltma" />
        </section>
        <section className="flex flex-col gap-3" aria-label={tt("Linkler ve tıklamalar")}>
          <h2 className="text-[15px] font-semibold text-fg">{tt("Linkler ve tıklamalar")}</h2>
          <ShortLinkList links={links} />
        </section>
      </div>
    </div>
  );
}
