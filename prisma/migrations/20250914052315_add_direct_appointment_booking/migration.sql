/*
  Warnings:

  - Added the required column `date` to the `Appointment` table without a default value. This is not possible if the table is not empty.
  - Added the required column `time` to the `Appointment` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Appointment` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "AppointmentType" AS ENUM ('ONLINE', 'OFFLINE');

-- AlterEnum
ALTER TYPE "AppointmentStatus" ADD VALUE 'CONFIRMED';

-- DropForeignKey
ALTER TABLE "Appointment" DROP CONSTRAINT "Appointment_timeSlotId_fkey";

-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN     "appointmentType" "AppointmentType" NOT NULL DEFAULT 'OFFLINE',
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "date" TIMESTAMP(3),
ADD COLUMN     "time" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "timeSlotId" DROP NOT NULL;

-- Update existing appointments with data from timeSlot
UPDATE "Appointment" 
SET 
  "date" = DATE("TimeSlot"."startTime"),
  "time" = TO_CHAR("TimeSlot"."startTime", 'HH24:MI')
FROM "TimeSlot"
WHERE "Appointment"."timeSlotId" = "TimeSlot"."id";

-- Make the new columns NOT NULL after populating them
ALTER TABLE "Appointment" ALTER COLUMN "date" SET NOT NULL;
ALTER TABLE "Appointment" ALTER COLUMN "time" SET NOT NULL;

-- CreateIndex
CREATE INDEX "Appointment_doctorId_date_time_idx" ON "Appointment"("doctorId", "date", "time");

-- CreateIndex
CREATE INDEX "Appointment_patientId_date_idx" ON "Appointment"("patientId", "date");

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_timeSlotId_fkey" FOREIGN KEY ("timeSlotId") REFERENCES "TimeSlot"("id") ON DELETE SET NULL ON UPDATE CASCADE;
