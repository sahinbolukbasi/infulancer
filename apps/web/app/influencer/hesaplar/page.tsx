import type { Metadata } from "next";
import { prisma } from "@infulancer/core/db";
import { platformLabels } from "@infulancer/core/domain/labels";
import { PlatformIcon } from "@/components/platform-icon";
import { Card, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/form";
import { PageHeader } from "@/components/ui/layout";
import { requireActor } from "@/lib/auth-guard";
import { compact, pct1 } from "@/lib/format";

export const metadata: Metadata = { title: "Hesaplar" };

export default async function InfluencerAccountsPage() {
  const actor = await requireActor("INFLUENCER");
  const accounts = await prisma.socialAccount.findMany({
    where: { influencerId: actor.influencerId! },
    orderBy: { platform: "asc" },
  });

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Hesaplar"
        description="Sosyal medya hesapların ve ajansın kayıtlı istatistikleri. Otomatik bağlantı (API) yakında."
      />
      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3" aria-label="Sosyal medya hesapları">
        {accounts.map((a) => (
          <Card key={a.id} interactive={false} className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <PlatformIcon platform={a.platform} aria-hidden />
              <CardTitle>{platformLabels[a.platform]}</CardTitle>
            </div>
            <p className="text-sm text-fg-muted">@{a.handle.replace(/^@/, "")}</p>
            <dl className="grid grid-cols-2 gap-2">
              <div>
                <dt className="text-label text-fg-muted">Takipçi</dt>
                <dd className="text-[24px] font-semibold tabular-nums">{compact.format(a.followers)}</dd>
              </div>
              <div>
                <dt className="text-label text-fg-muted">ER</dt>
                <dd className="text-[24px] font-semibold tabular-nums">{pct1.format(Number(a.engagementRate))}</dd>
              </div>
            </dl>
            <Button variant="secondary" size="sm" disabled aria-disabled title="Faz 5: platform API bağlantısı">
              Hesabı bağla (yakında)
            </Button>
          </Card>
        ))}
        {accounts.length === 0 ? <p className="text-sm text-fg-passive">Kayıtlı hesap yok. Ajansınla iletişime geç.</p> : null}
      </section>
    </div>
  );
}
