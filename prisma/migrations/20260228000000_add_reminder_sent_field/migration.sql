-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN "reminderSent" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Appointment_reminderSent_date_idx" ON "Appointment"("reminderSent", "date");
