import { getTT } from "@/lib/i18n/tt-server";
import type { Metadata } from "next";
import { prisma } from "@infulancer/core/db";
import { kvkkConsentCopy, kvkkStatus } from "@infulancer/core/compliance/kvkk";
import { ConsentForm, KvkkForms } from "@/components/inbox/inbox-forms";
import { Card, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/layout";
import { StatusDot } from "@/components/ui/status";
import { InfoNote } from "@/components/ui/unverified";
import { requireActor } from "@/lib/auth-guard";
import { StatusCards } from "@/components/ui/status-cards";
import { fmtDateTime } from "@/lib/time";

export const metadata: Metadata = { title: "Uyum" };
export const dynamic = "force-dynamic";

export default async function BrandCompliancePage() {
  const tt = await getTT();
  const actor = await requireActor("BRAND");
  const t = actor.brandId!;
  const [settings, status, consents] = await Promise.all([
    prisma.tenantSettings.findUnique({ where: { tenantId: t } }),
    kvkkStatus(t),
    prisma.consent.findMany({ where: { tenantId: t }, orderBy: { createdAt: "desc" }, take: 50 }),
  ]);
  return (
    <div className="flex flex-col gap-8">
      <PageHeader title={tt("Uyum")} description={tt("Üç kart yeşilse yasal olarak hazırsınız.")} />
      <StatusCards
        items={[
          {
            title: "KVKK bildirimi",
            state: status.complete ? "ok" : status.filings.length ? "warn" : "bad",
            value: status.complete ? "Tamam" : `${status.missing.length} makbuz eksik`,
            text: status.complete ? "Yurt dışı aktarım makbuzları yüklü." : "Sözleşmeyi imzalayıp iki makbuzu yükleyin (5 iş günü).",
            href: "#kvkk",
            action: status.filings.length ? "Makbuz yükle" : "Sözleşmeyi imzala",
          },
          {
            title: "İYS onayları",
            state: consents.some((c) => c.state === "ONAY") ? "ok" : "warn",
            value: `${consents.filter((c) => c.state === "ONAY").length} onay`,
            text: "Onaysız kişiye kampanya mesajı gitmez.",
            href: "#iys",
            action: "Onay ekle",
          },
          {
            title: "Canlı mod",
            state: settings?.mode === "production" ? "ok" : "bad",
            value: settings?.mode === "production" ? "Canlı" : "Deneme",
            text: settings?.mode === "production" ? "Mesajlar gerçek alıcılara gidiyor." : "KVKK tamamlanınca canlıya geçilir.",
            href: "#kvkk",
            action: "Adımları tamamla",
          },
        ]}
      />
      <Card interactive={false} className="flex scroll-mt-24 flex-col gap-4" id="kvkk">
        <div className="flex items-center justify-between gap-3">
          <CardTitle>{tt("KVKK standart sözleşme")}</CardTitle>
          <StatusDot tone={settings?.mode === "production" ? "active" : "muted"}>{settings?.mode === "production" ? tt("Canlı") : tt("Sandbox")}</StatusDot>
        </div>
        <p className="text-[13px] text-fg-muted">{tt("AWS ve Meta için iki makbuz gerekir; imzadan sonra 5 iş günü içinde yükleyin.")}</p>
        <ul className="flex flex-col gap-1 text-sm">
          {status.filings.map((f) => (
            <li key={f.id} className="flex justify-between">
              <span>{f.transferTarget}</span>
              <span className="text-fg-muted">{f.receiptS3Key ? tt("makbuz yüklendi") : `son tarih ${fmtDateTime(f.dueAt)}`}</span>
            </li>
          ))}
        </ul>
        <KvkkForms signed={status.filings.length > 0} missing={status.missing.map((m) => ({ key: m.key, label: m.label }))} />
      </Card>

      <Card interactive={false} className="flex scroll-mt-24 flex-col gap-4" id="iys">
        <CardTitle>{tt("İYS onayları")}</CardTitle>
        <InfoNote>
          {kvkkConsentCopy.marketing} / {kvkkConsentCopy.aiProcessing} — {kvkkConsentCopy.note}
        </InfoNote>
        <ConsentForm />
        <ul className="flex flex-col divide-y divide-border text-sm">
          {consents.map((c) => (
            <li key={c.id} className="flex flex-wrap justify-between gap-2 py-2">
              <span>
                {c.recipient} · {c.channel}
              </span>
              <StatusDot tone={c.state === "RET" ? "critical" : "active"}>{c.state}</StatusDot>
              <span className="text-[13px] text-fg-muted">{c.registeredAt ? `İYS'ye iletildi ${fmtDateTime(c.registeredAt)}` : tt("İYS'ye iletilmeyi bekliyor")}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
