-- CreateEnum
CREATE TYPE "CreditRequestStatus" AS ENUM ('BEKLIYOR', 'ONAYLANDI', 'RED');


-- CreateTable
CREATE TABLE "credit_requests" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "requested_by_user_id" TEXT,
    "role" TEXT,
    "amount_try" INTEGER NOT NULL,
    "note" TEXT,
    "status" "CreditRequestStatus" NOT NULL DEFAULT 'BEKLIYOR',
    "decided_by_user_id" TEXT,
    "decided_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "credit_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "credit_requests_status_created_at_idx" ON "credit_requests"("status", "created_at");

-- CreateIndex
CREATE INDEX "credit_requests_tenant_id_idx" ON "credit_requests"("tenant_id");

