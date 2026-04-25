-- Add user-level scheduling constraints
ALTER TABLE "UserSyncState"
ADD COLUMN "timezone" TEXT NOT NULL DEFAULT 'Europe/Berlin',
ADD COLUMN "workDayStart" TEXT NOT NULL DEFAULT '09:00',
ADD COLUMN "workDayEnd" TEXT NOT NULL DEFAULT '17:00';

-- Add focus slots per weekday
CREATE TABLE "UserFocusTimeSlot" (
  "id" TEXT NOT NULL,
  "userSyncStateId" TEXT NOT NULL,
  "dayOfWeek" INTEGER NOT NULL,
  "startTime" TEXT NOT NULL,
  "endTime" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "UserFocusTimeSlot_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "UserFocusTimeSlot_userSyncStateId_idx" ON "UserFocusTimeSlot"("userSyncStateId");
CREATE INDEX "UserFocusTimeSlot_dayOfWeek_idx" ON "UserFocusTimeSlot"("dayOfWeek");
CREATE UNIQUE INDEX "UserFocusTimeSlot_userSyncStateId_dayOfWeek_startTime_endTime_key"
  ON "UserFocusTimeSlot"("userSyncStateId", "dayOfWeek", "startTime", "endTime");

ALTER TABLE "UserFocusTimeSlot"
ADD CONSTRAINT "UserFocusTimeSlot_userSyncStateId_fkey"
FOREIGN KEY ("userSyncStateId") REFERENCES "UserSyncState"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
