import { Request, Response } from "express";
import { ApiError } from "../utils/ApiError";
import prisma from "../utils/prismClient";
import { UserInRequest } from "../utils/helper";
import axios from "axios";
import { ApiResponse } from "../utils/ApiResponse";

/** Validate that a string is a well-formed UUID (v4 or any RFC-4122 variant). */
const isValidUUID = (value: string): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

// use shared prisma client from utils/prismClient

// Controller to get messages for a room (city chat)
export const getRoomMessages = async (req: Request, res: Response) => {
  try {
    const { roomId } = (req as any).params;
    const { cursor, limit = 50 } = req.query;
    const userId = (req as any).user?.id;

    if (!roomId) {
      return res
        .status(400)
        .json(new ApiError(400, "roomId parameter is missing"));
    }

    if (!userId) {
      return res.status(401).json(new ApiError(401, "User not authenticated"));
    }

    const room = await prisma.room.findFirst({
      where: {
        id: roomId,
        members: {
          some: {
            id: userId,
          },
        },
      },
    });

    if (!room) {
      return res
        .status(403)
        .json(new ApiError(403, "You are not a member of this room"));
    }

    const messages = await prisma.chatMessage.findMany({
      where: {
        roomId: roomId,
        receiverId: null,
        ...(cursor ? { id: { lt: cursor as string } } : {}),
      },
      select: {
        id: true,
        message: true,
        messageType: true,
        imageUrl: true,
        timestamp: true,
        sender: {
          select: {
            id: true,
            name: true,
            profilePicture: true,
            role: true,
          },
        },
      },
      orderBy: {
        timestamp: "desc",
      },
      take: Number(limit) + 1,
    });

    const hasMore = messages.length > Number(limit);
    const resultMessages = hasMore ? messages.slice(0, -1) : messages;
    const nextCursor = hasMore ? resultMessages[resultMessages.length - 1].id : null;

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          messages: resultMessages.reverse(),
          pagination: {
            nextCursor,
            hasMore,
            limit: Number(limit),
          },
        },
        "Room messages fetched successfully"
      )
    );
  } catch (error) {
    console.error("Error fetching room messages:", error);
    return res
      .status(500)
      .json(new ApiError(500, "Failed to fetch room messages", [error]));
  }
};

// Controller to get messages for a direct message chat (1-on-1)
export const getDmMessages = async (req: Request, res: Response) => {
  try {
    const { roomId } = (req as any).params;
    const { page = 1, limit = 50 } = req.query;
    const userId = (req as any).user?.id;

    if (!roomId) {
      return res
        .status(400)
        .json(new ApiError(400, "Room ID parameter is missing"));
    }

    if (!userId) {
      return res.status(401).json(new ApiError(401, "User not authenticated"));
    }

    // For DMs, we need to find the other user from the roomId pattern
    // roomId format is typically "user1_user2" (sorted alphabetically)
    const userIds = roomId.split("_");

    // Enforce that the roomId contains exactly two UUIDs
    if (userIds.length !== 2 || !isValidUUID(userIds[0]) || !isValidUUID(userIds[1])) {
      return res.status(400).json(new ApiError(400, "Invalid DM room ID format"));
    }

    // Authorization: requesting user must be one of the two participants
    if (!userIds.includes(userId)) {
      return res
        .status(403)
        .json(new ApiError(403, "You are not authorized to access this conversation"));
    }

    const otherUserId = userIds.find((id: string) => id !== userId) as string;

    // Verify the other participant actually exists
    const otherUser = await prisma.user.findUnique({ where: { id: otherUserId }, select: { id: true } });
    if (!otherUser) {
      return res.status(404).json(new ApiError(404, "The other user does not exist"));
    }

    // Verify user is part of this DM conversation
    const dmMessages = await prisma.chatMessage.findMany({
      where: {
        roomId: null, // DMs don't use room IDs
        receiverId: { not: null }, // DM messages have a specific receiver
        OR: [
          { senderId: userId, receiverId: otherUserId },
          { senderId: otherUserId, receiverId: userId },
        ],
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            profilePicture: true,
            role: true,
          },
        },
        receiver: {
          select: {
            id: true,
            name: true,
            profilePicture: true,
            role: true,
          },
        },
      },
      orderBy: {
        timestamp: "asc",
      },
    });

    if (dmMessages.length === 0) {
      return res
        .status(403)
        .json(new ApiError(403, "You are not part of this conversation"));
    }

    const skip = (Number(page) - 1) * Number(limit);
    const totalMessages = dmMessages.length;
    const paginatedMessages = dmMessages.slice(skip, skip + Number(limit));

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          messages: paginatedMessages,
          pagination: {
            page: Number(page),
            limit: Number(limit),
            total: totalMessages,
            totalPages: Math.ceil(totalMessages / Number(limit)),
          },
        },
        "DM messages fetched successfully"
      )
    );
  } catch (error) {
    console.error("Error fetching DM messages:", error);
    return res
      .status(500)
      .json(new ApiError(500, "Failed to fetch DM messages", [error]));
  }
};

// Controller to get 1-on-1 chat history between two users
export const getOneOnOneChatHistory = async (req: Request, res: Response) => {
  try {
    const { otherUserId } = (req as any).params;
    const { cursor, limit = 50 } = req.query;
    const userId = (req as any).user?.id;

    if (!otherUserId) {
      return res
        .status(400)
        .json(new ApiError(400, "otherUserId parameter is missing"));
    }

    if (!userId) {
      return res.status(401).json(new ApiError(401, "User not authenticated"));
    }

    // Validate otherUserId is a properly formatted UUID to prevent enumeration
    if (!isValidUUID(otherUserId)) {
      return res
        .status(400)
        .json(new ApiError(400, "Invalid otherUserId format: must be a valid UUID"));
    }

    if (userId === otherUserId) {
      return res
        .status(400)
        .json(new ApiError(400, "Cannot chat with yourself"));
    }

    const messages = await prisma.chatMessage.findMany({
      where: {
        receiverId: { not: null },
        OR: [
          {
            senderId: userId,
            receiverId: otherUserId,
          },
          {
            senderId: otherUserId,
            receiverId: userId,
          },
        ],
        ...(cursor ? { id: { lt: cursor as string } } : {}),
      },
      select: {
        id: true,
        message: true,
        messageType: true,
        imageUrl: true,
        timestamp: true,
        sender: {
          select: {
            id: true,
            name: true,
            profilePicture: true,
            role: true,
          },
        },
        receiver: {
          select: {
            id: true,
            name: true,
            profilePicture: true,
            role: true,
          },
        },
      },
      orderBy: {
        timestamp: "desc",
      },
      take: Number(limit) + 1,
    });

    const hasMore = messages.length > Number(limit);
    const resultMessages = hasMore ? messages.slice(0, -1) : messages;
    const nextCursor = hasMore ? resultMessages[resultMessages.length - 1].id : null;

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          messages: resultMessages.reverse(),
          pagination: {
            nextCursor,
            hasMore,
            limit: Number(limit),
          },
        },
        "1-on-1 chat history fetched successfully"
      )
    );
  } catch (error) {
    console.error("Error fetching 1-on-1 chat history:", error);
    return res
      .status(500)
      .json(new ApiError(500, "Failed to fetch chat history", [error]));
  }
};

// Controller to get city-based room chat history
export const getCityChatHistory = async (req: Request, res: Response) => {
  try {
    const { cityName } = (req as any).params;
    const { page = 1, limit = 50 } = req.query;
    const userId = (req as any).user?.id;

    if (!cityName) {
      return res
        .status(400)
        .json(new ApiError(400, "cityName parameter is missing"));
    }

    if (!userId) {
      return res.status(401).json(new ApiError(401, "User not authenticated"));
    }

    // Find or create room for the city
    let room = await prisma.room.findFirst({
      where: {
        name: cityName,
      },
      include: {
        members: true,
      },
    });

    if (!room) {
      // Create room for the city if it doesn't exist
      room = await prisma.room.create({
        data: {
          name: cityName,
          members: {
            connect: { id: userId },
          },
        },
        include: {
          members: true,
        },
      });
    } else {
      // Add user to room if not already a member
      const isMember = room.members.some((member: { id: string }) => member.id === userId);
      if (!isMember) {
        await prisma.room.update({
          where: { id: room.id },
          data: {
            members: {
              connect: { id: userId },
            },
          },
        });
      }
    }

    const skip = (Number(page) - 1) * Number(limit);

    // Fetch messages for the city room
    const messages = await prisma.chatMessage.findMany({
      where: {
        roomId: room.id,
        receiverId: null, // Room messages don't have a specific receiver
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            profilePicture: true,
            role: true,
          },
        },
      },
      orderBy: {
        timestamp: "asc",
      },
      skip,
      take: Number(limit),
    });

    const totalMessages = await prisma.chatMessage.count({
      where: {
        roomId: room.id,
        receiverId: null,
      },
    });

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          messages,
          room: {
            id: room.id,
            name: room.name,
          },
          pagination: {
            page: Number(page),
            limit: Number(limit),
            total: totalMessages,
            totalPages: Math.ceil(totalMessages / Number(limit)),
          },
        },
        "City chat history fetched successfully"
      )
    );
  } catch (error) {
    console.error("Error fetching city chat history:", error);
    return res
      .status(500)
      .json(new ApiError(500, "Failed to fetch city chat history", [error]));
  }
};

// Controller to get all DM conversations for a doctor
export const getDoctorDmConversations = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    // console.log("Doctor DM Conversations - User ID:", userId);
    // console.log("Doctor DM Conversations - User Role:", (req as any).user?.role);

    if (!userId) {
      return res.status(401).json(new ApiError(401, "User not authenticated"));
    }

    // Get all unique conversations where the user is either sender or receiver
    const conversations = await prisma.chatMessage.findMany({
      where: {
        roomId: null, // Only DM messages
        receiverId: { not: null },
        OR: [{ senderId: userId }, { receiverId: userId }],
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            profilePicture: true,
            role: true,
            patient: {
              select: {
                id: true,
                medicalHistory: true,
              },
            },
            doctor: {
              select: {
                id: true,
                specialty: true,
                clinicLocation: true,
              },
            },
          },
        },
        receiver: {
          select: {
            id: true,
            name: true,
            profilePicture: true,
            role: true,
            patient: {
              select: {
                id: true,
                medicalHistory: true,
              },
            },
            doctor: {
              select: {
                id: true,
                specialty: true,
                clinicLocation: true,
              },
            },
          },
        },
      },
      orderBy: {
        timestamp: "desc",
      },
    });

    // Group conversations by the other user
    const conversationMap = new Map();

    conversations.forEach((message: any) => {
      const otherUser =
        message.senderId === userId ? message.receiver : message.sender;
      const conversationKey = otherUser?.id;

      if (conversationKey && !conversationMap.has(conversationKey)) {
        conversationMap.set(conversationKey, {
          otherUser,
          lastMessage: message,
          unreadCount: 0, // You can implement unread count logic later
        });
      }
    });

    const conversationList = Array.from(conversationMap.values());

    // console.log("Found conversations:", conversationList.length);
    // console.log("Conversation details:", conversationList);

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          conversations: conversationList,
        },
        "Doctor DM conversations fetched successfully"
      )
    );
  } catch (error) {
    console.error("Error fetching doctor DM conversations:", error);
    return res
      .status(500)
      .json(new ApiError(500, "Failed to fetch DM conversations", [error]));
  }
};

// Controller to get all DM conversations for a patient
export const getPatientDmConversations = async (
  req: Request,
  res: Response
) => {
  try {
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json(new ApiError(401, "User not authenticated"));
    }

    // Get all unique conversations where the user is either sender or receiver
    const conversations = await prisma.chatMessage.findMany({
      where: {
        roomId: null, // Only DM messages
        receiverId: { not: null },
        OR: [{ senderId: userId }, { receiverId: userId }],
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            profilePicture: true,
            role: true,
            patient: {
              select: {
                id: true,
                medicalHistory: true,
              },
            },
            doctor: {
              select: {
                id: true,
                specialty: true,
                clinicLocation: true,
              },
            },
          },
        },
        receiver: {
          select: {
            id: true,
            name: true,
            profilePicture: true,
            role: true,
            patient: {
              select: {
                id: true,
                medicalHistory: true,
              },
            },
            doctor: {
              select: {
                id: true,
                specialty: true,
                clinicLocation: true,
              },
            },
          },
        },
      },
      orderBy: {
        timestamp: "desc",
      },
    });

    // Group conversations by the other user
    const conversationMap = new Map();

    conversations.forEach((message: any) => {
      const otherUser =
        message.senderId === userId ? message.receiver : message.sender;
      const conversationKey = otherUser?.id;

      if (conversationKey && !conversationMap.has(conversationKey)) {
        conversationMap.set(conversationKey, {
          otherUser,
          lastMessage: message,
          unreadCount: 0, // You can implement unread count logic later
        });
      }
    });

    const conversationList = Array.from(conversationMap.values());

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          conversations: conversationList,
        },
        "Patient DM conversations fetched successfully"
      )
    );
  } catch (error) {
    console.error("Error fetching patient DM conversations:", error);
    return res
      .status(500)
      .json(new ApiError(500, "Failed to fetch DM conversations", [error]));
  }
};

export const getToken = async (req: Request, res: Response) => {
  try {
    const apiKey = process.env.VIDEOSDK_API_KEY;

    if (!apiKey) {
      res.status(500).json(new ApiError(500, "Missing VIDEOSDK_API_KEY"));
      return;
    }

    const response = await axios.post(
      "https://api.videosdk.live/v2/token",
      {},
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
      }
    );

    res.status(200).json(
      new ApiResponse(200, {
        roomId: response.data.roomId,
        token: process.env.VIDEOSDK_API_KEY,
      })
    );
    return;
  } catch (err) {
    res.status(500).json(new ApiError(500, "Failed to create room", [err]));
    return;
  }
};
