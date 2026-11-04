import type { Metadata } from "next";
import Link from "next/link";
import { audit } from "@infulancer/core/audit";
import { prisma } from "@infulancer/core/db";
import { campaignStatusLabels, formatKurus, roleLabels, taxStatusLabels } from "@infulancer/core/domain/labels";
import { computeBalances, minPayoutKurus } from "@infulancer/core/domain/ledger";
import { PayoutRequestButton } from "@/components/finance/payout-forms";
import { WorkHistory } from "@/components/history/work-history";
import { PasswordForm, ProfileForm } from "@/components/profile/profile-forms";
import { Avatar, pickAvatar } from "@/components/ui/avatar";
import { Card, CardTitle } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/form";
import { PageHeader } from "@/components/ui/layout";
import { StatusDot } from "@/components/ui/status";
import { Tabs } from "@/components/ui/tabs";
import { requireActor } from "@/lib/auth-guard";
import { maskIban } from "@/lib/format";
import { itemsSummary, statusLabel, statusTone } from "@/lib/offers-view";
import { campaignTone } from "@/lib/status-tone";
import { fmtDate, fmtDateTime } from "@/lib/time";
export const metadata: Metadata = { title: "Profilim" };
export const dynamic = "force-dynamic";

const ACTION_TR: Record<string, string> = {
  PROFILE_UPDATED: "Profil güncellendi",
  PASSWORD_CHANGED: "Şifre değiştirildi",
  OFFER_SENT: "Teklif gönderildi",
  OFFER_ACCEPTED: "Teklif kabul edildi",
  OFFER_DECLINED: "Teklif reddedildi",
  OFFER_WITHDRAWN: "Teklif geri çekildi",
  RATE_CARD_UPDATED: "Fiyat listesi güncellendi",
  PAYOUT_REQUESTED: "Çekim talebi oluşturuldu",
  CONTRACT_DECISION: "Sözleşme kararı",
  DELIVERABLE_STATUS: "İş durumu değişti",
  POST_URL_UPDATED: "Paylaşım bağlantısı güncellendi",
  ASSET_UPLOADED: "Dosya yüklendi",
  METRIC_SUBMITTED: "Metrik girildi",
  SOCIAL_ACCOUNT_ADDED: "Sosyal hesap eklendi",
  SOCIAL_ACCOUNT_UPDATED: "Sosyal hesap güncellendi",
  CAMPAIGN_REQUESTED: "Kampanya talebi gönderildi",
  CAMPAIGN_CREATED: "Kampanya oluşturuldu",
  CAMPAIGN_UPDATED: "Kampanya güncellendi",
  ASSIGNMENT_CREATED: "Influencer atandı",
  INVITE_CREATED: "Davet oluşturuldu",
  REVIEW_SUBMITTED: "İçerik incelendi",
};
const humanize = (a: string) => ACTION_TR[a] ?? a.toLocaleLowerCase("tr").replace(/_/g, " ").replace(/^./, (c) => c.toLocaleUpperCase("tr"));

/** Tüm roller için profil: bilgiler, güvenlik, yaptığım işlemler; role göre ödeme / iş birliği / teklif sekmeleri. */
export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ sekme?: string }> }) {
  const actor = await requireActor();
  const { sekme } = await searchParams;
  const user = await prisma.user.findUniqueOrThrow({ where: { id: actor.userId }, select: { name: true, email: true, phone: true, role: true, createdAt: true, brand: { select: { name: true } } } });
  const activity = await audit.listByActor(actor.userId, 60).catch(() => []);
  const tabs: { id: string; label: string; content: React.ReactNode }[] = [];

  let avatar: string | null = null;
  let headline = roleLabels[user.role];
  if (actor.role === "INFLUENCER" && actor.influencerId) {
    const id = actor.influencerId;
    const now = new Date();
    const [inf, balances, offers] = await Promise.all([
      prisma.influencer.findUniqueOrThrow({ where: { id }, select: { iban: true, ibanHolder: true, taxStatus: true, city: true, socialAccounts: { select: { platform: true, avatarUrl: true } } } }),
      computeBalances(id, now),
      prisma.offer.findMany({ where: { influencerId: id }, orderBy: { createdAt: "desc" }, take: 30 }),
    ]);
    avatar = pickAvatar(inf.socialAccounts);
    headline = `İçerik üreticisi${inf.city ? ` · ${inf.city}` : ""}`;
    tabs.push({
      id: "odeme",
      label: "Para çekme",
      content: (
        <div className="flex flex-col gap-4">
          <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              ["Çekilebilir", formatKurus(balances.cekilebilir)],
              ["Hakedilen (beklemede)", formatKurus(balances.hakedilen)],
              ["Ödeme sürecinde", formatKurus(balances.islemde)],
              ["Vergi profili", taxStatusLabels[inf.taxStatus]],
            ].map(([k, v]) => (
              <div key={k} className="rounded-2xl border border-line bg-glass p-4">
                <dt className="text-[12px] text-fg-muted">{k}</dt>
                <dd className="text-xl font-semibold tabular-nums">{v}</dd>
              </div>
            ))}
          </dl>
          <Card interactive={false} className="flex flex-col gap-3">
            <CardTitle>Yeni çekim talebi</CardTitle>
            <p className="text-[13px] text-fg-muted">
              IBAN: {maskIban(inf.iban) || "tanımlı değil"} · {inf.ibanHolder || "—"}. IBAN değişikliği için ajansınıza yazın.
            </p>
            <PayoutRequestButton cekilebilirKurus={balances.cekilebilir} minKurus={minPayoutKurus()} maskedIban={maskIban(inf.iban)} holder={inf.ibanHolder} />
          </Card>
        </div>
      ),
    });
    tabs.push({ id: "isbirlikleri", label: "İş birlikleri ve çekimler", content: <WorkHistory influencerId={id} mode="influencer" /> });
    tabs.push({
      id: "teklifler",
      label: `Teklifler (${offers.length})`,
      content: (
        <div className="flex flex-col gap-3">
          <ButtonLink href="/influencer/teklifler" variant="secondary" size="sm" className="w-fit">
            Teklifleri yanıtla / fiyat listem →
          </ButtonLink>
          <OfferRows offers={offers} />
        </div>
      ),
    });
  } else if (actor.role === "BRAND" && actor.brandId) {
    const brandId = actor.brandId;
    const [campaigns, offers] = await Promise.all([
      prisma.campaign.findMany({ where: { brandId }, orderBy: { startsAt: "desc" }, select: { id: true, name: true, status: true, startsAt: true, endsAt: true, brandTotalFeeKurus: true, _count: { select: { assignments: { where: { contractStatus: { not: "RED" } } } } } } }),
      prisma.offer.findMany({ where: { brandId }, orderBy: { createdAt: "desc" }, take: 30 }),
    ]);
    headline = `${user.brand?.name ?? "Marka"} · marka yetkilisi`;
    tabs.push({
      id: "isbirlikleri",
      label: `İş birlikleri (${campaigns.length})`,
      content: campaigns.length ? (
        <ul className="flex flex-col divide-y divide-line rounded-2xl border border-line">
          {campaigns.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
              <Link href={`/marka/kampanyalar/${c.id}`} className="text-sm hover:underline">
                {c.name}
              </Link>
              <span className="flex items-center gap-4 text-[13px] text-fg-muted tabular-nums">
                {fmtDate(c.startsAt)} – {fmtDate(c.endsAt)} · {c._count.assignments} influencer · {formatKurus(c.brandTotalFeeKurus)}
                <StatusDot tone={campaignTone(c.status)}>{campaignStatusLabels[c.status]}</StatusDot>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-fg-passive">Henüz kampanya yok.</p>
      ),
    });
    tabs.push({ id: "teklifler", label: `Teklifler (${offers.length})`, content: <OfferRows offers={offers} /> });
  }
  tabs.push({
    id: "islemler",
    label: "Yaptığım işlemler",
    content: activity.length ? (
      <ol className="flex flex-col rounded-2xl border border-line">
        {activity.map((a) => (
          <li key={a.id} className="grid grid-cols-[150px_1fr] gap-4 border-b border-line px-4 py-2.5 text-[13px] last:border-b-0">
            <time dateTime={a.at.toISOString()} className="tabular-nums text-fg-passive">
              {fmtDateTime(a.at)}
            </time>
            <span>{humanize(a.action)}</span>
          </li>
        ))}
      </ol>
    ) : (
      <p className="text-sm text-fg-passive">Henüz kayıtlı işlem yok.</p>
    ),
  });
  tabs.unshift({
    id: "bilgiler",
    label: "Bilgilerim",
    content: (
      <div className="flex flex-col gap-4">
        <Card interactive={false} className="flex flex-col gap-3">
          <CardTitle>Kişisel bilgiler</CardTitle>
          <ProfileForm name={user.name} phone={user.phone} />
          <p className="text-[12px] text-fg-passive">E-posta ({user.email}) giriş adresinizdir; değiştirmek için ajansınıza yazın.</p>
        </Card>
        <Card interactive={false} className="flex flex-col gap-3">
          <CardTitle>Güvenlik</CardTitle>
          <PasswordForm />
        </Card>
      </div>
    ),
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-4 rounded-3xl border border-line bg-glass p-5">
        <Avatar name={user.name} src={avatar} size={72} className="ring-2 ring-neon-pink/50" />
        <div className="flex min-w-0 flex-col">
          <PageHeader title={user.name} description={`${headline} · ${user.email} · üye ${fmtDate(user.createdAt)}`} />
        </div>
      </div>
      <Tabs key={sekme ?? "bilgiler"} label="Profil bölümleri" defaultTab={sekme} tabs={tabs} />
    </div>
  );
}

function OfferRows({ offers }: { offers: { id: string; title: string; totalKurus: number; status: string; createdAt: Date; items: unknown }[] }) {
  if (!offers.length) return <p className="text-sm text-fg-passive">Henüz teklif yok.</p>;
  return (
    <ul className="flex flex-col divide-y divide-line rounded-2xl border border-line">
      {offers.map((o) => (
        <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
          <span className="flex min-w-0 flex-col">
            <span className="text-sm">{o.title}</span>
            <span className="truncate text-[12px] text-fg-muted">{itemsSummary(o.items).join(" · ")}</span>
          </span>
          <span className="flex items-center gap-4 text-[13px] tabular-nums">
            {formatKurus(o.totalKurus)}
            <StatusDot tone={statusTone(o.status)}>{statusLabel(o.status)}</StatusDot>
            <span className="text-fg-passive">{fmtDate(o.createdAt)}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
