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
        const { userId, username, roomId } = message.data;

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
        let { senderId, username, roomId, text, image } = message.data;

        if (!senderId && username) {
          const user = await prisma.user.findFirst({
            where: { name: { equals: username, mode: "insensitive" } },
            select: { id: true },
          });
          if (user) senderId = user.id;
        }

        if (!senderId) {
          socket.emit("error", "Missing senderId for room message");
          return;
        }

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
