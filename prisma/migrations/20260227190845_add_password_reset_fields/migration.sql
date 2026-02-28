-- AlterTable
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "passwordResetToken" TEXT,
ADD COLUMN IF NOT EXISTS "passwordResetExpiry" TIMESTAMP(3);
