-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN     "consultationFee" INTEGER DEFAULT 0;

-- AlterTable
ALTER TABLE "Doctor" ADD COLUMN     "languages" TEXT[];
