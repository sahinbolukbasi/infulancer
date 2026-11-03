import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@infulancer/core/db";
import { categoryLabel } from "@infulancer/core/domain/categories";
import { campaignStatusLabels, formatKurus } from "@infulancer/core/domain/labels";
import { kvkkStatus } from "@infulancer/core/compliance/kvkk";
import { BrandUserForm } from "@/components/forms/brand-forms";
import { Card, CardTitle } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/form";
import { PageHeader } from "@/components/ui/layout";
import { StatusDot } from "@/components/ui/status";
import { requireActor } from "@/lib/auth-guard";
import { campaignTone } from "@/lib/status-tone";
import { fmtDate } from "@/lib/time";

export const metadata: Metadata = { title: "Marka profili" };

/** Marka profili — influencer profiliyle aynı yapı: özet, kategoriler, ilişkiler; düzenleme ayrı sayfada. */
export default async function BrandProfilePage({ params }: { params: Promise<{ id: string }> }) {
  await requireActor("ADMIN");
  const { id } = await params;
  const brand = await prisma.brand.findUnique({
    where: { id },
    include: {
      users: { select: { id: true, name: true, email: true }, orderBy: { createdAt: "asc" } },
      campaigns: { select: { id: true, name: true, status: true, startsAt: true, endsAt: true, brandTotalFeeKurus: true, _count: { select: { assignments: true } } }, orderBy: { startsAt: "desc" } },
      categories: { include: { category: { include: { parent: { select: { name: true } } } } }, orderBy: { primary: "desc" } },
      tenantSettings: true,
    },
  });
  if (!brand) notFound();
  const [competitors, number, connections, consents, kvkk, credits, assistants] = await Promise.all([
    prisma.brand.findMany({ where: { id: { in: brand.competitorBrandIds } }, select: { id: true, name: true } }),
    prisma.whatsAppNumber.findUnique({ where: { tenantId: id } }),
    prisma.channelConnection.findMany({ where: { tenantId: id }, select: { id: true, provider: true, status: true } }),
    prisma.consent.groupBy({ by: ["state"], where: { tenantId: id }, _count: true }),
    kvkkStatus(id),
    prisma.creditAccount.findUnique({ where: { tenantId: id } }),
    prisma.agentConfig.count({ where: { tenantId: id, enabled: true } }),
  ]);
  const active = brand.campaigns.filter((c) => c.status === "AKTIF").length;
  const totalFee = brand.campaigns.filter((c) => c.status !== "IPTAL").reduce((s, c) => s + c.brandTotalFeeKurus, 0);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title={brand.name}
        description={`${brand.categories.find((c) => c.primary)?.category.name ?? brand.category} · VKN ${brand.taxNumber} · ${brand.taxOffice}`}
        actions={
          <div className="flex gap-2">
            <ButtonLink href={`/admin/kampanyalar/yeni?marka=${brand.id}`} variant="secondary">
              Yeni kampanya
            </ButtonLink>
            <ButtonLink href={`/admin/markalar/${brand.id}/duzenle`}>Düzenle</ButtonLink>
          </div>
        }
      />

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4" aria-label="Özet">
        {[
          ["Aktif kampanya", String(active)],
          ["Toplam kampanya", String(brand.campaigns.length)],
          ["Toplam marka bedeli", formatKurus(totalFee)],
          ["Panel kullanıcısı", String(brand.users.length)],
        ].map(([l, v]) => (
          <Card key={l} interactive={false} className="flex flex-col gap-1">
            <span className="text-label text-fg-muted">{l}</span>
            <span className="text-[24px] font-semibold tabular-nums">{v}</span>
          </Card>
        ))}
      </section>

      <div className="grid-12">
        <Card interactive={false} className="flex flex-col gap-4 md:col-span-6">
          <CardTitle>Kategoriler ve rakipler</CardTitle>
          <div className="flex flex-wrap gap-2">
            {brand.categories.map((c) => (
              <span key={c.categoryId} className={`rounded-full border px-3 py-1 text-[13px] ${c.primary ? "border-fg text-fg" : "border-border text-fg-muted"}`}>
                {c.primary ? "★ " : ""}
                {categoryLabel(c.category)}
              </span>
            ))}
          </div>
          <p className="text-[13px] text-fg-muted">
            Rakip markalar:{" "}
            {competitors.length
              ? competitors.map((b, i) => (
                  <span key={b.id}>
                    {i ? ", " : ""}
                    <Link href={`/admin/markalar/${b.id}`} className="hover:underline">
                      {b.name}
                    </Link>
                  </span>
                ))
              : "tanımlı değil"}
            . Aynı ana kategorideki markalar da otomatik rakip sayılır (influencer ataması 30 gün engellenir).
          </p>
        </Card>
        <Card interactive={false} className="flex flex-col gap-4 md:col-span-6">
          <CardTitle>İletişim ve sözleşme</CardTitle>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-fg-passive">Yetkili</dt>
            <dd>{brand.contactName}</dd>
            <dt className="text-fg-passive">E-posta</dt>
            <dd>{brand.contactEmail}</dd>
            <dt className="text-fg-passive">Telefon</dt>
            <dd>{brand.contactPhone}</dd>
            <dt className="text-fg-passive">Sözleşme</dt>
            <dd>
              {brand.contractRef ?? "—"}
              {brand.contractStartsAt ? ` · ${fmtDate(brand.contractStartsAt)}` : ""}
            </dd>
          </dl>
        </Card>
      </div>

      <div className="grid-12">
        <Card interactive={false} className="flex flex-col gap-4 md:col-span-7">
          <CardTitle>Kampanyalar</CardTitle>
          {brand.campaigns.length === 0 ? (
            <p className="text-sm text-fg-passive">Kampanya yok.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {brand.campaigns.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 py-2 text-sm">
                  <Link href={`/admin/kampanyalar/${c.id}`} className="hover:underline">
                    {c.name}
                  </Link>
                  <span className="text-[13px] text-fg-muted">
                    {fmtDate(c.startsAt)} – {fmtDate(c.endsAt)} · {c._count.assignments} influencer
                  </span>
                  <StatusDot tone={campaignTone(c.status)}>{campaignStatusLabels[c.status]}</StatusDot>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card interactive={false} className="flex flex-col gap-4 md:col-span-5">
          <CardTitle>Panel kullanıcıları</CardTitle>
          {brand.users.length === 0 ? (
            <p className="text-sm text-fg-passive">Henüz kullanıcı yok.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-border text-sm">
              {brand.users.map((u) => (
                <li key={u.id} className="flex justify-between py-2">
                  <span>{u.name}</span>
                  <span className="text-fg-muted">{u.email}</span>
                </li>
              ))}
            </ul>
          )}
          <BrandUserForm brandId={brand.id} />
        </Card>
      </div>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3" aria-label="Kanal ve uyum durumu">
        <Card interactive={false} className="flex flex-col gap-2">
          <CardTitle>Mesaj kanalları</CardTitle>
          <p className="text-sm text-fg-muted">
            WhatsApp: {number ? `${number.displayNumber ?? number.phoneNumberId} · ${number.paymentMethod === "payment_method_confirmed" ? "kurulum tamam" : "ödeme yöntemi bekleniyor"}` : "bağlı değil"}
          </p>
          {connections.map((c) => (
            <StatusDot key={c.id} tone={c.status === "ACTIVE" ? "active" : "critical"}>
              {c.provider} · {c.status}
            </StatusDot>
          ))}
          <p className="text-[13px] text-fg-passive">{assistants} sohbet asistanı etkin.</p>
          <Link href="/admin/kanallar" className="text-[13px] underline-offset-4 hover:underline">
            Kanallar sayfası →
          </Link>
        </Card>
        <Card interactive={false} className="flex flex-col gap-2">
          <CardTitle>Uyum</CardTitle>
          <StatusDot tone={brand.tenantSettings?.mode === "production" ? "active" : "muted"}>{brand.tenantSettings?.mode === "production" ? "Canlı mod" : "Sandbox (canlı değil)"}</StatusDot>
          <p className="text-sm text-fg-muted">KVKK makbuzu: {kvkk.complete ? "tamam" : `${kvkk.missing.length} eksik`}</p>
          <p className="text-sm text-fg-muted">İYS: {consents.map((c) => `${c.state} ${c._count}`).join(" · ") || "kayıt yok"}</p>
          <Link href="/admin/uyum" className="text-[13px] underline-offset-4 hover:underline">
            Uyum sayfası →
          </Link>
        </Card>
        <Card interactive={false} className="flex flex-col gap-2">
          <CardTitle>Creative kredisi</CardTitle>
          <p className="text-[24px] font-semibold tabular-nums">{credits ? Number(credits.balanceCredits) : 0}</p>
          <p className="text-[13px] text-fg-muted">{credits ? `${Number(credits.heldCredits)} kredi devam eden işlerde bloke` : "Kredi hesabı yok"}</p>
          <Link href="/admin/creative" className="text-[13px] underline-offset-4 hover:underline">
            Creative sayfası →
          </Link>
        </Card>
      </section>
    </div>
  );
}
