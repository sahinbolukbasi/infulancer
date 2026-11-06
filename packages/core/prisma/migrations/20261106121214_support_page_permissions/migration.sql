-- CreateEnum
CREATE TYPE "SupportCategory" AS ENUM ('HATA', 'SORU', 'ISTEK', 'DIGER');

-- CreateEnum
CREATE TYPE "SupportStatus" AS ENUM ('ACIK', 'INCELEMEDE', 'COZULDU', 'KAPANDI');


-- CreateTable
CREATE TABLE "support_tickets" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "role" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "category" "SupportCategory" NOT NULL DEFAULT 'SORU',
    "subject" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "page_url" TEXT,
    "status" "SupportStatus" NOT NULL DEFAULT 'ACIK',
    "admin_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "support_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "page_permissions" (
    "id" TEXT NOT NULL,
    "scope_type" TEXT NOT NULL,
    "scope_id" TEXT NOT NULL,
    "path_prefix" TEXT NOT NULL,
    "allowed" BOOLEAN NOT NULL DEFAULT false,
    "updated_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "page_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "support_tickets_status_created_at_idx" ON "support_tickets"("status", "created_at");

-- CreateIndex
CREATE INDEX "support_tickets_user_id_idx" ON "support_tickets"("user_id");

-- CreateIndex
CREATE INDEX "page_permissions_scope_type_scope_id_idx" ON "page_permissions"("scope_type", "scope_id");

-- CreateIndex
CREATE UNIQUE INDEX "page_permissions_scope_type_scope_id_path_prefix_key" ON "page_permissions"("scope_type", "scope_id", "path_prefix");

