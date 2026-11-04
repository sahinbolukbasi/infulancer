
-- CreateTable
CREATE TABLE "tracker_agents" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "template" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "settings" JSONB NOT NULL DEFAULT '{}',
    "notifyAdmins" BOOLEAN NOT NULL DEFAULT true,
    "notifyBrand" BOOLEAN NOT NULL DEFAULT false,
    "notifyInfluencer" BOOLEAN NOT NULL DEFAULT false,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "lastRunAt" TIMESTAMP(3),
    "lastFindings" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tracker_agents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tracker_agents_scope_targetId_idx" ON "tracker_agents"("scope", "targetId");

-- CreateIndex
CREATE INDEX "tracker_agents_enabled_idx" ON "tracker_agents"("enabled");

