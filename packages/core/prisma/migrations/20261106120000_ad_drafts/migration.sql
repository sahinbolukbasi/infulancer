
-- CreateEnum
CREATE TYPE "AdPlatform" AS ENUM ('META', 'TIKTOK');

-- CreateEnum
CREATE TYPE "AdDraftStatus" AS ENUM ('TASLAK', 'ONAY_BEKLIYOR', 'ONAYLANDI', 'REDDEDILDI');


-- CreateTable
CREATE TABLE "ad_drafts" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "platform" "AdPlatform" NOT NULL,
    "name" TEXT NOT NULL,
    "objective" TEXT NOT NULL,
    "daily_budget_kurus" INTEGER NOT NULL,
    "primary_text" TEXT NOT NULL,
    "asset_id" TEXT,
    "campaign_id" TEXT,
    "status" "AdDraftStatus" NOT NULL DEFAULT 'TASLAK',
    "review_note" TEXT,
    "batch_id" TEXT,
    "created_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ad_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ad_drafts_tenant_id_status_idx" ON "ad_drafts"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "ad_drafts_batch_id_idx" ON "ad_drafts"("batch_id");

