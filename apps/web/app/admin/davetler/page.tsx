import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@infulancer/core/db";
import { CopyLinkButton, CreateInviteForm, ReviewApplicationForm, RevokeInviteButton } from "@/components/signup/invite-forms";
import { Card, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/layout";
import { PageGuide } from "@/components/ui/page-guide";
import { StatusDot } from "@/components/ui/status";
import { requireActor } from "@/lib/auth-guard";
import { cn } from "@/lib/cn";
import { fmtDate, fmtDateTime } from "@/lib/time";

export const metadata: Metadata = { title: "Davetler ve üyelik" };
export const dynamic = "force-dynamic";

type AppData = { kind: "INFLUENCER" | "BRAND"; categoryIds: string[]; city?: string; instagram?: string; tiktok?: string; youtube?: string; companyName?: string; taxOffice?: string; taxNumber?: string; website?: string; about?: string };

export default async function InvitesPage({ searchParams }: { searchParams: Promise<{ bolum?: string }> }) {
  await requireActor("ADMIN");
  const { bolum } = await searchParams;
  const section = bolum === "davetler" ? "davetler" : "basvurular";
  const appUrl = process.env.APP_URL ?? "";
  const now = new Date();
  const [pending, recent, invites, brands, cats] = await Promise.all([
    prisma.signupApplication.findMany({ where: { status: "PENDING" }, orderBy: { createdAt: "asc" }, include: { user: true, invite: { include: { createdBy: { select: { name: true, role: true } } } } } }),
    prisma.signupApplication.findMany({ where: { status: { not: "PENDING" } }, orderBy: { reviewedAt: "desc" }, take: 20, include: { user: { select: { name: true, email: true } } } }),
    prisma.invite.findMany({ orderBy: { createdAt: "desc" }, take: 100, include: { createdBy: { select: { name: true, role: true } }, _count: { select: { applications: true } } } }),
    prisma.brand.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.category.findMany({ select: { id: true, name: true } }),
  ]);
  const catName = new Map(cats.map((c) => [c.id, c.name]));

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Davetler ve üyelik" description="Platforma yalnız davetle katılınır. Davet linkiyle kayıt olan kişi siz onaylayana kadar yalnız “üyeliğiniz onay bekliyor” ekranını görür." />
      <PageGuide
        open={false}
        what="Influencer veya marka için tek kullanımlık (veya çok kullanımlık) davet linki oluşturun. Influencer’lar da kendi panellerinden influencer daveti üretebilir; bu başvurular da buraya, sizin onayınıza düşer."
        why="Onayladığınızda influencer/marka profili otomatik oluşturulur (kategoriler ve hesaplar başvurudan gelir). Influencer’ın IBAN ve vergi bilgisi girilene kadar ödeme kilitli kalır."
      />
      <nav aria-label="Bölümler" className="flex gap-2 border-b border-border">
        {[
          ["basvurular", `Onay bekleyenler (${pending.length})`],
          ["davetler", "Davet linkleri"],
        ].map(([id, label]) => (
          <Link key={id} href={`/admin/davetler?bolum=${id}`} aria-current={section === id ? "page" : undefined} className={cn("-mb-px border-b-2 px-3 py-2 text-sm", section === id ? "border-fg text-fg" : "border-transparent text-fg-muted hover:text-fg")}>
            {label}
          </Link>
        ))}
      </nav>

      {section === "basvurular" ? (
        <div className="flex flex-col gap-4">
          {pending.length === 0 ? <p className="text-sm text-fg-passive">Onay bekleyen başvuru yok.</p> : null}
          {pending.map((a) => {
            const d = a.data as AppData;
            return (
              <Card key={a.id} interactive={false} className="flex flex-col gap-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex flex-col gap-1">
                    <CardTitle>{a.targetRole === "BRAND" ? d.companyName : a.user.name}</CardTitle>
                    <p className="text-[13px] text-fg-muted">
                      {a.targetRole === "BRAND" ? `Marka · başvuran ${a.user.name}` : "Influencer"} · {a.user.email} · {a.user.phone ?? "—"}
                    </p>
                  </div>
                  <span className="text-[12px] text-fg-passive">
                    {fmtDateTime(a.createdAt)} · davet: {a.invite.createdBy.name}
                    {a.invite.createdBy.role === "INFLUENCER" ? " (influencer)" : ""}
                  </span>
                </div>
                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                  <dt className="text-fg-passive">Kategoriler</dt>
                  <dd>{d.categoryIds.map((id) => catName.get(id) ?? "?").join(", ")}</dd>
                  {a.targetRole === "BRAND" ? (
                    <>
                      <dt className="text-fg-passive">Vergi</dt>
                      <dd>
                        {d.taxOffice} · {d.taxNumber}
                      </dd>
                      {d.website ? (
                        <>
                          <dt className="text-fg-passive">Web</dt>
                          <dd>{d.website}</dd>
                        </>
                      ) : null}
                    </>
                  ) : (
                    <>
                      <dt className="text-fg-passive">Hesaplar</dt>
                      <dd>{[d.instagram && `IG ${d.instagram}`, d.tiktok && `TikTok ${d.tiktok}`, d.youtube && `YT ${d.youtube}`].filter(Boolean).join(" · ")}</dd>
                      {d.city ? (
                        <>
                          <dt className="text-fg-passive">Şehir</dt>
                          <dd>{d.city}</dd>
                        </>
                      ) : null}
                    </>
                  )}
                  {d.about ? (
                    <>
                      <dt className="text-fg-passive">Tanıtım</dt>
                      <dd className="text-fg-muted">{d.about}</dd>
                    </>
                  ) : null}
                </dl>
                <ReviewApplicationForm id={a.id} isBrand={a.targetRole === "BRAND"} brands={brands} />
              </Card>
            );
          })}
          {recent.length ? (
            <Card interactive={false} className="flex flex-col gap-3">
              <CardTitle>Son kararlar</CardTitle>
              <ul className="flex flex-col divide-y divide-border text-sm">
                {recent.map((a) => (
                  <li key={a.id} className="flex flex-wrap justify-between gap-2 py-2">
                    <span>
                      {a.user.name} · {a.user.email}
                    </span>
                    <StatusDot tone={a.status === "APPROVED" ? "active" : "critical"}>
                      {a.status === "APPROVED" ? "Onaylandı" : "Reddedildi"} {a.reviewedAt ? fmtDate(a.reviewedAt) : ""}
                    </StatusDot>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          <Card interactive={false} className="flex flex-col gap-4">
            <CardTitle>Yeni davet</CardTitle>
            <CreateInviteForm allowBrand appUrl={appUrl} />
          </Card>
          <Card interactive={false} className="flex flex-col gap-3">
            <CardTitle>Davetler</CardTitle>
            <ul className="flex flex-col divide-y divide-border text-sm">
              {invites.map((i) => {
                const state = i.revokedAt ? "İptal" : i.expiresAt <= now ? "Süresi doldu" : i.uses >= i.maxUses ? "Kullanıldı" : "Aktif";
                return (
                  <li key={i.id} className="flex flex-wrap items-center justify-between gap-3 py-2">
                    <span className="flex flex-col">
                      <span className="font-mono tracking-widest">{i.code}</span>
                      <span className="text-[12px] text-fg-passive">
                        {i.targetRole === "BRAND" ? "Marka" : "Influencer"} · {i.createdBy.name}
                        {i.createdBy.role === "INFLUENCER" ? " (influencer)" : ""} · {i.note ?? "not yok"}
                      </span>
                    </span>
                    <span className="text-[13px] tabular-nums text-fg-muted">
                      {i.uses}/{i.maxUses} kullanım · {fmtDate(i.expiresAt)}’e kadar
                    </span>
                    <StatusDot tone={state === "Aktif" ? "active" : "passive"}>{state}</StatusDot>
                    {state === "Aktif" ? (
                      <span className="flex gap-1">
                        <CopyLinkButton link={`${appUrl}/kayit?kod=${i.code}`} />
                        <RevokeInviteButton id={i.id} />
                      </span>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </Card>
        </div>
      )}
    </div>
  );
}
