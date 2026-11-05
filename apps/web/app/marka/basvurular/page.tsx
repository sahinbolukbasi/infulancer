import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@infulancer/core/db";
import { OpenCallForm } from "@/components/campaigns/open-call-forms";
import { Card, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/layout";
import { StatusDot } from "@/components/ui/status";
import { Tabs } from "@/components/ui/tabs";
import { requireActor } from "@/lib/auth-guard";
import { fmtDate } from "@/lib/time";

export const metadata: Metadata = { title: "Başvurular" };
export const dynamic = "force-dynamic";
const statusTr: Record<string, string> = { TASLAK: "Taslak", ACIK: "Açık", KAPALI: "Kapalı" };
const tone: Record<string, "active" | "muted" | "passive"> = { TASLAK: "muted", ACIK: "active", KAPALI: "passive" };

export default async function BrandOpenCallsPage() {
  const actor = await requireActor("BRAND");
  const calls = await prisma.campaignOpenCall.findMany({ where: { tenantId: actor.brandId! }, orderBy: { createdAt: "desc" }, take: 60, include: { _count: { select: { applications: true } } } });
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Başvuru çağrıları" description="Kampanya için başvuru açın; içerik üreticileri başvursun. Belirli kişilere doğrudan teklif için Influencer bul sayfasını kullanın." />
      <Tabs
        label="Başvuru bölümleri"
        tabs={[
          {
            id: "liste",
            label: `Çağrılarım (${calls.length})`,
            content:
              calls.length === 0 ? (
                <p className="text-sm text-fg-passive">Henüz çağrı yok.</p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {calls.map((c) => (
                    <li key={c.id}>
                      <Link href={`/marka/basvurular/${c.id}`} className="block">
                        <Card className="flex flex-wrap items-center justify-between gap-3">
                          <div className="flex flex-col">
                            <CardTitle>{c.title}</CardTitle>
                            <span className="text-[13px] text-fg-muted">{c._count.applications} başvuru{c.deadline ? ` · son ${fmtDate(c.deadline)}` : ""}</span>
                          </div>
                          <StatusDot tone={tone[c.status]}>{statusTr[c.status]}</StatusDot>
                        </Card>
                      </Link>
                    </li>
                  ))}
                </ul>
              ),
          },
          { id: "yeni", label: "Yeni çağrı", content: <Card interactive={false}><OpenCallForm isAdmin={false} /></Card> },
        ]}
      />
    </div>
  );
}
