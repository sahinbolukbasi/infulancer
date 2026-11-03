import type { Metadata } from "next";
import { prisma } from "@infulancer/core/db";
import { ONBOARDING_STEPS } from "@infulancer/core/channels/onboarding";
import { qualityLabel, statusLabel } from "@infulancer/core/messaging/templates";
import { planCampaign } from "@infulancer/core/messaging/tiers";
import Link from "next/link";
import { ConfirmPaymentButton, TemplateForm, WhatsAppSignupForm } from "@/components/inbox/inbox-forms";
import { Card, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/layout";
import { StatusDot } from "@/components/ui/status";
import { InfoNote } from "@/components/ui/unverified";
import { requireActor } from "@/lib/auth-guard";
import { PageGuide } from "@/components/ui/page-guide";

export const metadata: Metadata = { title: "Kanallar" };
export const dynamic = "force-dynamic";

export default async function BrandChannelsPage() {
  const actor = await requireActor("BRAND");
  const t = actor.brandId!;
  const [num, templates, configs, candidates] = await Promise.all([
    prisma.whatsAppNumber.findUnique({ where: { tenantId: t } }),
    prisma.messageTemplate.findMany({ where: { tenantId: t }, orderBy: { name: "asc" } }),
    prisma.agentConfig.findMany({ where: { tenantId: t } }),
    prisma.influencerCandidate.findMany({ where: { tenantId: t }, orderBy: { createdAt: "desc" }, take: 20 }),
  ]);
  const stepIdx = num ? ONBOARDING_STEPS.findIndex((s) => s.key === (num.paymentMethod === "payment_method_confirmed" ? "done" : num.onboardingStep)) : 0;
  const plan = num ? planCampaign(5000, num.messagingLimit) : null;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Kanallar" description="WhatsApp numaranızın kurulumu, mesaj template’leri ve DM’den gelen creator başvuruları." />
      <PageGuide
        what="Müşterilerinizle WhatsApp ve Instagram üzerinden konuşmanızı sağlayan kurulum. Kurulum bitince gelen mesajlar Gelen kutusu’na düşer ve asistanınız ilk cevabı verir."
        why="Müşteri size yazdıktan sonraki 24 saat içinde serbest mesaj yazabilirsiniz; sonrasında yalnız Meta onaylı template gönderilebilir (ücretli). Kampanya duyuruları için İYS onayı gerekir."
        steps={[
          { label: "WhatsApp numaranızı bağlayın", done: !!num },
          { label: "WhatsApp Manager’da ödeme yönteminizi ekleyin", done: num?.paymentMethod === "payment_method_confirmed", hint: "Mesaj ücretlerini Meta doğrudan sizden tahsil eder" },
          { label: "En az bir template oluşturup Meta onayından geçirin", done: templates.some((x) => x.status === "ACTIVE"), hint: "İnceleme 24 saate kadar sürebilir" },
          { label: "Sohbet asistanınızı açın ve bilgi tabanını doldurun", done: configs.some((c) => c.enabled), hint: "Asistanlar sayfası" },
          { label: "Uyum sayfasından KVKK bildirimini tamamlayıp canlıya geçin", done: false, hint: "Uyum sayfası" },
        ]}
      />

      <Card interactive={false} className="flex flex-col gap-4">
        <CardTitle>WhatsApp kurulumu</CardTitle>
        <ol className="flex flex-col gap-2 text-sm">
          {ONBOARDING_STEPS.map((s, i) => (
            <li key={s.key}>
              <StatusDot tone={i < stepIdx || (num && s.key === "done" && num.paymentMethod === "payment_method_confirmed") ? "active" : i === stepIdx ? "critical" : "passive"}>{s.label}</StatusDot>
            </li>
          ))}
        </ol>
        {!num ? <WhatsAppSignupForm /> : null}
        {num && num.paymentMethod === "payment_method_pending" ? (
          <div className="flex flex-col gap-2">
            <InfoNote>
              Son adım: WhatsApp Manager’da kendi ödeme yönteminizi ekleyin. Mesaj ücretlerini Meta doğrudan sizden tahsil eder; bu adım olmadan mesaj gönderilemez.
            </InfoNote>
            <ConfirmPaymentButton />
          </div>
        ) : null}
        {num?.onboardingStep === "identity_verification" ? <InfoNote>Meta ek bilgi istedi: iş doğrulaması (kimlik doğrulama) adımını tamamlayın.</InfoNote> : null}
        {plan ? (
          <p className="text-[13px] text-fg-muted">
            Mevcut kademe ({num!.messagingLimit}) ile 5.000 kişilik bir kampanya {plan.estimatedDays} günde gönderilir; planlayıcı kademeyi aşan gönderimi günlere böler. 2.000 kademesine
            geçmenin en pratik yolu iş doğrulamasıdır.
          </p>
        ) : null}
      </Card>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card interactive={false} className="flex flex-col gap-3">
          <CardTitle>Template’ler</CardTitle>
          <ul className="flex flex-col divide-y divide-border text-sm">
            {templates.map((x) => (
              <li key={x.id} className="flex justify-between gap-2 py-2">
                <span>
                  {x.name} · {x.category}
                </span>
                <span className="text-fg-muted">
                  {statusLabel[x.status]} · {qualityLabel[x.quality]}
                </span>
              </li>
            ))}
          </ul>
          <TemplateForm />
        </Card>
        <Card interactive={false} className="flex flex-col gap-3">
          <CardTitle>Sohbet asistanları</CardTitle>
          <p className="text-sm text-fg-muted">
            {configs.filter((c) => c.enabled).length} asistan açık. Asistanların ayarları, aktarma kuralları ve bilgi tabanı artık “Asistanlar” sayfasında.
          </p>
          <Link href="/marka/asistanlar" className="text-sm underline-offset-4 hover:underline">
            Asistanları yönet →
          </Link>
        </Card>
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card interactive={false} className="flex flex-col gap-3">
          <CardTitle>DM’den gelen creator başvuruları</CardTitle>
          {candidates.length === 0 ? (
            <p className="text-sm text-fg-passive">Henüz başvuru yok.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-border text-sm">
              {candidates.map((c) => (
                <li key={c.id} className="flex flex-col py-2">
                  <span>@{c.handle ?? "?"} · {c.category ?? "kategori yok"}</span>
                  <span className="text-[13px] text-fg-muted">
                    {c.followers ? `${c.followers.toLocaleString("tr-TR")} takipçi` : "takipçi bilinmiyor"} · {c.priceExpectation ?? "fiyat yok"} · {c.contact ?? "iletişim yok"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>
    </div>
  );
}
