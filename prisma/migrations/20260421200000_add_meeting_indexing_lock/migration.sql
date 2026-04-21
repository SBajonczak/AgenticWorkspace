-- AlterTable: Add indexing lock fields to Meeting
ALTER TABLE "Meeting" ADD COLUMN "isIndexing" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Meeting" ADD COLUMN "indexingStartedAt" TIMESTAMP(3);

-- CreateIndex: Efficient lookup of meetings being indexed per tenant
CREATE INDEX "Meeting_tenantId_isIndexing_idx" ON "Meeting"("tenantId", "isIndexing");
