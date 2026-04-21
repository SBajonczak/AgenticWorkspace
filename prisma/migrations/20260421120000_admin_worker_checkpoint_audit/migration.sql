-- Tenant-level checkpoint controls
ALTER TABLE "Tenant"
  ADD COLUMN "meetingSyncCheckpointAt" TIMESTAMP(3),
  ADD COLUMN "checkpointUpdatedAt" TIMESTAMP(3),
  ADD COLUMN "checkpointUpdatedByUserId" TEXT,
  ADD COLUMN "checkpointUpdatedByEmail" TEXT,
  ADD COLUMN "checkpointUpdateReason" TEXT;

-- Meeting indexing audit and recrawl metadata
ALTER TABLE "Meeting"
  ADD COLUMN "indexedAt" TIMESTAMP(3),
  ADD COLUMN "indexedForUserId" TEXT,
  ADD COLUMN "indexedForUserEmail" TEXT,
  ADD COLUMN "indexedByUserId" TEXT,
  ADD COLUMN "indexedByUserEmail" TEXT,
  ADD COLUMN "recrawlCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "lastRecrawlAt" TIMESTAMP(3);

CREATE INDEX "Tenant_meetingSyncCheckpointAt_idx" ON "Tenant"("meetingSyncCheckpointAt");
CREATE INDEX "Meeting_tenantId_indexedAt_idx" ON "Meeting"("tenantId", "indexedAt");
CREATE INDEX "Meeting_tenantId_indexedForUserId_idx" ON "Meeting"("tenantId", "indexedForUserId");
