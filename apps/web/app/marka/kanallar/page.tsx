import { getTT } from "@/lib/i18n/tt-server";
import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@infulancer/core/db";
import { statusLabel } from "@infulancer/core/messaging/templates";
import { planCampaign } from "@infulancer/core/messaging/tiers";
import { BrandAssistants } from "@/components/channels/brand-assistants";
import { BrandBadge } from "@/components/icons/brand-logos";
import { ConfirmPaymentButton, InstagramConnectForm, TemplateForm, WhatsAppSignupForm } from "@/components/inbox/inbox-forms";
import { Card, CardTitle } from "@/components/ui/card";
import { buttonClass } from "@/components/ui/form";
import { PageHeader } from "@/components/ui/layout";
import { SetupWizard } from "@/components/ui/setup-wizard";
import { Tabs } from "@/components/ui/tabs";
import { InfoNote } from "@/components/ui/unverified";
import { requireActor } from "@/lib/auth-guard";
import { cn } from "@/lib/cn";
export const metadata: Metadata = { title: "Kanallar ve asistan" };
export const dynamic = "force-dynamic";

/** WhatsApp ve Instagram DM kurulumu + bu kanallarda çalışan sohbet asistanları tek sayfada. */
export default async function BrandChannelsPage({ searchParams }: { searchParams: Promise<{ sekme?: string }> }) {
  const tt = await getTT();
  const actor = await requireActor("BRAND");
  const { sekme } = await searchParams;
  const t = actor.brandId!;
  const [num, ig, templates, configs, candidates, tenant] = await Promise.all([
    prisma.whatsAppNumber.findUnique({ where: { tenantId: t } }),
    prisma.channelConnection.findFirst({ where: { tenantId: t, provider: "INSTAGRAM" }, orderBy: { createdAt: "desc" } }),
    prisma.messageTemplate.findMany({ where: { tenantId: t }, orderBy: { name: "asc" } }),
    prisma.agentConfig.findMany({ where: { tenantId: t } }),
    prisma.influencerCandidate.findMany({ where: { tenantId: t }, orderBy: { createdAt: "desc" }, take: 20 }),
    prisma.tenantSettings.findUnique({ where: { tenantId: t }, select: { mode: true } }),
  ]);
  const paid = num?.paymentMethod === "payment_method_confirmed";
  const activeTpl = templates.filter((x) => x.status === "ACTIVE").length;
  const assistantOn = configs.some((c) => c.enabled);
  const live = tenant?.mode === "production";
  const igOk = ig?.status === "ACTIVE";
  const plan = num ? planCampaign(5000, num.messagingLimit) : null;
  const goAssistant = (
    <Link href="/marka/kanallar?sekme=asistan" className={buttonClass("primary", "sm")}>{tt("Asistanı aç →")}</Link>
  );
  const goLive = (
    <Link href="/marka/uyum" className={buttonClass("primary", "sm")}>{tt("Uyum adımlarına git →")}</Link>
  );

  const overview = [
    { logo: "whatsapp" as const, title: "WhatsApp", ok: !!num && paid, text: num ? (paid ? `Bağlı · ${num.displayNumber ?? num.phoneNumberId}` : "Ödeme yöntemi bekleniyor") : "Bağlı değil", tab: "whatsapp" },
    { logo: "instagram" as const, title: "Instagram DM", ok: igOk, text: igOk ? "Bağlı" : ig?.status === "REVOKED" ? "Erişim iptal edildi" : "Bağlı değil", tab: "instagram" },
    { logo: "meta" as const, title: "Sohbet asistanı", ok: assistantOn, text: assistantOn ? `${configs.filter((c) => c.enabled).length} asistan açık` : "Kapalı", tab: "asistan" },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={tt("Kanallar ve asistan")} description={tt("WhatsApp ve Instagram'ı bağlayın; asistan iki kanalda da ilk cevabı versin.")} />
      <ul className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {overview.map((o) => (
          <li key={o.title}>
            <Link href={`/marka/kanallar?sekme=${o.tab}`} className={cn("flex items-center gap-3 rounded-3xl border bg-glass p-4 transition-standard hover:border-line-strong", o.ok ? "border-neon-lime/40" : "border-line")}>
              <BrandBadge name={o.logo} size={40} />
              <span className="flex flex-col">
                <span className="font-medium">{o.title}</span>
                <span className={cn("text-[12px]", o.ok ? "text-neon-lime" : "text-fg-muted")}>{o.ok ? "✓ " : ""}{o.text}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {!live ? <InfoNote>{tt("Hesabınız deneme modunda: mesajlar gerçek alıcılara gitmez. KVKK adımları tamamlanınca canlıya geçin.")}</InfoNote> : null}
      <Tabs
        key={sekme ?? "whatsapp"}
        label={tt("Kanal bölümleri")}
        defaultTab={sekme}
        tabs={[
          {
            id: "whatsapp",
            label: "WhatsApp",
            content: (
              <div className="flex flex-col gap-4">
                <SetupWizard
                  title={tt("WhatsApp kurulumu")}
                  doneText="WhatsApp hazır. Mesajlar Gelen kutusu'na düşüyor."
                  steps={[
                    { key: "numara", title: "Numaranızı bağlayın", done: !!num, hint: "Meta ile giriş yapın, işletme numaranızı seçin.", content: num ? <p className="text-sm text-fg-muted">{tt("Bağlı:")}{" "}{num.displayNumber ?? num.phoneNumberId}</p> : <WhatsAppSignupForm /> },
                    { key: "odeme", title: "Ödeme yöntemini ekleyin", done: paid, hint: "Mesaj ücretini Meta doğrudan sizden alır.", content: num?.onboardingStep === "identity_verification" ? <InfoNote>{tt("Meta iş doğrulaması istiyor; WhatsApp Manager'da tamamlayın.")}</InfoNote> : <ConfirmPaymentButton /> },
                    {
                      key: "sablon",
                      title: "Bir mesaj şablonu onaylatın",
                      done: activeTpl > 0,
                      hint: "24 saati geçen konuşmalara yalnız onaylı şablonla yazılır.",
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
                    { key: "asistan", title: "Asistanı WhatsApp'ta açın", done: assistantOn, hint: "İlk yanıtı asistan verir, gerekirse size aktarır.", content: goAssistant },
                    { key: "canli", title: "Canlıya geçin", done: live, hint: "KVKK bildirimi tamamlanınca açılır.", content: goLive },
                  ]}
                />
                {plan ? <p className="text-[13px] text-fg-muted">{tt("Günlük kademe")}{" "}{num!.messagingLimit}{tt(": 5.000 kişilik gönderim ≈")}{" "}{plan.estimatedDays}{" "}{tt("gün.")}</p> : null}
              </div>
            ),
          },
          {
            id: "instagram",
            label: "Instagram",
            content: (
              <SetupWizard
                title={tt("Instagram DM kurulumu")}
                doneText="Instagram hazır. DM'ler Gelen kutusu'na düşüyor."
                steps={[
                  { key: "pro", title: "Hesabı Professional yapın", done: igOk, hint: "Instagram ayarlarından Business veya Creator hesaba geçin ve bir Facebook Sayfasına bağlayın." },
                  { key: "bagla", title: "Instagram'ı bağlayın", done: igOk, hint: "Meta ile giriş yapıp mesaj izni verin.", content: igOk ? <p className="text-sm text-fg-muted">{tt("Bağlı.")}</p> : <InstagramConnectForm /> },
                  { key: "asistan", title: "Asistanı Instagram'da açın", done: igOk && assistantOn, hint: "Aynı asistan iki kanalda da çalışır.", content: goAssistant },
                  { key: "canli", title: "Canlıya geçin", done: live, content: goLive },
                ]}
              />
            ),
          },
          { id: "asistan", label: "Asistan", content: <BrandAssistants tenantId={t} /> },
          {
            id: "basvurular",
            label: `DM başvuruları (${candidates.length})`,
            content: (
              <Card interactive={false} className="flex flex-col gap-3">
                <CardTitle>{tt("DM'den gelen içerik üreticisi başvuruları")}</CardTitle>
                {candidates.length === 0 ? (
                  <p className="text-sm text-fg-passive">{tt("Henüz başvuru yok.")}</p>
                ) : (
                  <ul className="flex flex-col divide-y divide-line text-sm">
                    {candidates.map((c) => (
                      <li key={c.id} className="flex flex-col py-2">
                        <span>
                          @{c.handle ?? "?"} · {c.category ?? tt("kategori yok")}
                        </span>
                        <span className="text-[13px] text-fg-muted">
                          {c.followers ? `${c.followers.toLocaleString("tr-TR")} takipçi` : tt("takipçi bilinmiyor")} · {c.priceExpectation ?? tt("fiyat yok")} · {c.contact ?? tt("iletişim yok")}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            ),
          },
        ]}
      />
    </div>
  );
}
