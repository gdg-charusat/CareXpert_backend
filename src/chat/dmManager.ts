import { Namespace, Socket } from "socket.io";
import { formatMessage } from "./utils";
import prisma from "../utils/prismClient";
import { uploadToCloudinary } from "../utils/cloudinary";

interface JoinDmRoomData {
  // Mirrors the JoinRoomData envelope used in roomManager for consistency.
  roomId: string;
}

interface DmMessageData {
  roomId: string;
  // senderId and username are intentionally omitted — the server derives
  // these from the verified socket.data set by socketAuth.middleware.ts.
  receiverId: string;
  text: string;
  image?: string;
}

/**
 * Registers direct-message event handlers on the /chat/dm namespace.
 * @param _nsp  - The /chat/dm Namespace instance (currently unused; retained for API consistency)
 * @param socket - The individual authenticated socket connection
 */
export function handleDmSocket(_nsp: Namespace, socket: Socket) {
  socket.on(
    "joinDmRoom",
    async (message: { event: string; data: JoinDmRoomData }) => {
      try {
        const { roomId } = message.data;

        socket.join(roomId);

        // Acknowledge the join back to the connecting socket (mirrors joinRoom behaviour).
        // No broadcast to the DM partner — joining a private conversation is silent to others.
        socket.emit("message", {
          username: "CareXpert Bot",
          text: `Connected to DM room.`,
          roomId,
          createdAt: new Date(),
        });
      } catch (error) {
        console.error("Error in joinDmRoom:", error);
        socket.emit("error", "Failed to join DM room");
      }
    }
  );

  socket.on(
    "dmMessage",
    async (message: { event: string; data: DmMessageData }) => {
      try {
        const { roomId, receiverId, text, image } = message.data;
        // Use server-verified identity — never trust client-supplied senderId/username
        const senderId = socket.data.userId as string;
        const username = socket.data.name as string;

        let messageData: any = {
          roomId,
          senderId,
          username,
          text,
        };

        if (image) {
          try {
            const imageUrl = await uploadToCloudinary(image);
            messageData = {
              ...messageData,
              messageType: "IMAGE",
              imageUrl,
            };
          } catch (error) {
            console.error("Error uploading image:", error);
            socket.emit("error", "Failed to upload image");
            return;
          }
        }

        const formattedMessage = formatMessage(messageData);

        // Exclude the sender: they already have the message locally.
        // Mirrors the socket.to() pattern used in roomMessage.
        socket.to(roomId).emit("message", formattedMessage);

        await prisma.chatMessage.create({
          data: {
            senderId: senderId,
            receiverId: receiverId,
            roomId: null, 
            message: text,
            messageType: image ? "IMAGE" : "TEXT",
            imageUrl: image ? formattedMessage.imageUrl : null,
          },
        });
      } catch (error) {
        console.error("Error in dmMessage:", error);
        socket.emit("error", "Failed to send DM message");
      }
    }
  );
}
