import type { Metadata } from "next";
import { prisma } from "@infulancer/core/db";
import { kvkkConsentCopy, kvkkStatus } from "@infulancer/core/compliance/kvkk";
import { ConsentForm, KvkkForms } from "@/components/inbox/inbox-forms";
import { Card, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/layout";
import { StatusDot } from "@/components/ui/status";
import { InfoNote } from "@/components/ui/unverified";
import { requireActor } from "@/lib/auth-guard";
import { PageGuide } from "@/components/ui/page-guide";
import { fmtDateTime } from "@/lib/time";

export const metadata: Metadata = { title: "Uyum" };
export const dynamic = "force-dynamic";

export default async function BrandCompliancePage() {
  const actor = await requireActor("BRAND");
  const t = actor.brandId!;
  const [settings, status, consents] = await Promise.all([
    prisma.tenantSettings.findUnique({ where: { tenantId: t } }),
    kvkkStatus(t),
    prisma.consent.findMany({ where: { tenantId: t }, orderBy: { createdAt: "desc" }, take: 50 }),
  ]);
  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Uyum" description="KVKK yurt dışı aktarım bildirimi, İYS onayları ve canlı moda geçiş." />
      <PageGuide
        what="Mesajlaşmayı yasal olarak başlatabilmeniz için gereken adımlar. Bu adımlar tamamlanmadan hesabınız deneme (sandbox) modunda kalır."
        why="KVKK bildirimi yapılmaması 90.308–1.806.377 TL, İYS onayı olmadan ticari ileti alıcı başına 2.859–14.309 TL cezaya konu olabilir."
        steps={[
          { label: "Veri işleyen standart sözleşmesini imzalayın", done: status.filings.length > 0 },
          { label: "Kurul’a bildirim yapıp iki makbuzu yükleyin (AWS ve Meta)", done: status.complete, hint: "İmzadan sonra 5 iş günü içinde" },
          { label: "Canlı moda geçin", done: settings?.mode === "production" },
          { label: "Pazarlama mesajı göndereceğiniz kişilerin İYS onaylarını kaydedin", done: consents.some((c) => c.state === "ONAY"), hint: "Onaysız kişiye kampanya mesajı sistem tarafından engellenir" },
        ]}
      />

      <Card interactive={false} className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <CardTitle>KVKK standart sözleşme</CardTitle>
          <StatusDot tone={settings?.mode === "production" ? "active" : "muted"}>{settings?.mode === "production" ? "Canlı" : "Sandbox"}</StatusDot>
        </div>
        <InfoNote>
          Verileriniz iki ayrı yurt dışı aktarıma konu olur: AWS eu-central-1 (barındırma) ve Meta WhatsApp Cloud API (mesaj işleme). Sözleşme imzasından sonra 5 iş günü içinde Kurul’un
          Standart Sözleşme Bildirim Modülü’ne bildirim yapıp makbuzu buraya yüklemelisiniz. Makbuz olmadan canlı moda geçilemez.
        </InfoNote>
        <ul className="flex flex-col gap-1 text-sm">
          {status.filings.map((f) => (
            <li key={f.id} className="flex justify-between">
              <span>{f.transferTarget}</span>
              <span className="text-fg-muted">{f.receiptS3Key ? "makbuz yüklendi" : `son tarih ${fmtDateTime(f.dueAt)}`}</span>
            </li>
          ))}
        </ul>
        <KvkkForms signed={status.filings.length > 0} missing={status.missing.map((m) => ({ key: m.key, label: m.label }))} />
      </Card>

      <Card interactive={false} className="flex flex-col gap-4">
        <CardTitle>İYS onayları</CardTitle>
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
              <span className="text-[13px] text-fg-muted">{c.registeredAt ? `İYS'ye iletildi ${fmtDateTime(c.registeredAt)}` : "İYS'ye iletilmeyi bekliyor"}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
