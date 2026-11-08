

-- AlterTable
ALTER TABLE "Brand" ADD COLUMN     "country" TEXT NOT NULL DEFAULT 'TR';

-- AlterTable
ALTER TABLE "Campaign" ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'TRY';

-- AlterTable
ALTER TABLE "Influencer" ADD COLUMN     "country" TEXT NOT NULL DEFAULT 'TR';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "country" TEXT,
ADD COLUMN     "locale" TEXT;

-- AlterTable
ALTER TABLE "credit_accounts" ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'TRY';

