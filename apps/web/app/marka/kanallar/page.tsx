import type { Metadata } from "next";
import { prisma } from "@infulancer/core/db";
import { ONBOARDING_STEPS } from "@infulancer/core/channels/onboarding";
import { qualityLabel, statusLabel } from "@infulancer/core/messaging/templates";
import { planCampaign } from "@infulancer/core/messaging/tiers";
import { ConfirmPaymentButton, EnableAgentButton, KnowledgeForm, TemplateForm, WhatsAppSignupForm } from "@/components/inbox/inbox-forms";
import { Card, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/layout";
import { StatusDot } from "@/components/ui/status";
import { InfoNote } from "@/components/ui/unverified";
import { requireActor } from "@/lib/auth-guard";

export const metadata: Metadata = { title: "Kanallar ve agent'lar" };
export const dynamic = "force-dynamic";

export default async function BrandChannelsPage() {
  const actor = await requireActor("BRAND");
  const t = actor.brandId!;
  const [num, templates, catalog, configs, sources, candidates] = await Promise.all([
    prisma.whatsAppNumber.findUnique({ where: { tenantId: t } }),
    prisma.messageTemplate.findMany({ where: { tenantId: t }, orderBy: { name: "asc" } }),
    prisma.agentTemplate.findMany({ orderBy: { key: "asc" } }),
    prisma.agentConfig.findMany({ where: { tenantId: t } }),
    prisma.knowledgeSource.findMany({ where: { tenantId: t, type: { not: "message" } }, orderBy: { createdAt: "desc" }, take: 20 }),
    prisma.influencerCandidate.findMany({ where: { tenantId: t }, orderBy: { createdAt: "desc" }, take: 20 }),
  ]);
  const stepIdx = num ? ONBOARDING_STEPS.findIndex((s) => s.key === (num.paymentMethod === "payment_method_confirmed" ? "done" : num.onboardingStep)) : 0;
  const plan = num ? planCampaign(5000, num.messagingLimit) : null;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Kanallar ve agent'lar" description="WhatsApp numaranız, template'ler, hazır AI agent'lar ve bilgi tabanı." />

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
          <CardTitle>Hazır agent’lar</CardTitle>
          <ul className="flex flex-col divide-y divide-border">
            {catalog.map((a) => {
              const on = configs.find((c) => c.agentId === a.key && c.enabled);
              return (
                <li key={a.key} className="flex items-start justify-between gap-3 py-3">
                  <span className="flex flex-col gap-1">
                    <span className="text-sm">{a.name}</span>
                    <span className="text-[13px] text-fg-muted">{a.description}</span>
                  </span>
                  {on ? <StatusDot>Etkin</StatusDot> : <EnableAgentButton agentKey={a.key} />}
                </li>
              );
            })}
          </ul>
          <p className="text-[13px] text-fg-muted">
            Agent güveni düşükse, müşteri temsilci isterse, şikâyet/hassas konu varsa veya araç çağrısı başarısız olursa konuşma otomatik olarak bir temsilciye aktarılır; bu durumda AI
            ücreti alınmaz.
          </p>
        </Card>
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card interactive={false} className="flex flex-col gap-3">
          <CardTitle>Bilgi tabanı</CardTitle>
          <ul className="flex flex-col text-sm text-fg-muted">
            {sources.map((s) => (
              <li key={s.id}>
                {s.uri} · {s.status}
              </li>
            ))}
          </ul>
          <KnowledgeForm />
          <p className="text-[13px] text-fg-muted">Bilgi tabanınız yalnız sizin konuşmalarınızda kullanılır; başka markalarla paylaşılmaz ve model eğitiminde kullanılmaz.</p>
        </Card>
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
