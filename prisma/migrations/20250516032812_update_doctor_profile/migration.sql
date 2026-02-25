-- AlterTable
ALTER TABLE "Doctor" ADD COLUMN     "bio" TEXT,
ADD COLUMN     "education" TEXT,
ADD COLUMN     "experience" TEXT DEFAULT '0';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "profilePicture" TEXT;
