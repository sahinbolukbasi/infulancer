
-- AlterTable
ALTER TABLE "Influencer" ADD COLUMN     "headline" TEXT,
ADD COLUMN     "showCollaborations" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "showPrices" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "showcaseVisible" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "portfolio_items" (
    "id" TEXT NOT NULL,
    "influencerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "deliverableId" TEXT,
    "brandName" TEXT,
    "note" TEXT,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "portfolio_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "portfolio_items_influencerId_sort_idx" ON "portfolio_items"("influencerId", "sort");

