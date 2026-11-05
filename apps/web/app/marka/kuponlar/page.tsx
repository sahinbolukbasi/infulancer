import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@infulancer/core/db";
import { couponValueLabel } from "@infulancer/core/coupons/service";
import { CouponForm } from "@/components/coupons/coupon-forms";
import { Card, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/layout";
import { StatusDot } from "@/components/ui/status";
import { Tabs } from "@/components/ui/tabs";
import { requireActor } from "@/lib/auth-guard";
import { fmtDate } from "@/lib/time";

export const metadata: Metadata = { title: "Kuponlar" };
export const dynamic = "force-dynamic";
const statusTr: Record<string, string> = { TASLAK: "Taslak", YAYINDA: "Yayında", PASIF: "Pasif" };
const tone: Record<string, "active" | "muted" | "passive"> = { TASLAK: "muted", YAYINDA: "active", PASIF: "passive" };

export default async function BrandCouponsPage() {
  const actor = await requireActor("BRAND");
  const coupons = await prisma.coupon.findMany({ where: { tenantId: actor.brandId! }, orderBy: { createdAt: "desc" }, take: 60, include: { _count: { select: { grants: true } } } });
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Kuponlar ve hediye çekleri" description="Logolu kupon/hediye çeki tasarlayın, influencer'lara gönderin; Apple/Google Wallet'a eklenir." />
      <Tabs
        label="Kupon bölümleri"
        tabs={[
          {
            id: "liste",
            label: `Kuponlarım (${coupons.length})`,
            content:
              coupons.length === 0 ? (
                <p className="text-sm text-fg-passive">Henüz kupon yok.</p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {coupons.map((c) => (
                    <li key={c.id}>
                      <Link href={`/marka/kuponlar/${c.id}`} className="block">
                        <Card className="flex flex-wrap items-center justify-between gap-3">
                          <div className="flex flex-col">
                            <CardTitle>{c.title}</CardTitle>
                            <span className="text-[13px] text-fg-muted">{c.kind === "HEDIYE_CEKI" ? "Hediye çeki" : "Kupon"} · {couponValueLabel(c.valueType, c.value)} · {c._count.grants} gönderim{c.validUntil ? ` · son ${fmtDate(c.validUntil)}` : ""}</span>
                          </div>
                          <StatusDot tone={tone[c.status]}>{statusTr[c.status]}</StatusDot>
                        </Card>
                      </Link>
                    </li>
                  ))}
                </ul>
              ),
          },
          { id: "yeni", label: "Yeni kupon", content: <Card interactive={false}><CouponForm isAdmin={false} /></Card> },
        ]}
      />
    </div>
  );
}
