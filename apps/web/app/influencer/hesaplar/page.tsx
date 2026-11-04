import type { Metadata } from "next";
import { prisma } from "@infulancer/core/db";
import { platformLabels } from "@infulancer/core/domain/labels";
import { syncSourceLabels } from "@infulancer/core/social/sync";
import { PlatformIcon } from "@/components/platform-icon";
import { Card, CardTitle } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/form";
import { PageHeader } from "@/components/ui/layout";
import { InfoNote } from "@/components/ui/unverified";
import { requireActor } from "@/lib/auth-guard";
import { Avatar } from "@/components/ui/avatar";
import { OwnAccountForm, SyncOwnButton } from "@/components/forms/own-account-forms";
import { compact, pct1 } from "@/lib/format";
import { fmtDate } from "@/lib/time";

export const metadata: Metadata = { title: "Hesaplar" };
export const dynamic = "force-dynamic";

const notices: Record<string, string> = {
  baglandi: "TikTok hesabın bağlandı; istatistiklerin güncellendi.",
  hata: "TikTok bağlantısı tamamlanamadı. Lütfen tekrar dene.",
  yapilandirilmadi: "TikTok bağlantısı henüz ajans tarafından etkinleştirilmedi.",
};

export default async function InfluencerAccountsPage({ searchParams }: { searchParams: Promise<{ tiktok?: string }> }) {
  const actor = await requireActor("INFLUENCER");
  const { tiktok } = await searchParams;
  const accounts = await prisma.socialAccount.findMany({ where: { influencerId: actor.influencerId! }, orderBy: { platform: "asc" } });
  const tt = accounts.find((a) => a.platform === "TIKTOK");

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Hesaplar" description="Kullanıcı adını ekle; takipçi ve profil fotoğrafın otomatik gelsin." actions={accounts.length ? <SyncOwnButton /> : undefined} />
      <Card interactive={false} className="flex flex-col gap-3">
        <CardTitle>Hesap bağla</CardTitle>
        <OwnAccountForm />
      </Card>
      {tiktok && notices[tiktok] ? <InfoNote>{notices[tiktok]}</InfoNote> : null}
      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3" aria-label="Sosyal medya hesapları">
        {accounts.map((a) => (
          <Card key={a.id} interactive={false} className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <Avatar name={a.handle} src={a.avatarUrl} size={44} />
              <div className="flex flex-col">
                <span className="flex items-center gap-2">
                  <PlatformIcon platform={a.platform} size={14} aria-hidden />
                  <CardTitle>{platformLabels[a.platform]}</CardTitle>
                </span>
                {a.syncError ? <span className="text-[12px] text-critical">{a.syncError}</span> : null}
              </div>
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
            <p className="text-[12px] text-fg-passive">
              {syncSourceLabels[a.syncSource] ?? a.syncSource}
              {a.lastSyncedAt ? ` · son güncelleme ${fmtDate(a.lastSyncedAt)}` : ""}
            </p>
          </Card>
        ))}
        {accounts.length === 0 ? <p className="text-sm text-fg-passive">Henüz hesap yok. Yukarıdan kullanıcı adını ekle.</p> : null}
      </section>
      <Card interactive={false} className="flex flex-col gap-3">
        <CardTitle>TikTok hesabını bağla</CardTitle>
        <p className="text-sm text-fg-muted">
          TikTok istatistikleri yalnız senin onayınla, TikTok’un resmî giriş ekranı üzerinden alınabilir. Şifren bizimle paylaşılmaz; bağlantıyı istediğin zaman TikTok ayarlarından
          kaldırabilirsin.
        </p>
        <ButtonLink href="/api/tiktok/oauth/start" variant={tt?.tokenRef ? "secondary" : "primary"}>
          {tt?.tokenRef ? "Bağlantıyı yenile" : "TikTok ile bağlan"}
        </ButtonLink>
        <p className="text-[12px] text-fg-passive">Kitle demografisi (yaş, cinsiyet, şehir) hiçbir platformun herkese açık API’sinde yok; istatistik ekran görüntüsünü iş sayfasından yükleyebilirsin.</p>
      </Card>
    </div>
  );
}
