-- CreateEnum
CREATE TYPE "Role" AS ENUM ('PATIENT', 'DOCTOR', 'ADMIN');

-- CreateEnum
CREATE TYPE "AppointmentStatus" AS ENUM ('PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'REJECTED');

-- CreateEnum
CREATE TYPE "AppointmentType" AS ENUM ('ONLINE', 'OFFLINE');

-- CreateEnum
CREATE TYPE "TimeSlotStatus" AS ENUM ('AVAILABLE', 'BOOKED', 'CANCELLED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "profilePicture" TEXT,
    "password" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'PATIENT',
    "refreshToken" TEXT,
    "tokenVersion" INTEGER NOT NULL DEFAULT 0,
    "isEmailVerified" BOOLEAN NOT NULL DEFAULT false,
    "emailVerificationToken" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "roomId" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Patient" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "location" TEXT,
    "medicalHistory" TEXT,

    CONSTRAINT "Patient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Doctor" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "specialty" TEXT NOT NULL,
    "clinicLocation" TEXT NOT NULL,
    "experience" TEXT DEFAULT '0',
    "education" TEXT,
    "bio" TEXT,
    "languages" TEXT[],
    "isVerified" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Doctor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Admin" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "permissions" JSONB,

    CONSTRAINT "Admin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Appointment" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "timeSlotId" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "time" TEXT NOT NULL,
    "appointmentType" "AppointmentType" NOT NULL DEFAULT 'OFFLINE',
    "status" "AppointmentStatus" NOT NULL DEFAULT 'PENDING',
    "consultationFee" INTEGER DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "prescriptionId" TEXT,

    CONSTRAINT "Appointment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Prescription" (
    "id" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "dateIssued" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "prescriptionText" TEXT NOT NULL,

    CONSTRAINT "Prescription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Symptom" (
    "id" TEXT NOT NULL,
    "symptomText" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,

    CONSTRAINT "Symptom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PatientHistory" (
    "id" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "prescriptionId" TEXT NOT NULL,
    "notes" TEXT NOT NULL,
    "dateRecorded" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PatientHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimeSlot" (
    "id" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "consultationFee" INTEGER DEFAULT 0,
    "status" "TimeSlotStatus" NOT NULL DEFAULT 'AVAILABLE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TimeSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "receiverId" TEXT,
    "roomId" TEXT,
    "message" TEXT NOT NULL,
    "messageType" TEXT NOT NULL DEFAULT 'TEXT',
    "imageUrl" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Room" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Room_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "extractedText" TEXT,
    "summary" TEXT,
    "abnormalValues" JSONB,
    "possibleConditions" TEXT[],
    "recommendation" TEXT,
    "disclaimer" TEXT,
    "mimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiChat" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userMessage" TEXT NOT NULL,
    "aiResponse" JSONB NOT NULL,
    "probableCauses" TEXT[],
    "severity" TEXT NOT NULL,
    "recommendation" TEXT NOT NULL,
    "disclaimer" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiChat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "appointmentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_RoomAdmin" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_RoomAdmin_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_RoomMembers" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_RoomMembers_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_name_idx" ON "User"("name");

-- CreateIndex
CREATE INDEX "User_email_role_idx" ON "User"("email", "role");

-- CreateIndex
CREATE UNIQUE INDEX "Patient_userId_key" ON "Patient"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Doctor_userId_key" ON "Doctor"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Admin_userId_key" ON "Admin"("userId");

-- CreateIndex
CREATE INDEX "Appointment_doctorId_status_date_idx" ON "Appointment"("doctorId", "status", "date");

-- CreateIndex
CREATE INDEX "Appointment_patientId_date_idx" ON "Appointment"("patientId", "date");

-- CreateIndex
CREATE INDEX "Appointment_prescriptionId_idx" ON "Appointment"("prescriptionId");

-- CreateIndex
CREATE INDEX "Appointment_status_date_idx" ON "Appointment"("status", "date");

-- CreateIndex
CREATE UNIQUE INDEX "PatientHistory_appointmentId_key" ON "PatientHistory"("appointmentId");

-- CreateIndex
CREATE UNIQUE INDEX "PatientHistory_prescriptionId_key" ON "PatientHistory"("prescriptionId");

-- CreateIndex
CREATE INDEX "TimeSlot_doctorId_status_startTime_idx" ON "TimeSlot"("doctorId", "status", "startTime");

-- CreateIndex
CREATE INDEX "TimeSlot_status_startTime_idx" ON "TimeSlot"("status", "startTime");

-- CreateIndex
CREATE UNIQUE INDEX "TimeSlot_doctorId_startTime_key" ON "TimeSlot"("doctorId", "startTime");

-- CreateIndex
CREATE INDEX "ChatMessage_senderId_receiverId_timestamp_idx" ON "ChatMessage"("senderId", "receiverId", "timestamp");

-- CreateIndex
CREATE INDEX "ChatMessage_roomId_timestamp_idx" ON "ChatMessage"("roomId", "timestamp");

-- CreateIndex
CREATE INDEX "Room_name_idx" ON "Room"("name");

-- CreateIndex
CREATE INDEX "Report_patientId_idx" ON "Report"("patientId");

-- CreateIndex
CREATE INDEX "Report_status_idx" ON "Report"("status");

-- CreateIndex
CREATE INDEX "Report_createdAt_idx" ON "Report"("createdAt");

-- CreateIndex
CREATE INDEX "AiChat_userId_createdAt_idx" ON "AiChat"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_userId_isRead_idx" ON "Notification"("userId", "isRead");

-- CreateIndex
CREATE INDEX "Notification_createdAt_idx" ON "Notification"("createdAt");

-- CreateIndex
CREATE INDEX "_RoomAdmin_B_index" ON "_RoomAdmin"("B");

-- CreateIndex
CREATE INDEX "_RoomMembers_B_index" ON "_RoomMembers"("B");

-- AddForeignKey
ALTER TABLE "Patient" ADD CONSTRAINT "Patient_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Doctor" ADD CONSTRAINT "Doctor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Admin" ADD CONSTRAINT "Admin_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_timeSlotId_fkey" FOREIGN KEY ("timeSlotId") REFERENCES "TimeSlot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_prescriptionId_fkey" FOREIGN KEY ("prescriptionId") REFERENCES "Prescription"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prescription" ADD CONSTRAINT "Prescription_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prescription" ADD CONSTRAINT "Prescription_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Symptom" ADD CONSTRAINT "Symptom_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientHistory" ADD CONSTRAINT "PatientHistory_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientHistory" ADD CONSTRAINT "PatientHistory_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientHistory" ADD CONSTRAINT "PatientHistory_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientHistory" ADD CONSTRAINT "PatientHistory_prescriptionId_fkey" FOREIGN KEY ("prescriptionId") REFERENCES "Prescription"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeSlot" ADD CONSTRAINT "TimeSlot_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_receiverId_fkey" FOREIGN KEY ("receiverId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiChat" ADD CONSTRAINT "AiChat_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_RoomAdmin" ADD CONSTRAINT "_RoomAdmin_A_fkey" FOREIGN KEY ("A") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_RoomAdmin" ADD CONSTRAINT "_RoomAdmin_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_RoomMembers" ADD CONSTRAINT "_RoomMembers_A_fkey" FOREIGN KEY ("A") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_RoomMembers" ADD CONSTRAINT "_RoomMembers_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
