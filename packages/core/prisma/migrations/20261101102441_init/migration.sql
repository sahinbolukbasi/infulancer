-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'BRAND', 'INFLUENCER');

-- CreateEnum
CREATE TYPE "TaxStatus" AS ENUM ('FATURA', 'SERBEST_MESLEK_MAKBUZU', 'STOPAJLI');

-- CreateEnum
CREATE TYPE "Platform" AS ENUM ('INSTAGRAM', 'TIKTOK', 'YOUTUBE');

-- CreateEnum
CREATE TYPE "ContentType" AS ENUM ('REELS', 'STORY', 'CAROUSEL', 'FEED', 'LIVE', 'VIDEO', 'PHOTO', 'SHORTS', 'COMMUNITY');

-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('TASLAK', 'AKTIF', 'KAPANDI', 'IPTAL');

-- CreateEnum
CREATE TYPE "ContractStatus" AS ENUM ('TEKLIF', 'KABUL', 'RED');

-- CreateEnum
CREATE TYPE "DeliverableStatus" AS ENUM ('TASLAK', 'ATANDI', 'BRIEF_GONDERILDI', 'ICERIK_YUKLENDI', 'REVIZYON', 'ONAYLANDI', 'YAYINLANDI', 'METRIK_BEKLIYOR', 'TAMAMLANDI', 'IPTAL');

-- CreateEnum
CREATE TYPE "ReviewDecision" AS ENUM ('ONAY', 'REVIZYON');

-- CreateEnum
CREATE TYPE "AssetKind" AS ENUM ('BRIEF_PDF', 'MARKA_LOGO', 'MARKA_FONT', 'ORNEK_CEKIM', 'URUN_FOTO', 'ONAYLI_CAPTION', 'TASLAK', 'HAM_DOSYA', 'METRIK_SS', 'DIGER');

-- CreateEnum
CREATE TYPE "AssetDirection" AS ENUM ('AJANS_TO_INFLUENCER', 'INFLUENCER_TO_AJANS');

-- CreateEnum
CREATE TYPE "UsageChannel" AS ENUM ('ORGANIK', 'PAID_DAHIL');

-- CreateEnum
CREATE TYPE "UploadStatus" AS ENUM ('BEKLIYOR', 'TAMAM');

-- CreateEnum
CREATE TYPE "MetricStage" AS ENUM ('H24', 'D7', 'D30', 'ARA');

-- CreateEnum
CREATE TYPE "MetricSource" AS ENUM ('MANUEL', 'EKRAN_GORUNTUSU', 'API', 'MARKA');

-- CreateEnum
CREATE TYPE "AgentCheck" AS ENUM ('BRIEF_UYUM', 'YAYIN_KONTROL', 'SILINME_KONTROL', 'METRIK_TUTARLILIK', 'SAHTE_ETKILESIM', 'HEDEF_PROJEKSIYON', 'KAMPANYA_OZETI', 'INFLUENCER_ONERI', 'MARKA_CAKISMASI', 'STORY_HATIRLATMA');

-- CreateEnum
CREATE TYPE "Severity" AS ENUM ('BILGI', 'UYARI', 'KRITIK');

-- CreateEnum
CREATE TYPE "AgentRunStatus" AS ENUM ('ACIK', 'ONAYLANDI', 'EZILDI');

-- CreateEnum
CREATE TYPE "LedgerAccount" AS ENUM ('INFLUENCER_PAYABLE', 'AGENCY_EXPENSE', 'AGENCY_BANK');

-- CreateEnum
CREATE TYPE "LedgerDirection" AS ENUM ('DEBIT', 'CREDIT');

-- CreateEnum
CREATE TYPE "LedgerReason" AS ENUM ('HAKEDIS', 'ODEME', 'DUZELTME');

-- CreateEnum
CREATE TYPE "PayoutStatus" AS ENUM ('TALEP_EDILDI', 'ONAYLANDI', 'ODEME_LISTESINDE', 'GONDERILDI', 'REDDEDILDI');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "brandId" TEXT,
    "influencerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Brand" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "taxOffice" TEXT NOT NULL,
    "taxNumber" TEXT NOT NULL,
    "contactName" TEXT NOT NULL,
    "contactEmail" TEXT NOT NULL,
    "contactPhone" TEXT NOT NULL,
    "contractRef" TEXT,
    "contractStartsAt" TIMESTAMP(3),
    "category" TEXT NOT NULL,
    "competitorBrandIds" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Brand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Influencer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "iban" TEXT NOT NULL,
    "ibanHolder" TEXT NOT NULL,
    "taxStatus" "TaxStatus" NOT NULL,
    "canIssueInvoice" BOOLEAN NOT NULL,
    "audienceTimezone" TEXT NOT NULL DEFAULT 'Europe/Istanbul',
    "riskScore" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Influencer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SocialAccount" (
    "id" TEXT NOT NULL,
    "influencerId" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "handle" TEXT NOT NULL,
    "followers" INTEGER NOT NULL,
    "engagementRate" DECIMAL(6,4) NOT NULL,
    "demographics" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SocialAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SocialAccountSnapshot" (
    "id" TEXT NOT NULL,
    "socialAccountId" TEXT NOT NULL,
    "followers" INTEGER NOT NULL,
    "engagementRate" DECIMAL(6,4) NOT NULL,
    "demographics" JSONB NOT NULL,
    "takenAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SocialAccountSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "budgetKurus" INTEGER NOT NULL,
    "brandTotalFeeKurus" INTEGER NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "targets" JSONB NOT NULL,
    "status" "CampaignStatus" NOT NULL DEFAULT 'TASLAK',
    "closedAt" TIMESTAMP(3),
    "brandPaymentReceivedAt" TIMESTAMP(3),
    "reportSummary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignBrief" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "dos" TEXT[],
    "donts" TEXT[],
    "hashtags" TEXT[],
    "mentions" TEXT[],
    "requiredPhrases" TEXT[],
    "bannedPhrases" TEXT[],
    "disclosureRequired" BOOLEAN NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CampaignBrief_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Assignment" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "influencerId" TEXT NOT NULL,
    "feeKurus" INTEGER NOT NULL,
    "commissionKurus" INTEGER NOT NULL,
    "contractStatus" "ContractStatus" NOT NULL DEFAULT 'TEKLIF',
    "exclusivityDays" INTEGER NOT NULL DEFAULT 0,
    "exclusivityCategory" TEXT,
    "couponCode" TEXT,
    "conflictOverrideReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Assignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Deliverable" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "contentType" "ContentType" NOT NULL,
    "plannedAt" TIMESTAMP(3) NOT NULL,
    "approvalDeadline" TIMESTAMP(3) NOT NULL,
    "status" "DeliverableStatus" NOT NULL DEFAULT 'TASLAK',
    "postUrl" TEXT,
    "publishedAt" TIMESTAMP(3),
    "caption" TEXT,
    "hashtags" TEXT[],
    "mentions" TEXT[],
    "link" TEXT,
    "disclosureRequired" BOOLEAN NOT NULL,
    "contractViolation" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Deliverable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliverableStatusChange" (
    "id" TEXT NOT NULL,
    "deliverableId" TEXT NOT NULL,
    "from" "DeliverableStatus",
    "to" "DeliverableStatus" NOT NULL,
    "byUserId" TEXT,
    "note" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeliverableStatusChange_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliverableReview" (
    "id" TEXT NOT NULL,
    "deliverableId" TEXT NOT NULL,
    "brandUserId" TEXT NOT NULL,
    "decision" "ReviewDecision" NOT NULL,
    "note" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeliverableReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL,
    "deliverableId" TEXT,
    "campaignId" TEXT,
    "key" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "kind" "AssetKind" NOT NULL,
    "direction" "AssetDirection" NOT NULL,
    "usageDurationDays" INTEGER,
    "usageEndsAt" TIMESTAMP(3),
    "usageChannel" "UsageChannel",
    "usageGeography" TEXT[],
    "uploadedById" TEXT NOT NULL,
    "uploadStatus" "UploadStatus" NOT NULL DEFAULT 'BEKLIYOR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MetricSnapshot" (
    "id" TEXT NOT NULL,
    "deliverableId" TEXT NOT NULL,
    "stage" "MetricStage" NOT NULL,
    "source" "MetricSource" NOT NULL,
    "measuredAt" TIMESTAMP(3) NOT NULL,
    "reach" INTEGER,
    "impressions" INTEGER,
    "likes" INTEGER,
    "comments" INTEGER,
    "saves" INTEGER,
    "shares" INTEGER,
    "clicks" INTEGER,
    "sales" INTEGER,
    "revenueKurus" INTEGER,
    "platformMetrics" JSONB NOT NULL,
    "screenshotAssetId" TEXT,
    "enteredById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MetricSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentRun" (
    "id" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "checkType" "AgentCheck" NOT NULL,
    "findings" JSONB NOT NULL,
    "summary" TEXT NOT NULL,
    "severity" "Severity" NOT NULL,
    "status" "AgentRunStatus" NOT NULL DEFAULT 'ACIK',
    "model" TEXT NOT NULL,
    "promptVersion" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "resolvedById" TEXT,
    "resolutionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "AgentRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LedgerEntry" (
    "id" TEXT NOT NULL,
    "txId" TEXT NOT NULL,
    "account" "LedgerAccount" NOT NULL,
    "influencerId" TEXT,
    "amountKurus" INTEGER NOT NULL,
    "direction" "LedgerDirection" NOT NULL,
    "reason" "LedgerReason" NOT NULL,
    "referenceType" TEXT NOT NULL,
    "referenceId" TEXT NOT NULL,
    "availableAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayoutRequest" (
    "id" TEXT NOT NULL,
    "influencerId" TEXT NOT NULL,
    "amountKurus" INTEGER NOT NULL,
    "status" "PayoutStatus" NOT NULL DEFAULT 'TALEP_EDILDI',
    "ibanSnapshot" TEXT NOT NULL,
    "ibanHolderSnapshot" TEXT NOT NULL,
    "adminNote" TEXT,
    "batchId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "approvedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),

    CONSTRAINT "PayoutRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayoutBatch" (
    "id" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayoutBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "href" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_influencerId_key" ON "User"("influencerId");

-- CreateIndex
CREATE INDEX "User_brandId_idx" ON "User"("brandId");

-- CreateIndex
CREATE UNIQUE INDEX "SocialAccount_influencerId_platform_key" ON "SocialAccount"("influencerId", "platform");

-- CreateIndex
CREATE INDEX "SocialAccountSnapshot_socialAccountId_takenAt_idx" ON "SocialAccountSnapshot"("socialAccountId", "takenAt");

-- CreateIndex
CREATE UNIQUE INDEX "Campaign_slug_key" ON "Campaign"("slug");

-- CreateIndex
CREATE INDEX "Campaign_brandId_idx" ON "Campaign"("brandId");

-- CreateIndex
CREATE INDEX "Campaign_status_idx" ON "Campaign"("status");

-- CreateIndex
CREATE UNIQUE INDEX "CampaignBrief_campaignId_version_key" ON "CampaignBrief"("campaignId", "version");

-- CreateIndex
CREATE INDEX "Assignment_campaignId_idx" ON "Assignment"("campaignId");

-- CreateIndex
CREATE INDEX "Assignment_influencerId_idx" ON "Assignment"("influencerId");

-- CreateIndex
CREATE INDEX "Deliverable_assignmentId_idx" ON "Deliverable"("assignmentId");

-- CreateIndex
CREATE INDEX "Deliverable_plannedAt_status_idx" ON "Deliverable"("plannedAt", "status");

-- CreateIndex
CREATE INDEX "DeliverableStatusChange_deliverableId_at_idx" ON "DeliverableStatusChange"("deliverableId", "at");

-- CreateIndex
CREATE INDEX "DeliverableReview_deliverableId_idx" ON "DeliverableReview"("deliverableId");

-- CreateIndex
CREATE UNIQUE INDEX "Asset_key_key" ON "Asset"("key");

-- CreateIndex
CREATE INDEX "Asset_deliverableId_idx" ON "Asset"("deliverableId");

-- CreateIndex
CREATE INDEX "Asset_campaignId_idx" ON "Asset"("campaignId");

-- CreateIndex
CREATE INDEX "MetricSnapshot_deliverableId_measuredAt_idx" ON "MetricSnapshot"("deliverableId", "measuredAt");

-- CreateIndex
CREATE INDEX "MetricSnapshot_screenshotAssetId_idx" ON "MetricSnapshot"("screenshotAssetId");

-- CreateIndex
CREATE UNIQUE INDEX "AgentRun_idempotencyKey_key" ON "AgentRun"("idempotencyKey");

-- CreateIndex
CREATE INDEX "AgentRun_status_severity_idx" ON "AgentRun"("status", "severity");

-- CreateIndex
CREATE INDEX "AgentRun_targetType_targetId_idx" ON "AgentRun"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "LedgerEntry_txId_idx" ON "LedgerEntry"("txId");

-- CreateIndex
CREATE INDEX "LedgerEntry_influencerId_idx" ON "LedgerEntry"("influencerId");

-- CreateIndex
CREATE INDEX "LedgerEntry_referenceType_referenceId_idx" ON "LedgerEntry"("referenceType", "referenceId");

-- CreateIndex
CREATE INDEX "PayoutRequest_influencerId_idx" ON "PayoutRequest"("influencerId");

-- CreateIndex
CREATE INDEX "PayoutRequest_batchId_idx" ON "PayoutRequest"("batchId");

-- CreateIndex
CREATE INDEX "PayoutRequest_status_idx" ON "PayoutRequest"("status");

-- CreateIndex
CREATE INDEX "PayoutBatch_createdById_idx" ON "PayoutBatch"("createdById");

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_idx" ON "Notification"("userId", "readAt");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_influencerId_fkey" FOREIGN KEY ("influencerId") REFERENCES "Influencer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialAccount" ADD CONSTRAINT "SocialAccount_influencerId_fkey" FOREIGN KEY ("influencerId") REFERENCES "Influencer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialAccountSnapshot" ADD CONSTRAINT "SocialAccountSnapshot_socialAccountId_fkey" FOREIGN KEY ("socialAccountId") REFERENCES "SocialAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignBrief" ADD CONSTRAINT "CampaignBrief_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignBrief" ADD CONSTRAINT "CampaignBrief_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_influencerId_fkey" FOREIGN KEY ("influencerId") REFERENCES "Influencer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deliverable" ADD CONSTRAINT "Deliverable_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliverableStatusChange" ADD CONSTRAINT "DeliverableStatusChange_deliverableId_fkey" FOREIGN KEY ("deliverableId") REFERENCES "Deliverable"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliverableStatusChange" ADD CONSTRAINT "DeliverableStatusChange_byUserId_fkey" FOREIGN KEY ("byUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliverableReview" ADD CONSTRAINT "DeliverableReview_deliverableId_fkey" FOREIGN KEY ("deliverableId") REFERENCES "Deliverable"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliverableReview" ADD CONSTRAINT "DeliverableReview_brandUserId_fkey" FOREIGN KEY ("brandUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_deliverableId_fkey" FOREIGN KEY ("deliverableId") REFERENCES "Deliverable"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetricSnapshot" ADD CONSTRAINT "MetricSnapshot_deliverableId_fkey" FOREIGN KEY ("deliverableId") REFERENCES "Deliverable"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetricSnapshot" ADD CONSTRAINT "MetricSnapshot_screenshotAssetId_fkey" FOREIGN KEY ("screenshotAssetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetricSnapshot" ADD CONSTRAINT "MetricSnapshot_enteredById_fkey" FOREIGN KEY ("enteredById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentRun" ADD CONSTRAINT "AgentRun_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_influencerId_fkey" FOREIGN KEY ("influencerId") REFERENCES "Influencer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayoutRequest" ADD CONSTRAINT "PayoutRequest_influencerId_fkey" FOREIGN KEY ("influencerId") REFERENCES "Influencer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayoutRequest" ADD CONSTRAINT "PayoutRequest_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "PayoutBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayoutBatch" ADD CONSTRAINT "PayoutBatch_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
