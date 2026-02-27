import { Server, Socket } from "socket.io";
import { formatMessage } from "./utils";
import prisma from "../utils/prismClient";

interface JoinRoomData {
  userId: string;
  username: string;
  roomId: string;
}

interface RoomMessageData {
  senderId: string;
  username: string;
  roomId: string;
  text: string;
  image?: string;
}

export function handleRoomSocket(io: Server, socket: Socket) {
  socket.on(
    "joinRoom",
    async (message: { event: string; data: JoinRoomData }) => {
      try {
        // Use verified identity from authenticated socket
        const authenticatedUser = socket.data.user;
        const userId = authenticatedUser.id;
        const username = authenticatedUser.name;
        const { roomId } = message.data;

        socket.join(roomId);

        const welcomeMsg = formatMessage({
          senderId: undefined,
          username: "CareXpert Bot",
          text: `Welcome to ${roomId} room!`,
        });

        // Attach roomId so clients can filter by room
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
        // Use verified identity from authenticated socket instead of client-supplied senderId/username
        const authenticatedUser = socket.data.user;
        const senderId = authenticatedUser.id;
        const username = authenticatedUser.name;
        const { roomId, text, image } = message.data;

        const messageData = {
          roomId,
          senderId,
          username,
          text,
        };

        const formattedMessage = formatMessage(messageData);
        (formattedMessage as any).roomId = roomId;

        // Broadcast to everyone else in the room (avoid echo to sender to prevent duplicate on client)
        socket.to(roomId).emit("message", formattedMessage);

        // Persist to DB
        await prisma.chatMessage.create({
          data: {
            senderId: senderId,
            roomId: roomId,
            message: text,
            messageType: image ? "IMAGE" : "TEXT",
            imageUrl: image || null,
            receiverId: null, // Room messages don't have a specific receiver
          },
        });
      } catch (error) {
        console.error("Error in roomMessage:", error);
        socket.emit("error", "Failed to send message");
      }
    }
  );
}
