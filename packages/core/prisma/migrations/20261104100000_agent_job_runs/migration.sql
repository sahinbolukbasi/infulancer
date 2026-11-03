
-- CreateTable
CREATE TABLE "AgentJobRun" (
    "id" TEXT NOT NULL,
    "job" TEXT NOT NULL,
    "trigger" TEXT NOT NULL DEFAULT 'schedule',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "created" INTEGER NOT NULL DEFAULT 0,
    "skipped" INTEGER NOT NULL DEFAULT 0,
    "ok" BOOLEAN NOT NULL DEFAULT true,
    "error" TEXT,

    CONSTRAINT "AgentJobRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AgentJobRun_job_startedAt_idx" ON "AgentJobRun"("job", "startedAt");

