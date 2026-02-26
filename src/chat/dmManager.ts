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
      
      socket.join(roomId);

    } catch (error) {
      console.error("Error in joinDmRoom:", error);
      socket.emit("error", "Failed to join DM room");
    }
  });

  socket.on(
    "dmMessage",
    async (message: { event: string; data: DmMessageData }) => {
      try {
        const { roomId, senderId, receiverId, username, text, image } =
          message.data;
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
            roomId: null, 
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
