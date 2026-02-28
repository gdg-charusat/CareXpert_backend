-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN     "followUpDate" TIMESTAMP(3),
ADD COLUMN     "followUpSent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "followUpSentAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Appointment_followUpDate_followUpSent_idx" ON "Appointment"("followUpDate", "followUpSent");

-- CreateIndex
CREATE INDEX "Appointment_doctorId_date_idx" ON "Appointment"("doctorId", "date");
