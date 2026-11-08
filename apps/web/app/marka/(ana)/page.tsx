import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@infulancer/core/db";
import { contentTypeLabels, platformLabels } from "@infulancer/core/domain/labels";
import { CopilotHome } from "@/components/copilot/copilot-home";
import { PlatformIcon } from "@/components/platform-icon";
import { Card, CardTitle } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/form";
import { PageHeader, Stagger } from "@/components/ui/layout";
import { requireActor } from "@/lib/auth-guard";
import { fmtDateTime } from "@/lib/time";

export const metadata: Metadata = { title: "Genel bakış" };
export const dynamic = "force-dynamic";

function Stat({ label, value, href, hint }: { label: string; value: number | string; href: string; hint?: string }) {
  return (
    <Link href={href} className="block rounded-[8px] focus-visible:outline-offset-4">
      <Card className="flex h-full flex-col gap-2">
        <span className="text-label text-fg-muted">{label}</span>
        <span className="text-[30px] leading-none font-semibold tabular-nums">{value}</span>
        {hint ? <span className="text-[12px] text-fg-passive">{hint}</span> : null}
      </Card>
    </Link>
  );
}

/**
 * Marka genel bakışı: sayılar, yapılacaklar ve yaklaşan paylaşımlar. Kampanya listesi ayrı sayfada
 * (/marka/kampanyalar); burada yalnız özet ve kısayollar durur.
 */
export default async function BrandHomePage() {
  const actor = await requireActor("BRAND");
  const brandId = actor.brandId!;
  const now = new Date();
  const week = new Date(now.getTime() + 7 * 86_400_000);
  const [byStatus, drafts, pending, upcoming] = await Promise.all([
    prisma.campaign.groupBy({ by: ["status"], where: { brandId }, _count: true }),
    prisma.campaign.findMany({ where: { brandId, status: "TASLAK" }, orderBy: { updatedAt: "desc" }, take: 5, select: { id: true, name: true, submittedAt: true, updatedAt: true } }),
    prisma.deliverable.count({ where: { status: "ICERIK_YUKLENDI", assignment: { contractStatus: { not: "RED" }, campaign: { brandId } } } }),
    prisma.deliverable.findMany({
      where: { plannedAt: { gte: now, lt: week }, status: { not: "IPTAL" }, assignment: { contractStatus: { not: "RED" }, campaign: { brandId } } },
      orderBy: { plannedAt: "asc" },
      take: 8,
      select: { id: true, platform: true, contentType: true, plannedAt: true, assignment: { select: { campaignId: true, campaign: { select: { name: true } }, influencer: { select: { name: true } } } } },
    }),
  ]);
  const count = (s: string) => byStatus.find((b) => b.status === s)?._count ?? 0;
  return (
    <Stagger className="flex flex-col gap-8">
      <PageHeader
        title="Genel bakış"
        description="Kampanyalarınızın durumu, onayınızı bekleyenler ve bu haftanın paylaşımları."
        actions={
          <ButtonLink href="/marka/kampanyalar/yeni">Yeni kampanya</ButtonLink>
        }
      />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Aktif kampanya" value={count("AKTIF")} href="/marka/kampanyalar?durum=AKTIF" />
        <Stat label="Taslak" value={count("TASLAK")} href="/marka/kampanyalar?durum=TASLAK" hint="Tamamlayıp ajansa gönderin" />
        <Stat label="Onay bekleyen içerik" value={pending} href="/marka/kampanyalar?durum=AKTIF" hint="Taslağı açıp onaylayın" />
        <Stat label="7 gün içinde paylaşım" value={upcoming.length} href="/marka/takvim?gorunum=hafta" />
      </div>
      <div className="grid-12">
        <Card interactive={false} className="flex flex-col gap-4 md:col-span-6">
          <div className="flex items-center justify-between gap-3">
            <CardTitle>Taslak kampanyalar</CardTitle>
            <Link href="/marka/kampanyalar?durum=TASLAK" className="text-[12px] text-fg-muted hover:text-fg">
              Tümü →
            </Link>
          </div>
          {drafts.length === 0 ? (
            <p className="text-sm text-fg-passive">Taslak yok. Yeni kampanyayı adım adım oluşturabilirsiniz.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-line">
              {drafts.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-3 py-2.5">
                  <span className="flex flex-col">
                    <span className="text-sm text-fg">{d.name}</span>
                    <span className="text-[12px] text-fg-passive">{d.submittedAt ? "Ajansa gönderildi · kurulum bekliyor" : "Gönderilmedi"}</span>
                  </span>
                  <Link href={`/marka/kampanyalar/${d.id}/olustur?adim=ozet`} className="text-[13px] font-medium underline-offset-4 hover:underline">
                    {d.submittedAt ? "Düzenle" : "Devam et"}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card interactive={false} className="flex flex-col gap-4 md:col-span-6">
          <div className="flex items-center justify-between gap-3">
            <CardTitle>Bu haftanın paylaşımları</CardTitle>
            <Link href="/marka/takvim" className="text-[12px] text-fg-muted hover:text-fg">
              Takvim →
            </Link>
          </div>
          {upcoming.length === 0 ? (
            <p className="text-sm text-fg-passive">Önümüzdeki 7 günde planlı paylaşım yok.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-line">
              {upcoming.map((d) => (
                <li key={d.id}>
                  <Link href={`/marka/kampanyalar/${d.assignment.campaignId}#is-${d.id}`} className="flex items-center gap-3 py-2.5 text-sm hover:text-fg">
                    <PlatformIcon platform={d.platform} size={15} title={platformLabels[d.platform]} />
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate text-fg">
                        {d.assignment.influencer.name} · {contentTypeLabels[d.contentType]}
                      </span>
                      <span className="truncate text-[12px] text-fg-passive">{d.assignment.campaign.name}</span>
                    </span>
                    <span className="ml-auto text-[12px] whitespace-nowrap text-fg-muted tabular-nums">{fmtDateTime(d.plannedAt)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
      <CopilotHome actor={actor} />
    </Stagger>
  );
}
