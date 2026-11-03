/**
 * Ek modül demo verisi (Kanallar, Agent'lar, Uyum, Reklam, Creative). seed.ts sonunda çağrılır.
 * Yalnız geliştirme/demo; mock sağlayıcılarla çalışır.
 */
import { prisma } from "../src/db";
import { seedConfig } from "../src/config/store";
import { activateAgent, seedAgentTemplates } from "../src/assistant/catalog";
import { ingestText } from "../src/assistant/rag";
import { vault } from "../src/channels/vault";
import { seedModelRegistry } from "../src/creative/registry";
import { topUp } from "../src/creative/credits";
import { signStandardContract, uploadFilingReceipt } from "../src/compliance/kvkk";
import { recordConsent } from "../src/compliance/iys";

const ADDON_TABLES = [
  "config_values", "tenant_settings", "tenant_policy_flags", "whatsapp_numbers", "channel_connections", "webhook_dedupe",
  "raw_webhooks", "messages", "conversations", "contacts", "message_daily_stats", "message_templates", "knowledge_chunks",
  "knowledge_sources", "agent_templates", "agent_config", "influencer_candidates", "consent_events", "consent_evidence_log",
  "consents", "iys_brands", "cross_border_filings", "influencer_tax_profile", "message_cost_ledger", "country_rates",
  "ad_object_mutations", "ad_budget_changes", "partnership_ad_codes", "model_registry", "credit_accounts", "credit_holds",
  "creative_jobs", "generated_assets", "disclosure_checks",
];

const H = 3_600_000;

export async function seedAddon() {
  // TRUNCATE satır tetikleyicilerini (RET / delil append-only) tetiklemez; yalnız geliştirmede.
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${ADDON_TABLES.map((t) => `"${t}"`).join(", ")} CASCADE`);
  await seedConfig();
  await seedAgentTemplates();
  await seedModelRegistry();

  // Ülke oranları — Türkiye DOĞRULANMADI (tek kaynak BSP tarife kartı); Meta'nın kendi kartından okunmalı.
  const eff = new Date("2026-10-01T00:00:00Z");
  const rates: [string, "marketing" | "utility" | "authentication" | "service", number, boolean][] = [
    ["TR", "marketing", 0.0125, false], ["TR", "utility", 0.001, false], ["TR", "authentication", 0.001, false], ["TR", "service", 0.001, false],
    ["DE", "marketing", 0.157, false], ["NL", "marketing", 0.1837, false], ["FR", "marketing", 0.0988, false],
  ];
  await prisma.countryRate.createMany({
    data: rates.map(([countryCode, category, rateUsd, verified]) => ({ countryCode, category, rateUsd, effectiveFrom: eff, source: "BSP tarife kartı (doğrulanmadı)", verified })),
  });

  // Vergi profilleri (mevcut taxStatus → yeni profil). Bir influencer 20/B örneği.
  const infs = await prisma.influencer.findMany({ orderBy: { name: "asc" } });
  for (const [i, inf] of infs.entries()) {
    const status = i === 0 ? "istisna_20b" : inf.taxStatus === "STOPAJLI" || !inf.canIssueInvoice ? "diger" : "kayitli_mukellef";
    await prisma.influencerTaxProfile.create({
      data: {
        influencerId: inf.id,
        status,
        designatedIban: status === "istisna_20b" ? inf.iban.replace(/\s+/g, "").toUpperCase() : null,
        istisnaBelgesiS3Key: status === "istisna_20b" ? `tax/${inf.id}/20b-istisna-belgesi.pdf` : null,
        vatRegistered: inf.taxStatus === "FATURA",
        verifiedAt: new Date(),
        verifiedBy: "seed",
      },
    });
  }

  // Deliverable kullanım hakları (Türkiye'de faturayı değiştirir) — demo için varsayılan.
  await prisma.deliverable.updateMany({ data: { usageRightsDays: 365, usageRightsChannel: "ORGANIK", usageRightsGeo: ["TR"] } });

  const brand = await prisma.brand.findFirstOrThrow({ where: { name: { contains: "Lumi" } } });
  const t = brand.id;
  await prisma.tenantSettings.create({ data: { tenantId: t, mode: "sandbox", prohibitedVerticalAck: true, prohibitedVerticalAt: new Date() } });
  const iysBrand = await prisma.iysBrand.create({ data: { tenantId: t, markaAdi: brand.name, iysIntegratorAccountRef: `iys-demo-${t.slice(-6)}` } });
  void iysBrand;

  // WhatsApp bağlantısı (mock token kasada).
  const tokenRef = await vault().put(t, "whatsapp", "mock-token-demo");
  const conn = await prisma.channelConnection.create({
    data: { tenantId: t, provider: "WHATSAPP", externalIds: { waba_id: "100000000000001", phone_number_id: "200000000000001" }, tokenRef, scopes: ["whatsapp_business_messaging", "whatsapp_business_management"], status: "ACTIVE", connectedAt: new Date(), lastVerifiedAt: new Date() },
  });
  await prisma.whatsAppNumber.create({
    data: { tenantId: t, connectionId: conn.id, wabaId: "100000000000001", phoneNumberId: "200000000000001", displayNumber: "+90 850 000 00 01", paymentMethod: "payment_method_pending", onboardingStep: "payment_method", messagingLimit: "TIER_250", qualityRating: "GREEN" },
  });
  const igRef = await vault().put(t, "instagram", "mock-token-ig");
  await prisma.channelConnection.create({
    data: { tenantId: t, provider: "INSTAGRAM", externalIds: { page_id: "300000000000001", ig_user_id: "17840000000000001", account_type: "BUSINESS" }, tokenRef: igRef, scopes: ["instagram_basic", "instagram_manage_messages", "pages_messaging"], status: "ACTIVE", connectedAt: new Date(), lastVerifiedAt: new Date() },
  });

  await prisma.messageTemplate.createMany({
    data: [
      { tenantId: t, name: "siparis_kargoda", category: "utility", body: "Merhaba {{1}}, {{2}} numaralı siparişiniz kargoya verildi.", status: "ACTIVE", quality: "HIGH" },
      { tenantId: t, name: "bahar_kampanyasi", category: "marketing", body: "{{1}}, bahar koleksiyonunda %20 indirim seni bekliyor!", containsPromotion: true, status: "ACTIVE", quality: "MEDIUM", sendRateFactor: 0.5 },
      { tenantId: t, name: "randevu_hatirlatma", category: "utility", body: "Yarın {{1}} saatindeki randevunuzu hatırlatırız.", status: "PAUSED", quality: "LOW", pauseCount: 1, pausedUntil: new Date(Date.now() + 2 * H), sendRateFactor: 0 },
      { tenantId: t, name: "yeni_urun_duyuru", category: "marketing", body: "Yeni ürünümüzü keşfet: {{1}}", containsPromotion: true, status: "IN_REVIEW" },
    ],
  });

  // Onaylar: ONAY (İYS'ye kayıtlı) ve terminal RET.
  await recordConsent({ tenantId: t, recipient: "+905321112233", channel: "MESAJ", state: "ONAY", source: "web_form", consentedAt: new Date(Date.now() - 5 * 24 * H), aydinlatmaVersion: "2026-08", aydinlatmaText: "Lumi aydınlatma metni v2026-08", ip: "203.0.113.10", device: "web", evidence: "form#123" });
  await recordConsent({ tenantId: t, recipient: "+905339998877", channel: "MESAJ", state: "RET", source: "whatsapp_opt_out", consentedAt: new Date(Date.now() - 2 * 24 * H), aydinlatmaVersion: "opt-out" });

  // Konuşmalar: açık pencere, kapalı pencere, temsilci bekleyen.
  const now = Date.now();
  const mk = async (ext: string, name: string, phone: string, lastInboundAgoH: number, status: "open" | "awaiting_human", fep: boolean, texts: [string, "INBOUND" | "OUTBOUND"][]) => {
    const contact = await prisma.contact.create({ data: { tenantId: t, channel: "WHATSAPP", externalId: ext, phoneE164: phone, name, country: "TR" } });
    const last = new Date(now - lastInboundAgoH * H);
    const conv = await prisma.conversation.create({
      data: { tenantId: t, channel: "WHATSAPP", contactId: contact.id, status, lastInboundAt: last, serviceWindowExpiresAt: new Date(last.getTime() + 24 * H), fepWindowExpiresAt: fep ? new Date(last.getTime() + 7 * 24 * H) : null, agentKey: fep ? "campaign_welcome" : null, aiChargeable: status === "open", handoffReason: status === "awaiting_human" ? "insan_istedi" : null, slaStartedAt: status === "awaiting_human" ? last : null },
    });
    for (const [i, [body, direction]] of texts.entries()) {
      await prisma.message.create({ data: { tenantId: t, conversationId: conv.id, externalId: `wamid.seed.${ext}.${i}`, direction, body, fromAi: direction === "OUTBOUND", createdAt: new Date(last.getTime() + i * 60_000), category: direction === "OUTBOUND" ? "service" : null } });
    }
  };
  await mk("905321112233", "Ayşe K.", "+905321112233", 2, "open", true, [["Merhaba, reklamdaki ruj hâlâ indirimde mi?", "INBOUND"], ["Merhaba! Evet, BAHAR20 koduyla %20 indirimli.", "OUTBOUND"]]);
  await mk("905441234567", "Mehmet T.", "+905441234567", 30, "open", false, [["Kargom nerede?", "INBOUND"], ["Sipariş numaranızı paylaşır mısınız?", "OUTBOUND"]]);
  await mk("905551231231", "Elif D.", "+905551231231", 1, "awaiting_human", false, [["Ürün yüzümde alerji yaptı, bir yetkiliyle görüşmek istiyorum.", "INBOUND"], ["Sizi bir temsilciye aktarıyorum. En kısa sürede size dönüş yapılacak.", "OUTBOUND"]]);

  // Bilgi tabanı + agent'lar
  await activateAgent(t, "brand_faq");
  await activateAgent(t, "creator_prescreen");
  await ingestText(t, {
    type: "manual",
    uri: "manual://sss",
    text: "Kargo: Siparişler 1-3 iş günü içinde kargoya verilir, 500 TL üzeri kargo ücretsizdir. İade: Ürünü teslimden sonra 14 gün içinde ücretsiz iade edebilirsiniz. Mağaza: İstanbul Nişantaşı mağazamız hafta içi 10:00-20:00 açıktır. Stok: Bahar koleksiyonu ruj serisi tüm renklerde stokta.",
  });
  await prisma.influencerCandidate.create({ data: { tenantId: t, source: "inbound_dm", handle: "deniz.makeup", followers: 48000, category: "güzellik", priceExpectation: "15.000 TL", contact: "deniz@example.com", status: "new" } });

  await topUp(t, 500);
  const { dueAt } = await signStandardContract(t, new Date(now - 3 * 24 * H));
  await uploadFilingReceipt(t, "aws_eu_central_1", `kvkk/${t}/aws-bildirim-makbuzu.pdf`);
  void dueAt;

  console.log("seed-addon: tamamlandı");
}
