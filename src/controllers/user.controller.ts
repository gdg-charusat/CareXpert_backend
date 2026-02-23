import { ApiError } from "../utils/ApiError";
import { ApiResponse } from "../utils/ApiResponse";
import prisma from "../utils/prismClient";
import bcrypt from "bcrypt";
import { Response } from "express";
import { generateAccessToken, generateRefreshToken } from "../utils/jwt";
import { Prisma } from "@prisma/client";
import { Request } from "express";
import { hash } from "crypto";
import { isValidUUID, validatePassword } from "../utils/helper";
import { TimeSlotStatus, AppointmentStatus } from "@prisma/client";
import jwt from "jsonwebtoken";

const generateToken = async (userId: string) => {
  try {
    // Increment tokenVersion to invalidate any previously issued tokens
    const user = await prisma.user.update({
      where: { id: userId },
      data: { tokenVersion: { increment: 1 } },
      select: { tokenVersion: true },
    });

    const accessToken = generateAccessToken(userId, user.tokenVersion);
    const refreshToken = generateRefreshToken(userId, user.tokenVersion);

    const hashedRefresh = await bcrypt.hash(refreshToken, 10);

    await prisma.user.update({
      where: { id: userId },
      data: { refreshToken: hashedRefresh },
    });

    return { accessToken, refreshToken };
  } catch (err) {
    throw new ApiError(500, "Error in generating token");
  }
};

// Using Request type from Express with proper typing

const signup = async (req: Request, res: any) => {
  const {
    firstName,
    lastName,
    email,
    password,
    role,
    specialty,
    clinicLocation,
    location, // Patient location
  } = req.body;

  const name = `${firstName || ""} ${lastName || ""}`.trim();

  if (
    !name ||
    !email ||
    !password ||
    name === "" ||
    email.trim() === "" ||
    password.trim() === ""
  ) {
    return res
      .status(400)
      .json(new ApiError(400, "Name, email, and password are required"));
  }
  if (role === "DOCTOR") {
    if (
      !specialty ||
      !clinicLocation ||
      specialty.trim() === "" ||
      clinicLocation.trim() === ""
    ) {
      return res
        .status(400)
        .json(new ApiError(400, "All doctor fields are required"));
    }
  } else if (role === "PATIENT") {
    if (!location || location.trim() === "") {
      return res
        .status(400)
        .json(new ApiError(400, "Location is required for patients"));
    }
  }

  // Validate password strength
  const passwordValidation = validatePassword(password);
  if (!passwordValidation.isValid) {
    return res
      .status(400)
      .json(new ApiError(400, passwordValidation.message || "Invalid password"));
  }

  try {
    let existingUser = await prisma.user.findFirst({
      where: { name },
    });

    if (existingUser) {
      return res.status(409).json(new ApiError(409, "Username already taken"));
    }

    existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return res.status(409).json(new ApiError(409, "User already exists"));
    }
    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const user = await tx.user.create({
        data: {
          name: name.toLowerCase(),
          email,
          password: hashedPassword,
          role,
          profilePicture: null,
        },
      });

      if (role === "DOCTOR") {
        await tx.doctor.create({
          data: {
            userId: user.id,
            specialty,
            clinicLocation,
          },
        });

        // Auto-join doctor to city room based on clinic location
        if (clinicLocation) {
          let cityRoom = await tx.room.findFirst({
            where: { name: clinicLocation },
          });

          if (!cityRoom) {
            cityRoom = await tx.room.create({
              data: { name: clinicLocation },
            });
          }

          // Add user to the city room
          await tx.room.update({
            where: { id: cityRoom.id },
            data: {
              members: {
                connect: { id: user.id },
              },
            },
          });
        }
      } else {
        await tx.patient.create({
          data: { 
            userId: user.id,
            location: location || null,
          },
        });

        // Auto-join patient to city room based on location
        if (location) {
          let cityRoom = await tx.room.findFirst({
            where: { name: location },
          });

          if (!cityRoom) {
            cityRoom = await tx.room.create({
              data: { name: location },
            });
          }

          // Add user to the city room
          await tx.room.update({
            where: { id: cityRoom.id },
            data: {
              members: {
                connect: { id: user.id },
              },
            },
          });
        }
      }

      return user;
    });

    return res
      .status(200)
      .json(new ApiResponse(200, { user: result }, "Signup successful"));
  } catch (err) {
    console.error(err);
    return res
      .status(500)
      .json(new ApiError(500, "Internal server error", [err]));
  }
};

const adminSignup = async (req: Request, res: any) => {
  const { firstName, lastName, email, password } = req.body;

  const name = `${firstName || ""} ${lastName || ""}`.trim();

  if (
    !name ||
    !email ||
    !password ||
    name === "" ||
    email.trim() === "" ||
    password.trim() === ""
  ) {
    return res
      .status(400)
      .json(new ApiError(400, "Name, email, and password are required"));
  }

  // Validate password strength
  const passwordValidation = validatePassword(password);
  if (!passwordValidation.isValid) {
    return res
      .status(400)
      .json(new ApiError(400, passwordValidation.message || "Invalid password"));
  }

  try {
    let existingUser = await prisma.user.findFirst({
      where: { name },
    });

    if (existingUser) {
      return res.status(409).json(new ApiError(409, "Username already taken"));
    }

    existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return res.status(409).json(new ApiError(409, "User already exists"));
    }
    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Create the user
      const user = await tx.user.create({
        data: {
          name: name.toLowerCase(),
          email,
          password: hashedPassword,
          role: "ADMIN",
          profilePicture: null,
        },
      });

      // Create the admin record
      const admin = await tx.admin.create({
        data: {
          userId: user.id,
          permissions: {
            canManageUsers: true,
            canManageDoctors: true,
            canManagePatients: true,
            canViewAnalytics: true,
            canManageSystem: true,
          },
        },
      });

      return { user, admin };
    });

    return res
      .status(200)
      .json(
        new ApiResponse(200, { user: result.user }, "Admin signup successful")
      );
  } catch (err) {
    console.error(err);
    return res
      .status(500)
      .json(new ApiError(500, "Internal server error", [err]));
  }
};

const login = async (req: any, res: any) => {
  const { data, password } = req.body;
  try {
    if (!data) {
      return res.json(new ApiError(400, "username or email is required"));
    }
    if ([password, data].some((field) => field.trim() === "")) {
      return res.json(new ApiError(400, "All field required"));
    }

    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: { equals: data, mode: "insensitive" } },
          { name: { equals: data, mode: "insensitive" } },
        ],
      },
    });

    if (!user) {
      return res
        .status(401)
        .json(new ApiError(401, "Invalid username or password"));
    }

    if (user.deletedAt) {
      return res
        .status(403)
        .json(new ApiError(403, "This account has been deactivated. Please contact support."));
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res
        .status(401)
        .json(new ApiError(401, "Invalid username or password"));
    }

    const { accessToken, refreshToken } = await generateToken(user.id);

    // const {password , ...loggedInUser} = user;

    const options = {
      httpOnly: true, //only modified by server
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const, // Added SameSite policy
    };

    return res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", refreshToken, options)
      .json(
        new ApiResponse(
          200,
          {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            profilePicture: user.profilePicture,
            accessToken,
          },
          "Login successfully",
        ),
      );
  } catch (err) {
    return res.status(500).json(new ApiError(500, "Internal server error"));
  }
};

const logout = async (req: any, res: any) => {
  try {
    const id = (req as any).user.id;

    // Increment tokenVersion to invalidate all existing tokens and clear stored refresh token
    await prisma.user.update({
      where: { id },
      data: {
        refreshToken: "",
        tokenVersion: { increment: 1 },
      },
    });

    const options = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const, // Added SameSite policy
    };

    return res
      .status(200)
      .clearCookie("accessToken", options)
      .clearCookie("refreshToken", options)
      .json(new ApiResponse(200, "Logout successfully"));
  } catch (err) {
    return res.status(500).json(new ApiError(500, "internal server error"));
  }
};

const refreshAccessToken = async (req: any, res: any) => {
  try {
    const incomingRefreshToken =
      req.cookies?.refreshToken || req.body?.refreshToken;

    if (!incomingRefreshToken) {
      return res
        .status(401)
        .json(new ApiError(401, "Refresh token is required"));
    }

    // Verify the refresh token
    let decoded: any;
    try {
      decoded = jwt.verify(
        incomingRefreshToken,
        process.env.REFRESH_TOKEN_SECRET as string
      );
    } catch {
      return res
        .status(401)
        .json(new ApiError(401, "Invalid or expired refresh token"));
    }

    // Validate payload shape
    if (
      !decoded ||
      typeof decoded !== "object" ||
      typeof decoded.userId !== "string" ||
      typeof decoded.tokenVersion !== "number"
    ) {
      return res
        .status(401)
        .json(new ApiError(401, "Invalid token payload"));
    }

    // Find the user and validate token version
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, refreshToken: true, tokenVersion: true },
    });

    if (!user) {
      return res.status(401).json(new ApiError(401, "User not found"));
    }

    // Check if the stored refresh token matches the incoming one
    if (user.refreshToken !== incomingRefreshToken) {
      return res
        .status(401)
        .json(new ApiError(401, "Refresh token has been revoked"));
    }

    // Check if the token version matches — prevents reuse of old tokens
    if (decoded.tokenVersion !== user.tokenVersion) {
      return res
        .status(401)
        .json(new ApiError(401, "Token version mismatch, please login again"));
    }

    // Rotate: generate new tokens with incremented version
    const { accessToken, refreshToken } = await generateToken(user.id);

    const options = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
    };

    return res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", refreshToken, options)
      .json(
        new ApiResponse(
          200,
          { accessToken, refreshToken },
          "Token refreshed successfully"
        )
      );
  } catch (err) {
    return res
      .status(500)
      .json(new ApiError(500, "Internal server error", [err]));
  }
};

const doctorProfile = async (req: Request, res: Response) => {
  try {
    const { id } = (req as any).params;

    if (!id || !isValidUUID(id)) {
      res.status(400).json(new ApiError(400, "Doctor id not found"));
    }

    const doctor = await prisma.doctor.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            name: true,
            email: true,
            profilePicture: true,
            // refreshToken: true,
            createdAt: true,
          },
        },
      },
    });

    res.status(200).json(new ApiResponse(200, doctor));
  } catch (error) {
    res.status(500).json(new ApiError(500, "internal server error", [error]));
    return;
  }
};

const userProfile = async (req: Request, res: Response) => {
  try {
    const { id } = (req as any).params;

    if (!id || !isValidUUID(id)) {
      res.status(400).json(new ApiError(400, "patient id no valid"));
    }

    const patient = await prisma.patient.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            name: true,
            email: true,
            profilePicture: true,
            // refreshToken: true,
            createdAt: true,
          },
        },
      },
    });

    res.status(200).json(new ApiResponse(200, patient));
    return;
  } catch (error) {
    res.status(500).json(new ApiError(500, "Internal server error", [error]));
    return;
  }
};

const updatePatientProfile = async (req: any, res: Response) => {
  try {
    const id = (req as any).user?.id;
    const { name } = req.body;
    const imageUrl = req.file?.path;

    const dataToUpdate: { name?: string; profilePicture?: string } = {};
    if (name) dataToUpdate.name = name;
    if (imageUrl) dataToUpdate.profilePicture = imageUrl;

    const user = await prisma.user.update({
      where: { id },
      data: dataToUpdate,
      select: {
        name: true,
        email: true,
        profilePicture: true,
        role: true,
        // refreshToken: true,
        createdAt: true,
      },
    });

    res
      .status(200)
      .json(new ApiResponse(200, user, "Profile updated successfulyy"));
    return;
  } catch (error) {
    res.status(500).json(new ApiError(500, "Internal server error", [error]));
  }
};

const updateDoctorProfile = async (req: any, res: Response) => {
  try {
    let id = (req as any).user?.doctor?.id;
    const { specialty, clinicLocation, experience, bio, name } = req.body;
    const imageUrl = req.file?.path;

    const doctorData: {
      specialty?: string;
      clinicLocation?: string;
      experience?: string;
      bio?: string;
    } = {};
    if (specialty) doctorData.specialty = specialty;
    if (clinicLocation) doctorData.clinicLocation = clinicLocation;
    if (experience) doctorData.experience = experience;
    if (bio) doctorData.bio = bio;

    const doctor = await prisma.doctor.update({
      where: { id },
      data: doctorData,
    });

    const userData: { name?: string; profilePicture?: string } = {};
    if (name) userData.name = name;
    if (imageUrl) userData.profilePicture = imageUrl;

    id = doctor.userId;
    const user = await prisma.user.update({
      where: { id },
      data: userData,
      select: {
        name: true,
        email: true,
        profilePicture: true,
        role: true,
        // refreshToken: true,
        createdAt: true,
        doctor: true,
      },
    });

    res
      .status(200)
      .json(new ApiResponse(200, user, "profile updated successfulyy"));
    return;
  } catch (error) {
    res.status(500).json(new ApiError(500, "Internal server error", [error]));
    return;
  }
};

const getAuthenticatedUserProfile = async (
  req: any,
  res: Response
): Promise<void> => {
  try {
    const userId = (req as any).user?.id;

    if (!userId) {
      res.status(401).json(new ApiError(401, "User not authenticated"));
      return;
    }

    // 1. Fetch basic user data
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        profilePicture: true,
        createdAt: true,
      },
    });

    if (!user) {
      // This case should ideally not happen if isAuthenticated works correctly
      res.status(404).json(new ApiError(404, "User not found"));
      return;
    }

    let relatedProfileData = null;
    // 2. Conditionally fetch related profile data based on role
    if (user.role === "PATIENT") {
      relatedProfileData = await prisma.patient.findUnique({
        where: { userId: user.id },
        select: { id: true },
      });
    } else if (user.role === "DOCTOR") {
      relatedProfileData = await prisma.doctor.findUnique({
        where: { userId: user.id },
        select: { id: true, specialty: true, clinicLocation: true },
      });
    }

    // 3. Combine user data with related profile data
    const fullUserProfile = {
      ...user,
      ...(relatedProfileData && user.role === "PATIENT"
        ? { patient: relatedProfileData }
        : {}),
      ...(relatedProfileData && user.role === "DOCTOR"
        ? { doctor: relatedProfileData }
        : {}),
    };

    res
      .status(200)
      .json(
        new ApiResponse(
          200,
          fullUserProfile,
          "User profile fetched successfully",
        ),
      );
    return;
  } catch (error) {
    console.error("Error fetching authenticated user profile:", error);
    res.status(500).json(new ApiError(500, "Internal server error", [error]));
    return;
  }
};

// Notifications API
const getNotifications = async (req: any, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const { page = 1, limit = 10 } = req.query;

    const notifications = await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      skip: (Number(page) - 1) * Number(limit),
      take: Number(limit),
    });

    const total = await prisma.notification.count({
      where: { userId },
    });

    res.status(200).json(
      new ApiResponse(
        200,
        {
          notifications,
          pagination: {
            page: Number(page),
            limit: Number(limit),
            total,
            pages: Math.ceil(total / Number(limit)),
          },
        },
        "Notifications fetched successfully",
      ),
    );
  } catch (error) {
    console.error("Error fetching notifications:", error);
    res.status(500).json(new ApiError(500, "Internal server error", [error]));
  }
};

const getUnreadNotificationCount = async (req: any, res: Response) => {
  try {
    const userId = (req as any).user?.id;

    const unreadCount = await prisma.notification.count({
      where: {
        userId,
        isRead: false,
      },
    });

    res
      .status(200)
      .json(
        new ApiResponse(
          200,
          { unreadCount },
          "Unread count fetched successfully",
        ),
      );
  } catch (error) {
    console.error("Error fetching unread count:", error);
    res.status(500).json(new ApiError(500, "Internal server error", [error]));
  }
};

const markNotificationAsRead = async (req: any, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const { notificationId } = req.params;

    const notification = await prisma.notification.updateMany({
      where: {
        id: notificationId,
        userId,
      },
      data: { isRead: true },
    });

    if (notification.count === 0) {
      res.status(404).json(new ApiError(404, "Notification not found"));
      return;
    }

    res
      .status(200)
      .json(new ApiResponse(200, {}, "Notification marked as read"));
  } catch (error) {
    console.error("Error marking notification as read:", error);
    res.status(500).json(new ApiError(500, "Internal server error", [error]));
  }
};

const markAllNotificationsAsRead = async (req: any, res: Response) => {
  try {
    const userId = (req as any).user?.id;

    await prisma.notification.updateMany({
      where: {
        userId,
        isRead: false,
      },
      data: { isRead: true },
    });

    res
      .status(200)
      .json(new ApiResponse(200, {}, "All notifications marked as read"));
  } catch (error) {
    console.error("Error marking all notifications as read:", error);
    res.status(500).json(new ApiError(500, "Internal server error", [error]));
  }
};

// Community API
const getCommunityMembers = async (req: any, res: Response) => {
  try {
    const { roomId } = req.params;

    const room = await prisma.room.findUnique({
      where: { id: roomId },
      include: {
        members: {
          include: {
            patient: {
              select: {
                location: true,
              },
            },
            doctor: {
              select: {
                specialty: true,
                clinicLocation: true,
              },
            },
          },
        },
      },
    });

    if (!room) {
      res.status(404).json(new ApiError(404, "Community not found"));
      return;
    }

    const members = room.members.map((member) => ({
      id: member.id,
      name: member.name,
      email: member.email,
      profilePicture: member.profilePicture,
      role: member.role,
      location:
        member.patient?.location || member.doctor?.clinicLocation || null,
      specialty: member.doctor?.specialty || null,
      joinedAt: member.createdAt,
    }));

    res.status(200).json(
      new ApiResponse(
        200,
        {
          room: {
            id: room.id,
            name: room.name,
            createdAt: room.createdAt,
          },
          members,
          totalMembers: members.length,
        },
        "Community members fetched successfully",
      ),
    );
  } catch (error) {
    console.error("Error fetching community members:", error);
    res.status(500).json(new ApiError(500, "Internal server error", [error]));
  }
};

const joinCommunity = async (req: any, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const { roomId } = req.params;

    const room = await prisma.room.findUnique({
      where: { id: roomId },
    });

    if (!room) {
      res.status(404).json(new ApiError(404, "Community not found"));
      return;
    }

    // Check if user is already a member
    const existingMember = await prisma.room.findFirst({
      where: {
        id: roomId,
        members: {
          some: { id: userId },
        },
      },
    });

    if (existingMember) {
      res
        .status(400)
        .json(new ApiError(400, "User is already a member of this community"));
      return;
    }

    // Add user to the community
    await prisma.room.update({
      where: { id: roomId },
      data: {
        members: {
          connect: { id: userId },
        },
      },
    });

    res
      .status(200)
      .json(new ApiResponse(200, {}, "Successfully joined the community"));
  } catch (error) {
    console.error("Error joining community:", error);
    res.status(500).json(new ApiError(500, "Internal server error", [error]));
  }
};

const leaveCommunity = async (req: any, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const { roomId } = req.params;

    const room = await prisma.room.findUnique({
      where: { id: roomId },
    });

    if (!room) {
      res.status(404).json(new ApiError(404, "Community not found"));
      return;
    }

    // Remove user from the community
    await prisma.room.update({
      where: { id: roomId },
      data: {
        members: {
          disconnect: { id: userId },
        },
      },
    });

    res
      .status(200)
      .json(new ApiResponse(200, {}, "Successfully left the community"));
  } catch (error) {
    console.error("Error leaving community:", error);
    res.status(500).json(new ApiError(500, "Internal server error", [error]));
  }
};

export {
  signup,
  adminSignup,
  login,
  logout,
  refreshAccessToken,
  doctorProfile,
  userProfile,
  updatePatientProfile,
  updateDoctorProfile,
  getAuthenticatedUserProfile,
  getNotifications,
  getUnreadNotificationCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  getCommunityMembers,
  joinCommunity,
  leaveCommunity,
};
