/*
  Warnings:

  - A unique constraint covering the columns `[appointmentId]` on the table `PatientHistory` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[prescriptionId]` on the table `PatientHistory` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `appointmentId` to the `PatientHistory` table without a default value. This is not possible if the table is not empty.
  - Added the required column `prescriptionId` to the `PatientHistory` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "PatientHistory" ADD COLUMN     "appointmentId" TEXT NOT NULL,
ADD COLUMN     "prescriptionId" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "PatientHistory_appointmentId_key" ON "PatientHistory"("appointmentId");

-- CreateIndex
CREATE UNIQUE INDEX "PatientHistory_prescriptionId_key" ON "PatientHistory"("prescriptionId");

-- AddForeignKey
ALTER TABLE "PatientHistory" ADD CONSTRAINT "PatientHistory_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientHistory" ADD CONSTRAINT "PatientHistory_prescriptionId_fkey" FOREIGN KEY ("prescriptionId") REFERENCES "Prescription"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
