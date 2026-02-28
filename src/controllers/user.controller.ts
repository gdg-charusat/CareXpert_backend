import { ApiError } from "../utils/ApiError";
import { ApiResponse } from "../utils/ApiResponse";
import prisma from "../utils/prismClient";
import bcrypt from "bcrypt";
import { Response, NextFunction } from "express";
import { generateAccessToken, generateRefreshToken } from "../utils/jwt";
import { Role } from "@prisma/client";
import { Request } from "express";
import { hash } from "crypto";
import { isValidUUID, generateSecureToken } from "../utils/helper";
import { TimeSlotStatus, AppointmentStatus } from "@prisma/client";
import { AppError } from "../utils/AppError";
import {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendPasswordResetConfirmationEmail,
} from "../utils/emailService";
import jwt from "jsonwebtoken";

const generateToken = async (userId: string, tokenVersion: number = 0) => {
  try {
    const accessToken = generateAccessToken(userId, tokenVersion);
    const refreshToken = generateRefreshToken(userId, tokenVersion);

    await prisma.user.update({
      where: { id: userId },
      data: { refreshToken },
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

    // Generate email verification token
    const emailVerificationToken = generateSecureToken();
    const tokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    const result = await prisma.$transaction(async (prisma) => {
      const user = await prisma.user.create({
        data: {
          name: name.toLowerCase(),
          email,
          password: hashedPassword,
          role,
          profilePicture:
            "https://res.cloudinary.com/de930by1y/image/upload/v1747403920/careXpert_profile_pictures/kxwsom57lcjamzpfjdod.jpg",
          isEmailVerified: false,
          emailVerificationToken,
          tokenExpiresAt,
          lastVerificationEmailSent: new Date(),
        },
      });

      if (role === "DOCTOR") {
        await prisma.doctor.create({
          data: {
            userId: user.id,
            specialty,
            clinicLocation,
          },
        });

        // Auto-join doctor to city room based on clinic location
        if (clinicLocation) {
          let cityRoom = await prisma.room.findFirst({
            where: { name: clinicLocation },
          });

          if (!cityRoom) {
            cityRoom = await prisma.room.create({
              data: { name: clinicLocation },
            });
          }

          // Add user to the city room
          await prisma.room.update({
            where: { id: cityRoom.id },
            data: {
              members: {
                connect: { id: user.id },
              },
            },
          });
        }
      } else {
        await prisma.patient.create({
          data: { 
            userId: user.id,
            location: location || null,
          },
        });

        // Auto-join patient to city room based on location
        if (location) {
          let cityRoom = await prisma.room.findFirst({
            where: { name: location },
          });

          if (!cityRoom) {
            cityRoom = await prisma.room.create({
              data: { name: location },
            });
          }

          // Add user to the city room
          await prisma.room.update({
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

    // Send verification email (async, don't block signup)
    try {
      await sendVerificationEmail(email, name, emailVerificationToken);
    } catch (emailError) {
      console.error("Failed to send verification email:", emailError);
      // Don't fail signup if email fails
    }

    return res
      .status(200)
      .json(new ApiResponse(200, { user: result }, "Signup successful. Please check your email to verify your account."));
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

    const result = await prisma.$transaction(async (prisma) => {
      // Create the user
      const user = await prisma.user.create({
        data: {
          name: name.toLowerCase(),
          email,
          password: hashedPassword,
          role: "ADMIN",
          profilePicture:
            "https://res.cloudinary.com/de930by1y/image/upload/v1747403920/careXpert_profile_pictures/kxwsom57lcjamzpfjdod.jpg",
        },
      });

      // Create the admin record
      const admin = await prisma.admin.create({
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
          { ...user, accessToken, refreshToken },
          "Login successfully"
        )
      );
  } catch (err) {
    return res.status(500).json(new ApiError(500, "Internal server error"));
  }
};

const logout = async (req: any, res: any) => {
  try {
    const id = (req as any).user.id;

    await prisma.user.update({
      where: { id },
      data: { refreshToken: "" },
    });

    const options = {
      httpOnly: true,
      secure: true,
    };

    return res
      .status(200)
      .clearCookie("accessToken", options)
      .clearCookie("refresToken", options)
      .json(new ApiResponse(200, "Logout successfully"));
  } catch (err) {
    return res.status(500).json(new ApiError(500, "internal server error"));
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
            refreshToken: true,
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
            refreshToken: true,
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
        refreshToken: true,
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
        refreshToken: true,
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
          "User profile fetched successfully"
        )
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
      orderBy: { createdAt: 'desc' },
      skip: (Number(page) - 1) * Number(limit),
      take: Number(limit),
    });

    const total = await prisma.notification.count({
      where: { userId },
    });

    res.status(200).json(
      new ApiResponse(200, {
        notifications,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / Number(limit)),
        },
      }, "Notifications fetched successfully")
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

    res.status(200).json(
      new ApiResponse(200, { unreadCount }, "Unread count fetched successfully")
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

    res.status(200).json(
      new ApiResponse(200, {}, "Notification marked as read")
    );
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

    res.status(200).json(
      new ApiResponse(200, {}, "All notifications marked as read")
    );
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

    const members = room.members.map(member => ({
      id: member.id,
      name: member.name,
      email: member.email,
      profilePicture: member.profilePicture,
      role: member.role,
      location: member.patient?.location || member.doctor?.clinicLocation || null,
      specialty: member.doctor?.specialty || null,
      joinedAt: member.createdAt,
    }));

    res.status(200).json(
      new ApiResponse(200, {
        room: {
          id: room.id,
          name: room.name,
          createdAt: room.createdAt,
        },
        members,
        totalMembers: members.length,
      }, "Community members fetched successfully")
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
      res.status(400).json(new ApiError(400, "User is already a member of this community"));
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

    res.status(200).json(
      new ApiResponse(200, {}, "Successfully joined the community")
    );
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

    res.status(200).json(
      new ApiResponse(200, {}, "Successfully left the community")
    );
  } catch (error) {
    console.error("Error leaving community:", error);
    res.status(500).json(new ApiError(500, "Internal server error", [error]));
  }
};

// ============================================
// EMAIL VERIFICATION & PASSWORD RESET
// ============================================

/**
 * Verify email with token
 */
const verifyEmail = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { token } = req.query;

    if (!token || typeof token !== "string") {
      return next(new AppError("Verification token is required", 400));
    }

    const user = await prisma.user.findFirst({
      where: {
        emailVerificationToken: token,
        tokenExpiresAt: { gt: new Date() },
      },
    });

    if (!user) {
      return next(new AppError("Invalid or expired verification token", 400));
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        isEmailVerified: true,
        emailVerificationToken: null,
        tokenExpiresAt: null,
      },
    });

    res.status(200).json(new ApiResponse(200, null, "Email verified successfully"));
  } catch (error) {
    console.error("Error verifying email:", error);
    return next(new AppError("Failed to verify email", 500));
  }
};

/**
 * Resend verification email
 */
const resendVerificationEmail = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { email } = req.body;

    if (!email) {
      return next(new AppError("Email is required", 400));
    }

    const user = await prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
    });

    if (!user) {
      // Don't reveal if user exists
      res.status(200).json(new ApiResponse(200, null, "If an account exists, a verification email has been sent"));
      return;
    }

    if (user.isEmailVerified) {
      return next(new AppError("Email is already verified", 400));
    }

    // Check rate limit for resend (1 minute cooldown)
    if (user.lastVerificationEmailSent) {
      const timeSinceLastEmail = Date.now() - user.lastVerificationEmailSent.getTime();
      if (timeSinceLastEmail < 60000) { // 1 minute
        return next(new AppError("Please wait before requesting another verification email", 429));
      }
    }

    // Generate new token
    const emailVerificationToken = generateSecureToken();
    const tokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerificationToken,
        tokenExpiresAt,
        lastVerificationEmailSent: new Date(),
      },
    });

    // Send verification email
    try {
      await sendVerificationEmail(user.email, user.name, emailVerificationToken);
    } catch (emailError) {
      console.error("Failed to send verification email:", emailError);
      return next(new AppError("Failed to send verification email", 500));
    }

    res.status(200).json(new ApiResponse(200, null, "Verification email sent successfully"));
  } catch (error) {
    console.error("Error resending verification email:", error);
    return next(new AppError("Failed to resend verification email", 500));
  }
};

/**
 * Request password reset
 */
const forgotPassword = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { email } = req.body;

    if (!email) {
      return next(new AppError("Email is required", 400));
    }

    const user = await prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
    });

    // Always return success to prevent email enumeration
    if (!user) {
      res.status(200).json(new ApiResponse(200, null, "If an account exists with this email, a password reset link has been sent"));
      return;
    }

    // Generate password reset token
    const passwordResetToken = generateSecureToken();
    const passwordResetExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken,
        passwordResetExpiry,
      },
    });

    // Send password reset email
    try {
      await sendPasswordResetEmail(user.email, user.name, passwordResetToken);
    } catch (emailError) {
      console.error("Failed to send password reset email:", emailError);
      return next(new AppError("Failed to send password reset email", 500));
    }

    res.status(200).json(new ApiResponse(200, null, "If an account exists with this email, a password reset link has been sent"));
  } catch (error) {
    console.error("Error in forgot password:", error);
    return next(new AppError("Failed to process password reset request", 500));
  }
};

/**
 * Reset password with token
 */
const resetPassword = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return next(new AppError("Token and new password are required", 400));
    }

    if (newPassword.length < 8) {
      return next(new AppError("Password must be at least 8 characters long", 400));
    }

    const user = await prisma.user.findFirst({
      where: {
        passwordResetToken: token,
        passwordResetExpiry: { gt: new Date() },
      },
    });

    if (!user) {
      return next(new AppError("Invalid or expired password reset token", 400));
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update user: set new password, clear reset token, increment tokenVersion
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        passwordResetToken: null,
        passwordResetExpiry: null,
        tokenVersion: { increment: 1 }, // Invalidate all existing sessions
      },
    });

    // Send confirmation email
    try {
      await sendPasswordResetConfirmationEmail(user.email, user.name);
    } catch (emailError) {
      console.error("Failed to send password reset confirmation email:", emailError);
    }

    res.status(200).json(new ApiResponse(200, null, "Password reset successful"));
  } catch (error) {
    console.error("Error in reset password:", error);
    return next(new AppError("Failed to reset password", 500));
  }
};

/**
 * Refresh access token
 */
const refreshAccessToken = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return next(new AppError("Refresh token is required", 400));
    }

    // Verify refresh token
    let decoded: any;
    try {
      decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET as string);
    } catch (err) {
      return next(new AppError("Invalid or expired refresh token", 401));
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
    });

    if (!user) {
      return next(new AppError("User not found", 404));
    }

    // Check if refresh token matches and tokenVersion is valid
    if (user.refreshToken !== refreshToken) {
      return next(new AppError("Invalid refresh token", 401));
    }

    if (decoded.tokenVersion !== undefined && decoded.tokenVersion !== user.tokenVersion) {
      return next(new AppError("Token has been invalidated", 401));
    }

    // Generate new tokens
    const tokens = await generateToken(user.id, user.tokenVersion);

    res.status(200).json(new ApiResponse(200, tokens, "Token refreshed successfully"));
  } catch (error) {
    console.error("Error refreshing token:", error);
    return next(new AppError("Failed to refresh token", 500));
  }
};

export {
  signup,
  adminSignup,
  login,
  logout,
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
  verifyEmail,
  resendVerificationEmail,
  forgotPassword,
  resetPassword,
  refreshAccessToken,
};
