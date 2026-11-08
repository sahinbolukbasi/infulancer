import { getTT } from "@/lib/i18n/tt-server";
import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@infulancer/core/db";
import { campaignStatusLabels } from "@infulancer/core/domain/labels";
import { BuildingIcon, MegaphoneIcon, UsersIcon } from "@/components/icons";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader, Stagger } from "@/components/ui/layout";
import { requireActor } from "@/lib/auth-guard";

export const metadata: Metadata = { title: "Arama" };

const LIMIT = 10;

export default async function AdminSearchPage({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> }) {
  const tt = await getTT();
  await requireActor("ADMIN");
  const raw = (await searchParams).q;
  const q = (Array.isArray(raw) ? raw[0] : raw)?.trim().slice(0, 100) ?? "";

  if (q.length < 2) {
    return (
      <div className="flex flex-col gap-8">
        <PageHeader title={tt("Arama")} />
        <EmptyState message={tt("Aramak için en az 2 karakter yazın.")} action={{ label: "Genel bakışa dön", href: "/admin" }} />
      </div>
    );
  }

  const contains = { contains: q, mode: "insensitive" as const };
  const [campaigns, influencers, brands] = await Promise.all([
    prisma.campaign.findMany({
      where: { OR: [{ name: contains }, { slug: contains }] },
      select: { id: true, name: true, status: true, brand: { select: { name: true } } },
      orderBy: { startsAt: "desc" },
      take: LIMIT,
    }),
    prisma.influencer.findMany({
      where: { OR: [{ name: contains }, { category: contains }, { socialAccounts: { some: { handle: contains } } }] },
      select: { id: true, name: true, category: true },
      orderBy: { name: "asc" },
      take: LIMIT,
    }),
    prisma.brand.findMany({
      where: { OR: [{ name: contains }, { category: contains }] },
      select: { id: true, name: true, category: true },
      orderBy: { name: "asc" },
      take: LIMIT,
    }),
  ]);

  const total = campaigns.length + influencers.length + brands.length;

  return (
    <Stagger className="flex flex-col gap-8">
      <PageHeader title={tt("Arama")} description={`“${q}” için ${total} sonuç`} />
      {total === 0 ? (
        <EmptyState message={tt("Eşleşen kampanya, influencer veya marka bulunamadı.")} action={{ label: "Kampanyalara git", href: "/admin/kampanyalar" }} />
      ) : (
        <div className="grid-12">
          <ResultGroup title={tt("Kampanyalar")} icon={<MegaphoneIcon size={16} />}>
            {campaigns.map((c) => (
              <ResultLink key={c.id} href={`/admin/kampanyalar/${c.id}`} title={c.name} meta={`${c.brand.name} · ${campaignStatusLabels[c.status]}`} />
            ))}
          </ResultGroup>
          <ResultGroup title={tt("Influencerlar")} icon={<UsersIcon size={16} />}>
            {influencers.map((i) => (
              <ResultLink key={i.id} href={`/admin/influencerlar/${i.id}`} title={i.name} meta={i.category} />
            ))}
          </ResultGroup>
          <ResultGroup title={tt("Markalar")} icon={<BuildingIcon size={16} />}>
            {brands.map((b) => (
              <ResultLink key={b.id} href={`/admin/markalar/${b.id}`} title={b.name} meta={b.category} />
            ))}
          </ResultGroup>
        </div>
      )}
    </Stagger>
  );
}

async function ResultGroup({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode[] }) {
  const tt = await getTT();
  return (
    <Card interactive={false} className="flex flex-col gap-4 md:col-span-4">
      <h2 className="flex items-center gap-2 text-label text-fg-muted">
        {icon}
        {title}
        <span className="text-fg-passive tabular-nums">{children.length}</span>
      </h2>
      {children.length === 0 ? <p className="text-sm text-fg-passive">{tt("Sonuç yok.")}</p> : <ul className="flex flex-col">{children}</ul>}
    </Card>
  );
}

function ResultLink({ href, title, meta }: { href: string; title: string; meta: string }) {
  return (
    <li className="border-b border-border last:border-b-0">
      <Link href={href} className="-mx-2 flex flex-col gap-0.5 rounded-[8px] px-2 py-2 transition-standard hover:bg-surface-hover">
        <span className="text-sm text-fg">{title}</span>
        <span className="text-[13px] text-fg-passive">{meta}</span>
      </Link>
    </li>
  );
}
