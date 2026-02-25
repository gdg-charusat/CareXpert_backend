-- Add performance indexes
-- User indexes
CREATE INDEX IF NOT EXISTS "User_name_idx" ON "User"("name");
CREATE INDEX IF NOT EXISTS "User_email_role_idx" ON "User"("email", "role");

-- Appointment indexes
CREATE INDEX IF NOT EXISTS "Appointment_status_date_idx" ON "Appointment"("status", "date");

-- TimeSlot indexes
CREATE INDEX IF NOT EXISTS "TimeSlot_doctorId_status_startTime_idx" ON "TimeSlot"("doctorId", "status", "startTime");
CREATE INDEX IF NOT EXISTS "TimeSlot_status_startTime_idx" ON "TimeSlot"("status", "startTime");
