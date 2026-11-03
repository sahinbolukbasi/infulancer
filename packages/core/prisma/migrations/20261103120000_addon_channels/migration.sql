-- pgvector (RDS Postgres 16 ve yerel Homebrew/pgvector imajında mevcut)
CREATE EXTENSION IF NOT EXISTS vector;

-- CreateEnum
CREATE TYPE "ChannelProvider" AS ENUM ('WHATSAPP', 'INSTAGRAM', 'MESSENGER', 'TIKTOK', 'META_ADS');

-- CreateEnum
CREATE TYPE "ConnectionStatus" AS ENUM ('PENDING', 'ACTIVE', 'REVOKED', 'ERROR');

-- CreateEnum
CREATE TYPE "PaymentMethodState" AS ENUM ('payment_method_pending', 'payment_method_confirmed');

-- CreateEnum
CREATE TYPE "ConversationStatus" AS ENUM ('open', 'awaiting_human', 'assigned', 'closed');

-- CreateEnum
CREATE TYPE "MessageDirection" AS ENUM ('INBOUND', 'OUTBOUND');

-- CreateEnum
CREATE TYPE "TemplateStatus" AS ENUM ('IN_REVIEW', 'REJECTED', 'ACTIVE', 'PAUSED', 'DISABLED', 'APPEAL_REQUESTED');

-- CreateEnum
CREATE TYPE "TemplateQuality" AS ENUM ('PENDING', 'HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "TemplateCategory" AS ENUM ('marketing', 'utility', 'authentication');

-- CreateEnum
CREATE TYPE "MessageCategory" AS ENUM ('marketing', 'utility', 'authentication', 'service', 'meta_business_agent');

-- CreateEnum
CREATE TYPE "ConsentChannel" AS ENUM ('MESAJ', 'EPOSTA', 'ARAMA');

-- CreateEnum
CREATE TYPE "ConsentState" AS ENUM ('ONAY', 'RET');

-- CreateEnum
CREATE TYPE "TenantMode" AS ENUM ('sandbox', 'production');

-- CreateEnum
CREATE TYPE "TaxProfileStatus" AS ENUM ('istisna_20b', 'kayitli_mukellef', 'diger');

-- CreateEnum
CREATE TYPE "LicenseStatus" AS ENUM ('cleared', 'pending', 'restricted');

-- CreateEnum
CREATE TYPE "ModelStatus" AS ENUM ('active', 'deprecated', 'retired');

-- CreateEnum
CREATE TYPE "CreativeJobStatus" AS ENUM ('HELD', 'IN_QUEUE', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'CANCELLED', 'REJECTED');

-- CreateEnum
CREATE TYPE "OutOfHoursBehavior" AS ENUM ('queue', 'auto_reply_then_queue');

-- AlterTable
ALTER TABLE "Deliverable" ADD COLUMN     "commercialContentToggle" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "frameCount" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "frameTexts" TEXT[],
ADD COLUMN     "hasAudio" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isLive" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "paidPartnershipToggle" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "spokenDisclosure" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "usageRightsChannel" "UsageChannel",
ADD COLUMN     "usageRightsDays" INTEGER,
ADD COLUMN     "usageRightsGeo" TEXT[];

-- CreateTable
CREATE TABLE "config_values" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "note" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "config_values_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "tenant_settings" (
    "tenantId" TEXT NOT NULL,
    "mode" "TenantMode" NOT NULL DEFAULT 'sandbox',
    "messageRetentionDays" INTEGER NOT NULL DEFAULT 90,
    "marketingMaxPriceUsd" DECIMAL(10,5),
    "prohibitedVerticalAck" BOOLEAN NOT NULL DEFAULT false,
    "prohibitedVerticalAt" TIMESTAMP(3),
    "businessVerificationHelp" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_settings_pkey" PRIMARY KEY ("tenantId")
);

-- CreateTable
CREATE TABLE "tenant_policy_flags" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "flag" TEXT NOT NULL,
    "detail" TEXT,
    "blocking" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenant_policy_flags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "channel_connections" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "provider" "ChannelProvider" NOT NULL,
    "external_ids" JSONB NOT NULL,
    "token_ref" TEXT NOT NULL,
    "scopes" TEXT[],
    "status" "ConnectionStatus" NOT NULL DEFAULT 'PENDING',
    "connected_at" TIMESTAMP(3),
    "last_verified_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "channel_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whatsapp_numbers" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "wabaId" TEXT NOT NULL,
    "phoneNumberId" TEXT NOT NULL,
    "displayNumber" TEXT,
    "businessPortfolioId" TEXT,
    "pinCiphertext" TEXT,
    "paymentMethod" "PaymentMethodState" NOT NULL DEFAULT 'payment_method_pending',
    "callingEnabled" BOOLEAN NOT NULL DEFAULT false,
    "messagingLimit" TEXT NOT NULL DEFAULT 'TIER_250',
    "qualityRating" TEXT,
    "throughputLevel" TEXT,
    "onboardingStep" TEXT NOT NULL DEFAULT 'signup',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "whatsapp_numbers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_dedupe" (
    "message_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "ttl" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_dedupe_pkey" PRIMARY KEY ("message_id")
);

-- CreateTable
CREATE TABLE "raw_webhooks" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "s3Key" TEXT NOT NULL,
    "tenantId" TEXT,
    "processedAt" TIMESTAMP(3),
    "error" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "raw_webhooks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contacts" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "channel" "ChannelProvider" NOT NULL,
    "externalId" TEXT NOT NULL,
    "phoneE164" TEXT,
    "email" TEXT,
    "name" TEXT,
    "country" TEXT,
    "isMinor" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversations" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "channel" "ChannelProvider" NOT NULL,
    "contactId" TEXT NOT NULL,
    "status" "ConversationStatus" NOT NULL DEFAULT 'open',
    "assignedUserId" TEXT,
    "tags" TEXT[],
    "service_window_expires_at" TIMESTAMP(3),
    "fep_window_expires_at" TIMESTAMP(3),
    "human_agent_window_expires_at" TIMESTAMP(3),
    "lastInboundAt" TIMESTAMP(3),
    "slaStartedAt" TIMESTAMP(3),
    "agentKey" TEXT,
    "agentTurns" INTEGER NOT NULL DEFAULT 0,
    "aiChargeable" BOOLEAN NOT NULL DEFAULT true,
    "handoffReason" TEXT,
    "windowWarningSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "externalId" TEXT,
    "direction" "MessageDirection" NOT NULL,
    "body" TEXT,
    "templateId" TEXT,
    "category" "MessageCategory",
    "mediaS3Key" TEXT,
    "mediaUrl" TEXT,
    "status" TEXT,
    "statusAt" TIMESTAMP(3),
    "fromAi" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message_daily_stats" (
    "tenantId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "channel" "ChannelProvider" NOT NULL,
    "direction" "MessageDirection" NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "message_daily_stats_pkey" PRIMARY KEY ("tenantId","day","channel","direction")
);

-- CreateTable
CREATE TABLE "message_templates" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'tr',
    "category" "TemplateCategory" NOT NULL,
    "body" TEXT NOT NULL,
    "containsPromotion" BOOLEAN NOT NULL DEFAULT false,
    "status" "TemplateStatus" NOT NULL DEFAULT 'IN_REVIEW',
    "quality" "TemplateQuality" NOT NULL DEFAULT 'PENDING',
    "pauseCount" INTEGER NOT NULL DEFAULT 0,
    "pausedUntil" TIMESTAMP(3),
    "sendRateFactor" DECIMAL(4,2) NOT NULL DEFAULT 1,
    "readRate" DECIMAL(5,4),
    "blockRate" DECIMAL(5,4),
    "negativeFeedbackRate" DECIMAL(5,4),
    "externalId" TEXT,
    "statusUpdatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "message_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_sources" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "uri" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "messageId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "knowledge_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_chunks" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "embedding" vector(256),
    "messageId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "knowledge_chunks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_templates" (
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "systemPrompt" TEXT NOT NULL,
    "tools" TEXT[],
    "defaultKeywords" TEXT[],

    CONSTRAINT "agent_templates_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "agent_config" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "systemPrompt" TEXT NOT NULL,
    "confidence_threshold" DECIMAL(3,2) NOT NULL DEFAULT 0.70,
    "max_turns_before_handoff" INTEGER NOT NULL DEFAULT 4,
    "handoff_keywords" TEXT[] DEFAULT ARRAY['insan', 'temsilci', 'müşteri hizmetleri', 'yetkili', 'şikayet']::TEXT[],
    "business_hours" JSONB,
    "out_of_hours_behavior" "OutOfHoursBehavior" NOT NULL DEFAULT 'queue',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "influencer_candidates" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'inbound_dm',
    "conversationId" TEXT,
    "handle" TEXT,
    "followers" INTEGER,
    "category" TEXT,
    "priceExpectation" TEXT,
    "mediaKitUrl" TEXT,
    "contact" TEXT,
    "status" TEXT NOT NULL DEFAULT 'new',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "influencer_candidates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "iys_brands" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "marka_adi" TEXT NOT NULL,
    "iys_integrator_account_ref" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "iys_brands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consents" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "channel" "ConsentChannel" NOT NULL,
    "state" "ConsentState" NOT NULL,
    "source" TEXT NOT NULL,
    "source_detail" TEXT,
    "consented_at" TIMESTAMP(3) NOT NULL,
    "iys_transaction_id" TEXT,
    "aydinlatma_version" TEXT NOT NULL,
    "aydinlatmaText" TEXT,
    "ip" TEXT,
    "device" TEXT,
    "evidence" TEXT,
    "registered_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consent_events" (
    "id" TEXT NOT NULL,
    "consentId" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "due_at" TIMESTAMP(3) NOT NULL,
    "processed_at" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consent_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consent_evidence_log" (
    "id" BIGSERIAL NOT NULL,
    "tenantId" TEXT NOT NULL,
    "consentId" TEXT NOT NULL,
    "state" "ConsentState" NOT NULL,
    "snapshot" JSONB NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consent_evidence_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cross_border_filings" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "transferTarget" TEXT NOT NULL,
    "contractSignedAt" TIMESTAMP(3) NOT NULL,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "remindedAt" TIMESTAMP(3),
    "receiptS3Key" TEXT,
    "receiptUploadedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cross_border_filings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "influencer_tax_profile" (
    "influencer_id" TEXT NOT NULL,
    "status" "TaxProfileStatus" NOT NULL DEFAULT 'diger',
    "istisna_belgesi_s3_key" TEXT,
    "designated_iban" TEXT,
    "vat_registered" BOOLEAN NOT NULL DEFAULT false,
    "advisorOpinionS3Key" TEXT,
    "adminUnlockedAt" TIMESTAMP(3),
    "adminUnlockedById" TEXT,
    "verified_at" TIMESTAMP(3),
    "verified_by" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "influencer_tax_profile_pkey" PRIMARY KEY ("influencer_id")
);

-- CreateTable
CREATE TABLE "message_cost_ledger" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "phone_number_id" TEXT NOT NULL,
    "message_id" TEXT NOT NULL,
    "category" "MessageCategory" NOT NULL,
    "recipient_country" TEXT NOT NULL,
    "meta_rate_usd" DECIMAL(10,5) NOT NULL,
    "platform_markup_usd" DECIMAL(10,5) NOT NULL,
    "free_tier_consumed" BOOLEAN NOT NULL,
    "inFepWindow" BOOLEAN NOT NULL DEFAULT false,
    "billed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_cost_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "country_rates" (
    "country_code" TEXT NOT NULL,
    "category" "MessageCategory" NOT NULL,
    "rate_usd" DECIMAL(10,5) NOT NULL,
    "effective_from" TIMESTAMP(3) NOT NULL,
    "source" TEXT NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "country_rates_pkey" PRIMARY KEY ("country_code","category","effective_from")
);

-- CreateTable
CREATE TABLE "ad_object_mutations" (
    "objectId" TEXT NOT NULL,
    "objectType" TEXT NOT NULL,
    "last_mutation_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ad_object_mutations_pkey" PRIMARY KEY ("objectId")
);

-- CreateTable
CREATE TABLE "ad_budget_changes" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "adSetId" TEXT NOT NULL,
    "newBudgetMinor" INTEGER NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "appliedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'queued',
    "reason" TEXT,

    CONSTRAINT "ad_budget_changes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partnership_ad_codes" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "influencerId" TEXT NOT NULL,
    "igMediaId" TEXT NOT NULL,
    "adCode" TEXT,
    "state" TEXT NOT NULL DEFAULT 'requested',
    "lastVerifiedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "partnership_ad_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "model_registry" (
    "key" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "unit_price_usd" DECIMAL(12,6) NOT NULL,
    "credits_per_unit" DECIMAL(10,3) NOT NULL,
    "deterministic" BOOLEAN NOT NULL DEFAULT true,
    "maxUnits" INTEGER,
    "status" "ModelStatus" NOT NULL DEFAULT 'active',
    "deprecated_at" TIMESTAMP(3),
    "replacement_key" TEXT,
    "license_status" "LicenseStatus" NOT NULL DEFAULT 'pending',
    "emits_c2pa" BOOLEAN,
    "featureFlag" TEXT,
    "priceVerified" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "model_registry_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "credit_accounts" (
    "tenantId" TEXT NOT NULL,
    "balanceCredits" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "heldCredits" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "lowBalanceAlert" DECIMAL(14,3) NOT NULL DEFAULT 100,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "credit_accounts_pkey" PRIMARY KEY ("tenantId")
);

-- CreateTable
CREATE TABLE "credit_holds" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "credits" DECIMAL(14,3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'held',
    "settledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credit_holds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "creative_jobs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "campaignId" TEXT,
    "modelKey" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "promptHash" TEXT NOT NULL,
    "units" DECIMAL(10,3) NOT NULL,
    "requestId" TEXT,
    "creditHoldId" TEXT,
    "status" "CreativeJobStatus" NOT NULL DEFAULT 'HELD',
    "rejectReason" TEXT,
    "inferenceMs" INTEGER,
    "submittedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "creative_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "generated_assets" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "campaign_id" TEXT,
    "jobId" TEXT,
    "model_key" TEXT NOT NULL,
    "model_id" TEXT NOT NULL,
    "prompt_hash" TEXT NOT NULL,
    "parent_asset_id" TEXT,
    "s3Key" TEXT NOT NULL,
    "c2pa_manifest_id" TEXT NOT NULL,
    "is_ai_generated" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "generated_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "disclosure_checks" (
    "id" TEXT NOT NULL,
    "deliverableId" TEXT NOT NULL,
    "frameIndex" INTEGER NOT NULL DEFAULT 0,
    "platform" "Platform" NOT NULL,
    "compliant" BOOLEAN NOT NULL,
    "issues" TEXT[],
    "evidenceS3Key" TEXT,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "disclosure_checks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenant_policy_flags_tenantId_flag_key" ON "tenant_policy_flags"("tenantId", "flag");

-- CreateIndex
CREATE INDEX "channel_connections_tenantId_idx" ON "channel_connections"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_numbers_tenantId_key" ON "whatsapp_numbers"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_numbers_phoneNumberId_key" ON "whatsapp_numbers"("phoneNumberId");

-- CreateIndex
CREATE INDEX "webhook_dedupe_ttl_idx" ON "webhook_dedupe"("ttl");

-- CreateIndex
CREATE INDEX "raw_webhooks_processedAt_idx" ON "raw_webhooks"("processedAt");

-- CreateIndex
CREATE UNIQUE INDEX "contacts_tenantId_channel_externalId_key" ON "contacts"("tenantId", "channel", "externalId");

-- CreateIndex
CREATE INDEX "conversations_tenantId_status_idx" ON "conversations"("tenantId", "status");

-- CreateIndex
CREATE INDEX "messages_conversationId_createdAt_idx" ON "messages"("conversationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "messages_tenantId_externalId_key" ON "messages"("tenantId", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "message_templates_tenantId_name_language_key" ON "message_templates"("tenantId", "name", "language");

-- CreateIndex
CREATE INDEX "knowledge_sources_tenantId_idx" ON "knowledge_sources"("tenantId");

-- CreateIndex
CREATE INDEX "knowledge_chunks_tenantId_idx" ON "knowledge_chunks"("tenantId");

-- CreateIndex
CREATE INDEX "knowledge_chunks_messageId_idx" ON "knowledge_chunks"("messageId");

-- CreateIndex
CREATE UNIQUE INDEX "agent_config_tenantId_agentId_key" ON "agent_config"("tenantId", "agentId");

-- CreateIndex
CREATE INDEX "influencer_candidates_tenantId_idx" ON "influencer_candidates"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "iys_brands_tenantId_key" ON "iys_brands"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "consents_recipient_channel_brandId_key" ON "consents"("recipient", "channel", "brandId");

-- CreateIndex
CREATE INDEX "consent_events_processed_at_due_at_idx" ON "consent_events"("processed_at", "due_at");

-- CreateIndex
CREATE INDEX "consent_evidence_log_tenantId_at_idx" ON "consent_evidence_log"("tenantId", "at");

-- CreateIndex
CREATE UNIQUE INDEX "cross_border_filings_tenantId_transferTarget_key" ON "cross_border_filings"("tenantId", "transferTarget");

-- CreateIndex
CREATE INDEX "message_cost_ledger_phone_number_id_billed_at_idx" ON "message_cost_ledger"("phone_number_id", "billed_at");

-- CreateIndex
CREATE UNIQUE INDEX "message_cost_ledger_tenantId_message_id_key" ON "message_cost_ledger"("tenantId", "message_id");

-- CreateIndex
CREATE INDEX "ad_budget_changes_adSetId_appliedAt_idx" ON "ad_budget_changes"("adSetId", "appliedAt");

-- CreateIndex
CREATE UNIQUE INDEX "partnership_ad_codes_tenantId_igMediaId_key" ON "partnership_ad_codes"("tenantId", "igMediaId");

-- CreateIndex
CREATE UNIQUE INDEX "creative_jobs_requestId_key" ON "creative_jobs"("requestId");

-- CreateIndex
CREATE INDEX "creative_jobs_tenantId_idx" ON "creative_jobs"("tenantId");

-- CreateIndex
CREATE INDEX "generated_assets_tenantId_idx" ON "generated_assets"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "disclosure_checks_deliverableId_frameIndex_key" ON "disclosure_checks"("deliverableId", "frameIndex");

-- AddForeignKey
ALTER TABLE "tenant_settings" ADD CONSTRAINT "tenant_settings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_numbers" ADD CONSTRAINT "whatsapp_numbers_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "channel_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_chunks" ADD CONSTRAINT "knowledge_chunks_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "knowledge_sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consents" ADD CONSTRAINT "consents_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "iys_brands"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consent_events" ADD CONSTRAINT "consent_events_consentId_fkey" FOREIGN KEY ("consentId") REFERENCES "consents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "influencer_tax_profile" ADD CONSTRAINT "influencer_tax_profile_influencer_id_fkey" FOREIGN KEY ("influencer_id") REFERENCES "Influencer"("id") ON DELETE CASCADE ON UPDATE CASCADE;



-- ───────────── Tenant izolasyonu (RLS) ─────────────
-- Tenant kapsamlı okuma/yazma, sahibi olmayan infulancer_tenant rolüyle yapılır
-- (src/tenancy.ts withTenant: SET LOCAL ROLE + set_config('app.tenant_id')).
-- Tablo sahibi rol RLS'i bypass eder; bu yüzden kapsamlı sorgular ayrıca WHERE tenantId içerir.
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'infulancer_tenant') THEN
    CREATE ROLE infulancer_tenant NOLOGIN NOSUPERUSER NOBYPASSRLS;
  END IF;
END $$;
GRANT infulancer_tenant TO CURRENT_USER;
GRANT USAGE ON SCHEMA public TO infulancer_tenant;
GRANT SELECT, INSERT, UPDATE, DELETE ON "channel_connections", "whatsapp_numbers", "contacts", "conversations", "messages", "knowledge_sources", "knowledge_chunks", "message_templates", "consents", "agent_config", "message_cost_ledger", "generated_assets", "creative_jobs" TO infulancer_tenant;

ALTER TABLE "channel_connections" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "channel_connections_tenant_isolation" ON "channel_connections"
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
ALTER TABLE "whatsapp_numbers" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "whatsapp_numbers_tenant_isolation" ON "whatsapp_numbers"
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
ALTER TABLE "contacts" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "contacts_tenant_isolation" ON "contacts"
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
ALTER TABLE "conversations" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "conversations_tenant_isolation" ON "conversations"
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
ALTER TABLE "messages" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "messages_tenant_isolation" ON "messages"
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
ALTER TABLE "knowledge_sources" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "knowledge_sources_tenant_isolation" ON "knowledge_sources"
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
ALTER TABLE "knowledge_chunks" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "knowledge_chunks_tenant_isolation" ON "knowledge_chunks"
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
ALTER TABLE "message_templates" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "message_templates_tenant_isolation" ON "message_templates"
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
ALTER TABLE "consents" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "consents_tenant_isolation" ON "consents"
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
ALTER TABLE "agent_config" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "agent_config_tenant_isolation" ON "agent_config"
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
ALTER TABLE "message_cost_ledger" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "message_cost_ledger_tenant_isolation" ON "message_cost_ledger"
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
ALTER TABLE "generated_assets" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "generated_assets_tenant_isolation" ON "generated_assets"
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
ALTER TABLE "creative_jobs" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "creative_jobs_tenant_isolation" ON "creative_jobs"
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));

-- Vektör araması için indeks (cosine).
CREATE INDEX IF NOT EXISTS "knowledge_chunks_embedding_idx" ON "knowledge_chunks" USING hnsw ("embedding" vector_cosine_ops);

-- ───────────── İYS: RET terminal ─────────────
-- RET kaydı silinemez; yalnız yeni, daha geç tarihli ve delilli bir ONAY onu kaldırır.
-- CSV import kaynağı bir RET'i asla değiştiremez.
CREATE OR REPLACE FUNCTION infulancer_consent_guard() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'İYS onay kayıtları silinemez' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF OLD.state = 'RET' THEN
    IF NEW.state = 'RET' THEN
      -- RET → RET: yalnız İYS kayıt alanları güncellenebilir
      IF NEW.recipient <> OLD.recipient OR NEW.channel <> OLD.channel OR NEW."brandId" <> OLD."brandId"
         OR NEW.consented_at <> OLD.consented_at THEN
        RAISE EXCEPTION 'RET kaydı değiştirilemez' USING ERRCODE = 'insufficient_privilege';
      END IF;
    ELSE
      IF NEW.source = 'csv_import' OR NEW.evidence IS NULL OR NEW.consented_at <= OLD.consented_at THEN
        RAISE EXCEPTION 'RET terminaldir: yalnız yeni, tarihli ve delilli bir ONAY kaldırabilir'
          USING ERRCODE = 'insufficient_privilege';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "consents_guard"
  BEFORE UPDATE OR DELETE ON "consents"
  FOR EACH ROW EXECUTE FUNCTION infulancer_consent_guard();

-- Delil deposu ve onay olayları append-only (10 yıl saklama).
CREATE TRIGGER "consent_evidence_log_immutable"
  BEFORE UPDATE OR DELETE ON "consent_evidence_log"
  FOR EACH ROW EXECUTE FUNCTION infulancer_forbid_mutation();

-- ───────────── Vergi: 20/B istisnası ─────────────
-- istisna_20b statüsündeki influencer'a designated_iban dışındaki bir hesaba ödeme talebi oluşturulamaz.
CREATE OR REPLACE FUNCTION infulancer_payout_iban_guard() RETURNS trigger AS $$
DECLARE prof RECORD;
BEGIN
  SELECT status, designated_iban INTO prof FROM influencer_tax_profile WHERE influencer_id = NEW."influencerId";
  IF FOUND AND prof.status = 'istisna_20b' THEN
    IF prof.designated_iban IS NULL OR replace(upper(NEW."ibanSnapshot"), ' ', '') <> replace(upper(prof.designated_iban), ' ', '') THEN
      RAISE EXCEPTION '20/B istisnası: ödeme yalnız belirlenmiş IBAN''a yapılabilir' USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "payout_iban_guard"
  BEFORE INSERT OR UPDATE ON "PayoutRequest"
  FOR EACH ROW EXECUTE FUNCTION infulancer_payout_iban_guard();
