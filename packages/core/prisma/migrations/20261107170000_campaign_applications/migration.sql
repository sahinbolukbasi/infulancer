
-- CreateEnum
CREATE TYPE "OpenCallStatus" AS ENUM ('TASLAK', 'ACIK', 'KAPALI');

-- CreateEnum
CREATE TYPE "CampaignApplicationStatus" AS ENUM ('BASVURULDU', 'INCELENIYOR', 'KABUL', 'RED');


-- CreateTable
CREATE TABLE "campaign_open_calls" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "cover_image_key" TEXT,
    "category" TEXT,
    "budget_min_kurus" BIGINT,
    "budget_max_kurus" BIGINT,
    "platforms" TEXT[],
    "deadline" TIMESTAMP(3),
    "status" "OpenCallStatus" NOT NULL DEFAULT 'TASLAK',
    "created_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campaign_open_calls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaign_applications" (
    "id" TEXT NOT NULL,
    "open_call_id" TEXT NOT NULL,
    "influencer_id" TEXT NOT NULL,
    "pitch" TEXT NOT NULL,
    "quoted_kurus" BIGINT,
    "status" "CampaignApplicationStatus" NOT NULL DEFAULT 'BASVURULDU',
    "review_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campaign_applications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "campaign_open_calls_tenant_id_status_idx" ON "campaign_open_calls"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "campaign_open_calls_status_idx" ON "campaign_open_calls"("status");

-- CreateIndex
CREATE INDEX "campaign_applications_influencer_id_status_idx" ON "campaign_applications"("influencer_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "campaign_applications_open_call_id_influencer_id_key" ON "campaign_applications"("open_call_id", "influencer_id");

-- AddForeignKey
ALTER TABLE "campaign_applications" ADD CONSTRAINT "campaign_applications_open_call_id_fkey" FOREIGN KEY ("open_call_id") REFERENCES "campaign_open_calls"("id") ON DELETE CASCADE ON UPDATE CASCADE;

