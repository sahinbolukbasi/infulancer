import { createHmac, randomBytes } from "node:crypto";
import { prisma } from "../src/db";
import { clearConfigCache, seedConfig } from "../src/config/store";
import { seedAgentTemplates } from "../src/assistant/catalog";
import { seedModelRegistry } from "../src/creative/registry";
import { vault } from "../src/channels/vault";
import { mockIys } from "../src/compliance/iys";

const TABLES = [
  "SignupApplication", "Invite",
  "PayoutRequest", "PayoutBatch", "LedgerEntry", "Notification", "AgentRun", "DeliverableStatusChange", "DeliverableReview",
  "MetricSnapshot", "Asset", "Deliverable", "Assignment", "CampaignBrief", "Campaign", "SocialAccountSnapshot", "SocialAccount",
  "User", "Influencer", "Brand",
  "config_values", "tenant_settings", "tenant_policy_flags", "whatsapp_numbers", "channel_connections", "webhook_dedupe",
  "raw_webhooks", "messages", "conversations", "contacts", "message_daily_stats", "message_templates", "knowledge_chunks",
  "knowledge_sources", "agent_templates", "agent_config", "influencer_candidates", "consent_events", "consent_evidence_log",
  "consents", "iys_brands", "cross_border_filings", "influencer_tax_profile", "message_cost_ledger", "country_rates",
  "ad_object_mutations", "ad_budget_changes", "partnership_ad_codes", "model_registry", "credit_accounts", "credit_holds",
  "creative_jobs", "generated_assets", "disclosure_checks", "AgentJobRun",
  "event_tickets", "event_invites", "events", "coupon_grants", "coupons", "campaign_applications", "campaign_open_calls",
  "notification_logs", "notification_templates", "notification_rules", "short_links", "ad_drafts",
];

export async function resetDb() {
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${TABLES.map((t) => `"${t}"`).join(", ")} CASCADE`);
  clearConfigCache();
  mockIys.reset();
  await seedConfig();
  await seedAgentTemplates();
  await seedModelRegistry();
}

let seq = 0;
export async function makeTenant(name = `Marka ${++seq}`) {
  const brand = await prisma.brand.create({
    data: { name, taxOffice: "Test", taxNumber: String(1000000000 + seq), contactName: "Test", contactEmail: `m${seq}@ex.com`, contactPhone: "+900000000000", category: "kozmetik", competitorBrandIds: [] },
  });
  const user = await prisma.user.create({ data: { email: `u${seq}-${randomBytes(3).toString("hex")}@ex.com`, name: `Temsilci ${seq}`, role: "BRAND", brandId: brand.id, passwordHash: "x" } });
  await prisma.tenantSettings.create({ data: { tenantId: brand.id } });
  await prisma.iysBrand.create({ data: { tenantId: brand.id, markaAdi: name, iysIntegratorAccountRef: `iys-${brand.id}` } });
  const tokenRef = await vault().put(brand.id, "whatsapp", "token-ok");
  const phoneNumberId = `pn${brand.id}`;
  const conn = await prisma.channelConnection.create({
    data: { tenantId: brand.id, provider: "WHATSAPP", externalIds: { waba_id: `waba${brand.id}`, phone_number_id: phoneNumberId }, tokenRef, scopes: [], status: "ACTIVE" },
  });
  await prisma.whatsAppNumber.create({ data: { tenantId: brand.id, connectionId: conn.id, wabaId: `waba${brand.id}`, phoneNumberId } });
  return { tenantId: brand.id, brand, user, phoneNumberId, connectionId: conn.id };
}

export async function makeConversation(tenantId: string, opts: { phone?: string; windowOpen?: boolean; channel?: "WHATSAPP" | "INSTAGRAM" } = {}) {
  const phone = opts.phone ?? `+90532${String(1000000 + ++seq).slice(-7)}`;
  const contact = await prisma.contact.create({ data: { tenantId, channel: opts.channel ?? "WHATSAPP", externalId: phone.replace("+", ""), phoneE164: phone } });
  const now = Date.now();
  return prisma.conversation.create({
    data: {
      tenantId,
      channel: opts.channel ?? "WHATSAPP",
      contactId: contact.id,
      serviceWindowExpiresAt: opts.windowOpen === false ? new Date(now - 60_000) : new Date(now + 3_600_000),
      lastInboundAt: new Date(now - 60_000),
    },
    include: { contact: true },
  });
}

export function sign(body: string, secret = "test-app-secret") {
  return `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
}

export function waTextPayload(phoneNumberId: string, from: string, id: string, text: string, ts = Math.floor(Date.now() / 1000)) {
  return JSON.stringify({
    object: "whatsapp_business_account",
    entry: [{ id: "waba", changes: [{ field: "messages", value: { messaging_product: "whatsapp", metadata: { phone_number_id: phoneNumberId }, contacts: [{ wa_id: from, profile: { name: "Test" } }], messages: [{ id, from, timestamp: String(ts), type: "text", text: { body: text } }] } }] }],
  });
}
