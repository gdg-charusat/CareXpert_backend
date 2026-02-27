import { Server, Socket } from "socket.io";
import { formatMessage } from "./utils";
import prisma from "../utils/prismClient";
import { uploadToCloudinary } from "../utils/cloudinary";
interface DmMessageData {
  roomId: string;
  senderId: string;
  receiverId: string;
  username: string;
  text: string;
  image?: string;
}

export function handleDmSocket(io: Server, socket: Socket) {
  socket.on("joinDmRoom", async (roomId: string) => {
    try {
      // const { roomId } = message;
      socket.join(roomId);

      // const clients = await io.in(roomId).allSockets();
      // // console.log(`${socket.id} joined room ${roomId}`);
      // console.log(`Room ${roomId} has ${clients.size} user(s)`);

      // if (clients.size === 2) {
      //   // Notify both users that chat is ready
      //   io.to(roomId).emit("bothUsersJoined", { roomId });
      // }
    } catch (error) {
      console.error("Error in joinDmRoom:", error);
      socket.emit("error", "Failed to join DM room");
    }
  });

  socket.on(
    "dmMessage",
    async (message: { event: string; data: DmMessageData }) => {
      try {
        // Use verified identity from authenticated socket instead of client-supplied senderId/username
        const authenticatedUser = socket.data.user;
        const senderId = authenticatedUser.id;
        const username = authenticatedUser.name;
        const { roomId, receiverId, text, image } = message.data;
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
        console.log("DM Message Data:", {
          senderId,
          receiverId,
          roomId,
          message: text,
          messageType: image ? "IMAGE" : "TEXT",
        });

        io.to(roomId).emit("message", formattedMessage);

        const savedMessage = await prisma.chatMessage.create({
          data: {
            senderId: senderId,
            receiverId: receiverId,
            roomId: null, // DMs don't use room IDs, they use sender/receiver relationship
            message: text,
            messageType: image ? "IMAGE" : "TEXT",
            imageUrl: image ? formattedMessage.imageUrl : null,
          },
        });

        console.log("DM Message saved successfully:", savedMessage.id);
      } catch (error) {
        console.error("Error in dmMessage:", error);
        socket.emit("error", "Failed to send DM message");
      }
    }
  );
}
