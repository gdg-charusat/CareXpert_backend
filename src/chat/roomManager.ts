import { Namespace, Socket } from "socket.io";
import { formatMessage } from "./utils";
import prisma from "../utils/prismClient";

interface JoinRoomData {
  // userId and username are intentionally omitted — the server derives
  // these from the verified socket.data set by socketAuth.middleware.ts.
  roomId: string;
}

interface RoomMessageData {
  // senderId and username are intentionally omitted — the server derives
  // these from the verified socket.data set by socketAuth.middleware.ts.
  roomId: string;
  text: string;
  image?: string;
}

/**
 * Registers room-based chat event handlers on the /chat/room namespace.
 * @param nsp  - The /chat/room Namespace instance
 * @param socket - The individual authenticated socket connection
 */
export function handleRoomSocket(nsp: Namespace, socket: Socket) {
  socket.on(
    "joinRoom",
    async (message: { event: string; data: JoinRoomData }) => {
      try {
        const { roomId } = message.data;
        // Use server-verified identity — never trust client-supplied userId/username
        const userId   = socket.data.userId as string;
        const username = socket.data.name   as string;

        socket.join(roomId);

        const welcomeMsg = formatMessage({
          senderId: undefined,
          username: "CareXpert Bot",
          text: `Welcome to ${roomId} room!`,
        });

        (welcomeMsg as any).roomId = roomId;
        socket.emit("message", welcomeMsg);

        const joinMsg = formatMessage({
          senderId: undefined,
          username: "CareXpert Bot",
          text: `${username} has joined the room.`,
        });
        (joinMsg as any).roomId = roomId;
        socket.broadcast.to(roomId).emit("message", joinMsg);
      } catch (error) {
        console.error("Error in joinRoom:", error);
        socket.emit("error", "Failed to join room");
      }
    }
  );

  socket.on(
    "roomMessage",
    async (message: { event: string; data: RoomMessageData }) => {
      try {
        const { roomId, text, image } = message.data;
        // Use server-verified identity — never trust client-supplied senderId/username
        const senderId = socket.data.userId as string;
        const username = socket.data.name   as string;

        const messageData = {
          roomId,
          senderId,
          username,
          text,
        };

        const formattedMessage = formatMessage(messageData);
        (formattedMessage as any).roomId = roomId;

        socket.to(roomId).emit("message", formattedMessage);

        await prisma.chatMessage.create({
          data: {
            senderId: senderId,
            roomId: roomId,
            message: text,
            messageType: image ? "IMAGE" : "TEXT",
            imageUrl: image || null,
            receiverId: null, 
          },
        });
      } catch (error) {
        console.error("Error in roomMessage:", error);
        socket.emit("error", "Failed to send message");
      }
    }
  );
}
