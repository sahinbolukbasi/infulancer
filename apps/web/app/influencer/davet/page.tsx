import type { Metadata } from "next";
import { prisma } from "@infulancer/core/db";
import { INFLUENCER_INVITE_LIMITS } from "@infulancer/core/access/invites";
import { CopyLinkButton, CreateInviteForm, RevokeInviteButton } from "@/components/signup/invite-forms";
import { Card, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/layout";
import { StatusDot } from "@/components/ui/status";
import { requireActor } from "@/lib/auth-guard";
import { fmtDate } from "@/lib/time";

export const metadata: Metadata = { title: "Davet et" };
export const dynamic = "force-dynamic";

/** Influencer, başka influencer'ları davet eder; başvurular ajans onayına düşer. */
export default async function InfluencerInvitePage() {
  const actor = await requireActor("INFLUENCER");
  const now = new Date();
  const invites = await prisma.invite.findMany({
    where: { createdById: actor.userId },
    orderBy: { createdAt: "desc" },
    include: { applications: { include: { user: { select: { name: true } } } } },
  });
  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Davet et" description="Tanıdığın influencer’ları davet et. Davet linkiyle kayıt olanlar ajans onayından sonra platforma katılır." />
      <Card interactive={false} className="flex flex-col gap-4">
        <CardTitle>Yeni davet linki</CardTitle>
        <p className="text-[13px] text-fg-muted">
          Aynı anda en fazla {INFLUENCER_INVITE_LIMITS.active} aktif davetin olabilir; her link en fazla {INFLUENCER_INVITE_LIMITS.maxUses} kişi tarafından, {INFLUENCER_INVITE_LIMITS.maxDays} gün içinde
          kullanılabilir.
        </p>
        <CreateInviteForm allowBrand={false} appUrl={process.env.APP_URL ?? ""} limits={{ maxUses: INFLUENCER_INVITE_LIMITS.maxUses, maxDays: INFLUENCER_INVITE_LIMITS.maxDays }} />
      </Card>
      <Card interactive={false} className="flex flex-col gap-3">
        <CardTitle>Davetlerin</CardTitle>
        {invites.length === 0 ? <p className="text-sm text-fg-passive">Henüz davet oluşturmadın.</p> : null}
        <ul className="flex flex-col divide-y divide-border text-sm">
          {invites.map((i) => {
            const active = !i.revokedAt && i.expiresAt > now && i.uses < i.maxUses;
            return (
              <li key={i.id} className="flex flex-col gap-2 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono tracking-widest">{i.code}</span>
                  <span className="text-[13px] text-fg-muted">
                    {i.uses}/{i.maxUses} kullanım · {fmtDate(i.expiresAt)}’e kadar
                  </span>
                  <StatusDot tone={active ? "active" : "passive"}>{active ? "Aktif" : i.revokedAt ? "İptal" : "Kapandı"}</StatusDot>
                  {active ? (
                    <span className="flex gap-1">
                      <CopyLinkButton link={`${process.env.APP_URL ?? ""}/kayit?kod=${i.code}`} />
                      <RevokeInviteButton id={i.id} />
                    </span>
                  ) : null}
                </div>
                {i.applications.map((a) => (
                  <span key={a.id} className="text-[13px] text-fg-muted">
                    {a.user.name}: {a.status === "PENDING" ? "onay bekliyor" : a.status === "APPROVED" ? "katıldı" : "onaylanmadı"}
                  </span>
                ))}
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}
