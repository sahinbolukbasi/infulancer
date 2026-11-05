
-- CreateEnum
CREATE TYPE "NotifChannel" AS ENUM ('INAPP', 'EMAIL', 'WHATSAPP', 'INSTAGRAM');

-- CreateEnum
CREATE TYPE "NotifDeliveryStatus" AS ENUM ('QUEUED', 'SENT', 'MOCKED', 'FAILED', 'SKIPPED');


-- CreateTable
CREATE TABLE "notification_rules" (
    "id" TEXT NOT NULL,
    "event_key" TEXT NOT NULL,
    "channels" "NotifChannel"[],
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_templates" (
    "id" TEXT NOT NULL,
    "event_key" TEXT NOT NULL,
    "channel" "NotifChannel" NOT NULL,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_logs" (
    "id" TEXT NOT NULL,
    "event_key" TEXT NOT NULL,
    "channel" "NotifChannel" NOT NULL,
    "user_id" TEXT,
    "to_address" TEXT,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "status" "NotifDeliveryStatus" NOT NULL DEFAULT 'QUEUED',
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "short_links" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "target_url" TEXT NOT NULL,
    "label" TEXT,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "created_by_user_id" TEXT,
    "last_click_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "short_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "notification_rules_event_key_key" ON "notification_rules"("event_key");

-- CreateIndex
CREATE UNIQUE INDEX "notification_templates_event_key_channel_key" ON "notification_templates"("event_key", "channel");

-- CreateIndex
CREATE INDEX "notification_logs_event_key_created_at_idx" ON "notification_logs"("event_key", "created_at");

-- CreateIndex
CREATE INDEX "notification_logs_user_id_idx" ON "notification_logs"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "short_links_slug_key" ON "short_links"("slug");

