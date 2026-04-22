-- Support recurring meetings: each occurrence shares the same Teams onlineMeetingId
-- but must be stored as a separate row differentiated by startTime.

-- Drop the old single-column unique constraint on meetingId
DROP INDEX "Meeting_meetingId_key";

-- Add composite unique index so every (meetingId, startTime) pair is stored once.
-- This allows a recurring series to accumulate one row per occurrence while
-- still preventing duplicate processing of the same occurrence.
CREATE UNIQUE INDEX "Meeting_meetingId_startTime_key" ON "Meeting"("meetingId", "startTime");
