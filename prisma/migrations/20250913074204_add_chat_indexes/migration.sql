-- CreateIndex
CREATE INDEX "ChatMessage_senderId_receiverId_timestamp_idx" ON "ChatMessage"("senderId", "receiverId", "timestamp");

-- CreateIndex
CREATE INDEX "ChatMessage_roomId_timestamp_idx" ON "ChatMessage"("roomId", "timestamp");
