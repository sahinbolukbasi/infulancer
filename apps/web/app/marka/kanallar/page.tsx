import type { Metadata } from "next";
import { prisma } from "@infulancer/core/db";
import { statusLabel } from "@infulancer/core/messaging/templates";
import { planCampaign } from "@infulancer/core/messaging/tiers";
import Link from "next/link";
import { ConfirmPaymentButton, TemplateForm, WhatsAppSignupForm } from "@/components/inbox/inbox-forms";
import { Card, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/layout";
import { InfoNote } from "@/components/ui/unverified";
import { requireActor } from "@/lib/auth-guard";
import { SetupWizard } from "@/components/ui/setup-wizard";
import { buttonClass } from "@/components/ui/form";

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
  const plan = num ? planCampaign(5000, num.messagingLimit) : null;

  const tenant = await prisma.tenantSettings.findUnique({ where: { tenantId: t }, select: { mode: true } });
  const paid = num?.paymentMethod === "payment_method_confirmed";
  const activeTpl = templates.filter((x) => x.status === "ACTIVE").length;
  const assistantOn = configs.some((c) => c.enabled);
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Kanallar" description="WhatsApp ve Instagram DM'i 5 adımda bağlayın." />
      <SetupWizard
        title="Mesaj kanalı kurulumu"
        doneText="Kurulum tamam. Gelen mesajlar Gelen kutusu'na düşüyor."
        steps={[
          {
            key: "numara",
            title: "WhatsApp numaranızı bağlayın",
            done: !!num,
            hint: "Meta ile giriş yapın, işletme numaranızı seçin.",
            content: num ? <p className="text-sm text-fg-muted">Bağlı: {num.displayNumber ?? num.phoneNumberId}</p> : <WhatsAppSignupForm />,
          },
          {
            key: "odeme",
            title: "Ödeme yöntemini ekleyin",
            done: paid,
            hint: "Mesaj ücretini Meta doğrudan sizden alır.",
            content: num?.onboardingStep === "identity_verification" ? <InfoNote>Meta iş doğrulaması istiyor; WhatsApp Manager&apos;da tamamlayın.</InfoNote> : <ConfirmPaymentButton />,
          },
          {
            key: "sablon",
            title: "Bir mesaj şablonu onaylatın",
            done: activeTpl > 0,
            hint: "Meta incelemesi 24 saate kadar sürebilir.",
            content: (
              <div className="flex flex-col gap-3">
                {templates.length ? (
                  <ul className="flex flex-wrap gap-2 text-[12px]">
                    {templates.map((x) => (
                      <li key={x.id} className="rounded-full border border-line px-2 py-0.5">
                        {x.name} · {statusLabel[x.status]}
                      </li>
                    ))}
                  </ul>
                ) : null}
                <TemplateForm />
              </div>
            ),
          },
          {
            key: "asistan",
            title: "Sohbet asistanını açın",
            done: assistantOn,
            hint: "İlk yanıtı asistan verir, gerekirse size aktarır.",
            content: (
              <Link href="/marka/asistanlar" className={buttonClass("primary", "sm")}>
                Asistanları aç →
              </Link>
            ),
          },
          {
            key: "canli",
            title: "Canlıya geçin",
            done: tenant?.mode === "production",
            hint: "KVKK bildirimi tamamlanınca canlı mod açılır.",
            content: (
              <Link href="/marka/uyum" className={buttonClass("primary", "sm")}>
                Uyum adımlarına git →
              </Link>
            ),
          },
        ]}
      />
      {plan ? (
        <p className="text-[13px] text-fg-muted">
          Mevcut kademe ({num!.messagingLimit}/gün): 5.000 kişilik gönderim ≈ {plan.estimatedDays} gün.
        </p>
      ) : null}
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
