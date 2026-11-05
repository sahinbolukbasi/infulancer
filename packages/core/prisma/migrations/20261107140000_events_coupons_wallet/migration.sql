
-- CreateEnum
CREATE TYPE "EventVisibility" AS ENUM ('HERKESE_ACIK', 'KAPALI');

-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('TASLAK', 'YAYINDA', 'IPTAL', 'TAMAMLANDI');

-- CreateEnum
CREATE TYPE "InviteStatus" AS ENUM ('DAVET_EDILDI', 'KATILIM_TALEBI', 'KABUL', 'RED', 'IPTAL');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('GECERLI', 'KULLANILDI', 'IPTAL');

-- CreateEnum
CREATE TYPE "CouponKind" AS ENUM ('KUPON', 'HEDIYE_CEKI');

-- CreateEnum
CREATE TYPE "CouponValueType" AS ENUM ('YUZDE', 'TUTAR');

-- CreateEnum
CREATE TYPE "CouponStatus" AS ENUM ('TASLAK', 'YAYINDA', 'PASIF');

-- CreateEnum
CREATE TYPE "GrantStatus" AS ENUM ('GONDERILDI', 'GORULDU', 'KULLANILDI', 'IPTAL');


-- CreateTable
CREATE TABLE "events" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "cover_image_key" TEXT,
    "image_keys" TEXT[],
    "venue_name" TEXT,
    "address" TEXT,
    "city" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "starts_at" TIMESTAMP(3) NOT NULL,
    "ends_at" TIMESTAMP(3),
    "visibility" "EventVisibility" NOT NULL DEFAULT 'KAPALI',
    "status" "EventStatus" NOT NULL DEFAULT 'TASLAK',
    "capacity" INTEGER,
    "created_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_invites" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "influencer_id" TEXT,
    "user_id" TEXT,
    "guest_name" TEXT,
    "guest_email" TEXT,
    "status" "InviteStatus" NOT NULL DEFAULT 'DAVET_EDILDI',
    "is_request" BOOLEAN NOT NULL DEFAULT false,
    "responded_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_invites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_tickets" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "invite_id" TEXT,
    "holder_name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "status" "TicketStatus" NOT NULL DEFAULT 'GECERLI',
    "checked_in_at" TIMESTAMP(3),
    "wallet_pass_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coupons" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "kind" "CouponKind" NOT NULL DEFAULT 'KUPON',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "logo_key" TEXT,
    "hero_image_key" TEXT,
    "brand_color" TEXT,
    "shared_code" TEXT,
    "value_type" "CouponValueType" NOT NULL DEFAULT 'YUZDE',
    "value" BIGINT NOT NULL,
    "terms" TEXT,
    "valid_from" TIMESTAMP(3),
    "valid_until" TIMESTAMP(3),
    "status" "CouponStatus" NOT NULL DEFAULT 'TASLAK',
    "created_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "coupons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coupon_grants" (
    "id" TEXT NOT NULL,
    "coupon_id" TEXT NOT NULL,
    "influencer_id" TEXT,
    "code" TEXT NOT NULL,
    "status" "GrantStatus" NOT NULL DEFAULT 'GONDERILDI',
    "redeemed_at" TIMESTAMP(3),
    "wallet_pass_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coupon_grants_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "events_tenant_id_status_idx" ON "events"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "events_visibility_status_idx" ON "events"("visibility", "status");

-- CreateIndex
CREATE INDEX "event_invites_event_id_status_idx" ON "event_invites"("event_id", "status");

-- CreateIndex
CREATE INDEX "event_invites_influencer_id_idx" ON "event_invites"("influencer_id");

-- CreateIndex
CREATE UNIQUE INDEX "event_tickets_invite_id_key" ON "event_tickets"("invite_id");

-- CreateIndex
CREATE UNIQUE INDEX "event_tickets_code_key" ON "event_tickets"("code");

-- CreateIndex
CREATE INDEX "event_tickets_event_id_status_idx" ON "event_tickets"("event_id", "status");

-- CreateIndex
CREATE INDEX "coupons_tenant_id_status_idx" ON "coupons"("tenant_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "coupon_grants_code_key" ON "coupon_grants"("code");

-- CreateIndex
CREATE INDEX "coupon_grants_coupon_id_status_idx" ON "coupon_grants"("coupon_id", "status");

-- CreateIndex
CREATE INDEX "coupon_grants_influencer_id_idx" ON "coupon_grants"("influencer_id");

-- AddForeignKey
ALTER TABLE "event_invites" ADD CONSTRAINT "event_invites_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_tickets" ADD CONSTRAINT "event_tickets_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_tickets" ADD CONSTRAINT "event_tickets_invite_id_fkey" FOREIGN KEY ("invite_id") REFERENCES "event_invites"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupon_grants" ADD CONSTRAINT "coupon_grants_coupon_id_fkey" FOREIGN KEY ("coupon_id") REFERENCES "coupons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

