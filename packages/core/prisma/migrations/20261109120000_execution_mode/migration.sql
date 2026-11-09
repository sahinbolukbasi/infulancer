-- CreateEnum
CREATE TYPE "ExecutionMode" AS ENUM ('SELF', 'AJANS');

-- AlterTable
ALTER TABLE "Brand" ADD COLUMN     "defaultExecutionMode" "ExecutionMode" NOT NULL DEFAULT 'AJANS';

-- AlterTable
ALTER TABLE "Campaign" ADD COLUMN     "executionMode" "ExecutionMode" NOT NULL DEFAULT 'AJANS';
