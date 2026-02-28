-- DropIndex
DROP INDEX "Appointment_doctorId_date_time_idx";

-- DropIndex
DROP INDEX "TimeSlot_doctorId_startTime_idx";

-- CreateTable
CREATE TABLE "PrescriptionTemplate" (
    "id" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "prescriptionText" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrescriptionTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PrescriptionTemplate_doctorId_isActive_idx" ON "PrescriptionTemplate"("doctorId", "isActive");

-- CreateIndex
CREATE INDEX "PrescriptionTemplate_doctorId_createdAt_idx" ON "PrescriptionTemplate"("doctorId", "createdAt");

-- CreateIndex
CREATE INDEX "Appointment_doctorId_status_date_idx" ON "Appointment"("doctorId", "status", "date");

-- CreateIndex
CREATE INDEX "Appointment_status_date_idx" ON "Appointment"("status", "date");

-- CreateIndex
CREATE INDEX "TimeSlot_doctorId_status_startTime_idx" ON "TimeSlot"("doctorId", "status", "startTime");

-- CreateIndex
CREATE INDEX "TimeSlot_status_startTime_idx" ON "TimeSlot"("status", "startTime");

-- CreateIndex
CREATE INDEX "User_name_idx" ON "User"("name");

-- CreateIndex
CREATE INDEX "User_email_role_idx" ON "User"("email", "role");

-- AddForeignKey
ALTER TABLE "PrescriptionTemplate" ADD CONSTRAINT "PrescriptionTemplate_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
