
-- AlterTable
ALTER TABLE "creative_jobs" ADD COLUMN     "input_upload_id" TEXT;

-- CreateTable
CREATE TABLE "creative_uploads" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "uploaded_by_user_id" TEXT,
    "kind" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "s3_key" TEXT NOT NULL,
    "name" TEXT,
    "source" TEXT NOT NULL DEFAULT 'upload',
    "parent_id" TEXT,
    "duration_sec" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "creative_uploads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "video_edit_jobs" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "upload_id" TEXT NOT NULL,
    "ops" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "output_upload_id" TEXT,
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "video_edit_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "creative_uploads_tenant_id_created_at_idx" ON "creative_uploads"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX "video_edit_jobs_status_created_at_idx" ON "video_edit_jobs"("status", "created_at");

-- CreateIndex
CREATE INDEX "video_edit_jobs_tenant_id_created_at_idx" ON "video_edit_jobs"("tenant_id", "created_at");

