import type { Metadata } from "next";
import { prisma } from "@infulancer/core/db";
import { couponValueLabel } from "@infulancer/core/coupons/service";
import { CouponForm } from "@/components/coupons/coupon-forms";
import { Card } from "@/components/ui/card";
import { DataTable, type DataTableRow } from "@/components/ui/data-table";
import { StatusCards } from "@/components/ui/status-cards";
import { PageHeader } from "@/components/ui/layout";
import { StatusDot } from "@/components/ui/status";
import { Tabs } from "@/components/ui/tabs";
import { requireActor } from "@/lib/auth-guard";
import { fmtDate } from "@/lib/time";

export const metadata: Metadata = { title: "Kuponlar" };
export const dynamic = "force-dynamic";

const statusTr: Record<string, string> = { TASLAK: "Taslak", YAYINDA: "Yayında", PASIF: "Pasif" };
const tone: Record<string, "active" | "muted" | "passive"> = { TASLAK: "muted", YAYINDA: "active", PASIF: "passive" };
const statusRank: Record<string, number> = { YAYINDA: 0, TASLAK: 1, PASIF: 2 };

export default async function AdminCouponsPage() {
  await requireActor("ADMIN");
  const [coupons, brands, redeemed] = await Promise.all([
    prisma.coupon.findMany({ orderBy: { createdAt: "desc" }, take: 100, include: { _count: { select: { grants: true } } } }),
    prisma.brand.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.couponGrant.groupBy({ by: ["couponId"], where: { status: "KULLANILDI" }, _count: true }),
  ]);
  const redeemedMap = new Map(redeemed.map((r) => [r.couponId, r._count]));
  const active = coupons.filter((c) => c.status === "YAYINDA").length;
  const totalGrants = coupons.reduce((s, c) => s + c._count.grants, 0);
  const totalRedeemed = redeemed.reduce((s, r) => s + r._count, 0);
  const redeemRate = totalGrants ? Math.round((totalRedeemed / totalGrants) * 100) : 0;

  const rows: DataTableRow[] = coupons.map((c) => ({
    id: c.id,
    label: c.title,
    cells: {
      title: { display: <span className="font-medium">{c.title}</span>, sort: c.title },
      kind: c.kind === "HEDIYE_CEKI" ? "Hediye çeki" : "Kupon",
      value: couponValueLabel(c.valueType, c.value),
      grants: { display: <span className="tabular-nums">{c._count.grants}</span>, sort: c._count.grants },
      used: { display: <span className="tabular-nums">{redeemedMap.get(c.id) ?? 0}</span>, sort: redeemedMap.get(c.id) ?? 0 },
      valid: { display: c.validUntil ? fmtDate(c.validUntil) : "—", sort: c.validUntil?.getTime() ?? 0 },
      status: { display: <StatusDot tone={tone[c.status]}>{statusTr[c.status]}</StatusDot>, sort: statusRank[c.status] ?? 9 },
    },
    actions: [
      { label: "Yönet", href: `/admin/kuponlar/${c.id}`, icon: "open" },
      { label: "Önizle", href: `/kupon/${c.id}`, icon: "wallet" },
    ],
  }));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Kuponlar ve hediye çekleri" description="Marka logolu kupon/hediye çeki tasarlayın, influencer'lara gönderin; Apple/Google Wallet'a eklenir." />
      <StatusCards
        items={[
          { title: "Aktif kupon", state: active ? "ok" : "warn", value: String(active), text: `${coupons.length} toplam` },
          { title: "Gönderim", state: "ok", value: String(totalGrants), text: "kişiye gönderildi" },
          { title: "Kullanım", state: "ok", value: String(totalRedeemed), text: "kupon kullanıldı" },
          { title: "Kullanım oranı", state: redeemRate >= 30 ? "ok" : "warn", value: `%${redeemRate}`, text: "gönderim → kullanım" },
        ]}
      />
      <Tabs
        label="Kupon bölümleri"
        tabs={[
          {
            id: "liste",
            label: `Kuponlar (${coupons.length})`,
            content:
              coupons.length === 0 ? (
                <p className="text-sm text-fg-passive">Henüz kupon yok.</p>
              ) : (
                <DataTable
                  caption="Kuponlar"
                  columns={[
                    { key: "title", header: "Başlık", sortable: true },
                    { key: "kind", header: "Tür" },
                    { key: "value", header: "Değer" },
                    { key: "grants", header: "Gönderim", sortable: true, align: "right" },
                    { key: "used", header: "Kullanım", sortable: true, align: "right" },
                    { key: "valid", header: "Son kullanım", sortable: true },
                    { key: "status", header: "Durum", sortable: true },
                  ]}
                  rows={rows}
                />
              ),
          },
          { id: "yeni", label: "Yeni kupon", content: <Card interactive={false}><CouponForm isAdmin brands={brands} /></Card> },
        ]}
      />
    </div>
  );
}
