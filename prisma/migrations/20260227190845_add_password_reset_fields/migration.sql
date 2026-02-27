-- AlterTable
ALTER TABLE "User" ADD COLUMN     "passwordResetToken" TEXT,
ADD COLUMN     "passwordResetExpiry" TIMESTAMP(3);
