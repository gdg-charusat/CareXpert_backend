/*
  Warnings:

  - The `possibleConditions` column on the `Report` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Added the required column `fileSize` to the `Report` table without a default value. This is not possible if the table is not empty.
  - Added the required column `mimeType` to the `Report` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Report` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "Report_patientId_createdAt_idx";

-- AlterTable
ALTER TABLE "Report" ADD COLUMN     "error" TEXT,
ADD COLUMN     "fileSize" INTEGER NOT NULL,
ADD COLUMN     "mimeType" TEXT NOT NULL,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
DROP COLUMN "possibleConditions",
ADD COLUMN     "possibleConditions" TEXT[];

-- CreateIndex
CREATE INDEX "Report_patientId_idx" ON "Report"("patientId");

-- CreateIndex
CREATE INDEX "Report_status_idx" ON "Report"("status");

-- CreateIndex
CREATE INDEX "Report_createdAt_idx" ON "Report"("createdAt");
