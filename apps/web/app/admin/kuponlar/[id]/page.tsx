import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@infulancer/core/db";
import { couponValueLabel } from "@infulancer/core/coupons/service";
import { CouponStatusButton, GrantForm } from "@/components/coupons/coupon-forms";
import { mediaSrc } from "@/lib/media";
import { Card, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/layout";
import { StatusDot } from "@/components/ui/status";
import { requireActor } from "@/lib/auth-guard";
import { fmtDate } from "@/lib/time";

export const metadata: Metadata = { title: "Kupon" };
export const dynamic = "force-dynamic";

const statusTr: Record<string, string> = { TASLAK: "Taslak", YAYINDA: "Yayında", PASIF: "Pasif" };
const grantTr: Record<string, string> = { GONDERILDI: "Gönderildi", GORULDU: "Görüldü", KULLANILDI: "Kullanıldı", IPTAL: "İptal" };

export default async function AdminCouponDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireActor("ADMIN");
  const { id } = await params;
  const c = await prisma.coupon.findUnique({ where: { id }, include: { grants: { orderBy: { createdAt: "desc" } } } });
  if (!c) notFound();
  const influencers = await prisma.influencer.findMany({ where: { user: { status: "ACTIVE" } }, orderBy: { name: "asc" }, select: { id: true, name: true, category: true } });
  const names = new Map(
    (await prisma.influencer.findMany({ where: { id: { in: c.grants.map((g) => g.influencerId).filter((x): x is string => !!x) } }, select: { id: true, name: true } })).map((x) => [x.id, x.name]),
  );
  const logo = mediaSrc(c.logoKey);
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={c.title}
        description={`${c.kind === "HEDIYE_CEKI" ? "Hediye çeki" : "Kupon"} · ${couponValueLabel(c.valueType, c.value)}${c.validUntil ? ` · son kullanım ${fmtDate(c.validUntil)}` : ""}`}
        actions={<StatusDot tone={c.status === "YAYINDA" ? "active" : "muted"}>{statusTr[c.status]}</StatusDot>}
      />
      <div className="flex flex-wrap gap-2">
        {c.status !== "YAYINDA" ? <CouponStatusButton id={c.id} to="YAYINDA" label="Yayına al" variant="primary" /> : <CouponStatusButton id={c.id} to="PASIF" label="Pasife al" />}
        <Link href={`/kupon/${c.id}`} className="inline-flex items-center rounded-[8px] border border-line px-3 py-1.5 text-[13px] hover:border-neon-pink">Önizle →</Link>
      </div>

      {logo ? (
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logo} alt="" className="h-14 w-14 rounded-xl object-cover ring-1 ring-line" />
          <span className="text-[13px] text-fg-muted">{c.description}</span>
        </div>
      ) : c.description ? (
        <p className="text-[13px] text-fg-muted">{c.description}</p>
      ) : null}

      <Card interactive={false} className="flex flex-col gap-3">
        <CardTitle>Influencer&apos;lara gönder</CardTitle>
        {c.status !== "YAYINDA" ? <p className="text-[13px] text-neon-amber">Göndermek için önce yayına alın.</p> : <GrantForm couponId={c.id} influencers={influencers} />}
      </Card>

      <Card interactive={false} className="flex flex-col gap-3">
        <CardTitle>Gönderimler ({c.grants.length})</CardTitle>
        {c.grants.length === 0 ? (
          <p className="text-sm text-fg-passive">Henüz gönderim yok.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-line">
            {c.grants.map((g) => (
              <li key={g.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <span>{g.influencerId ? (names.get(g.influencerId) ?? "Influencer") : "—"}</span>
                <span className="flex items-center gap-3">
                  <span className="font-mono text-[12px] text-fg-muted">{g.code}</span>
                  <StatusDot tone={g.status === "KULLANILDI" ? "passive" : g.status === "IPTAL" ? "critical" : "active"}>{grantTr[g.status]}</StatusDot>
                  <Link href={`/kupon/${g.id}`} className="text-[13px] text-neon-pink hover:underline">Kart →</Link>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
