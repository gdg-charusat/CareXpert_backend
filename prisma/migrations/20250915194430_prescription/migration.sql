-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN     "prescriptionId" TEXT;

-- CreateIndex
CREATE INDEX "Appointment_prescriptionId_idx" ON "Appointment"("prescriptionId");

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_prescriptionId_fkey" FOREIGN KEY ("prescriptionId") REFERENCES "Prescription"("id") ON DELETE SET NULL ON UPDATE CASCADE;
