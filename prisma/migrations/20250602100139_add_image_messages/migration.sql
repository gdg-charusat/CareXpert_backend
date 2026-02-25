-- AlterTable
ALTER TABLE "ChatMessage" ADD COLUMN     "imageUrl" TEXT,
ADD COLUMN     "messageType" TEXT NOT NULL DEFAULT 'TEXT';
