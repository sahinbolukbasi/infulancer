
-- CreateTable
CREATE TABLE "rate_cards" (
    "id" TEXT NOT NULL,
    "influencerId" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "contentType" "ContentType" NOT NULL,
    "priceKurus" INTEGER NOT NULL,
    "note" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rate_cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "offers" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "influencerId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "campaignId" TEXT,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "items" JSONB NOT NULL,
    "totalKurus" INTEGER NOT NULL,
    "publishBy" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'GONDERILDI',
    "responseNote" TEXT,
    "respondedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "assignmentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "offers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "rate_cards_influencerId_idx" ON "rate_cards"("influencerId");

-- CreateIndex
CREATE UNIQUE INDEX "rate_cards_influencerId_platform_contentType_key" ON "rate_cards"("influencerId", "platform", "contentType");

-- CreateIndex
CREATE INDEX "offers_influencerId_status_idx" ON "offers"("influencerId", "status");

-- CreateIndex
CREATE INDEX "offers_brandId_status_idx" ON "offers"("brandId", "status");

