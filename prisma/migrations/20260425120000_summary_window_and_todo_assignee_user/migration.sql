-- Add user-level summary window setting (days)
ALTER TABLE "UserSyncState"
ADD COLUMN "summaryWindowDays" INTEGER NOT NULL DEFAULT 7;

-- Add structured todo assignee relation
ALTER TABLE "Todo"
ADD COLUMN "assigneeUserId" TEXT;

CREATE INDEX "Todo_assigneeUserId_idx" ON "Todo"("assigneeUserId");

ALTER TABLE "Todo"
ADD CONSTRAINT "Todo_assigneeUserId_fkey"
FOREIGN KEY ("assigneeUserId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
