import { AppError } from "../utils/AppError";
import { ApiError } from "../utils/ApiError";
import { ApiResponse } from "../utils/ApiResponse";
import prisma from "../utils/prismClient";
import bcrypt from "bcrypt";
import { Response, NextFunction, Request } from "express";
import jwt from "jsonwebtoken";
import { generateAccessToken, generateRefreshToken } from "../utils/jwt";
import { Prisma } from "@prisma/client";
import { randomBytes } from "crypto";
import { isValidUUID, generateSecureToken, validatePassword } from "../utils/helper";
import { TimeSlotStatus, AppointmentStatus } from "@prisma/client";
import {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendPasswordResetConfirmationEmail,
} from "../utils/emailService";

const generateToken = async (userId: string, tokenVersion: number = 0) => {
  try {
    const accessToken = generateAccessToken(userId, tokenVersion);
    const refreshToken = generateRefreshToken(userId, tokenVersion);

    const hashedRefreshToken = await bcrypt.hash(refreshToken, 10);
    await prisma.user.update({
      where: { id: userId },
      data: { refreshToken: hashedRefreshToken },
    });

    return { accessToken, refreshToken };
  } catch (err) {
    throw new AppError("Error in generating token", 500);
  }
};

const signup = async (req: Request, res: any, next: NextFunction) => {
  const {
    firstName,
    lastName,
    email,
    password,
    role,
    specialty,
    clinicLocation,
    location,
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
    return next(new AppError("Name, email, and password are required", 400));
  }
  if (role === "DOCTOR") {
    if (
      !specialty ||
      !clinicLocation ||
      specialty.trim() === "" ||
      clinicLocation.trim() === ""
    ) {
      return next(new AppError("All doctor fields are required", 400));
    }
  } else if (role === "PATIENT") {
    if (!location || location.trim() === "") {
      return next(new AppError("Location is required for patients", 400));
    }
  }

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
      return next(new AppError("Username already taken", 409));
    }

    existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return next(new AppError("User already exists", 409));
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const emailVerificationToken = generateSecureToken();
    const tokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name: name.toLowerCase(),
          email,
          password: hashedPassword,
          role,
          isEmailVerified: false,
          emailVerificationToken,
          tokenExpiresAt,
          lastVerificationEmailSent: new Date(),
          profilePicture:
            "https://res.cloudinary.com/de930by1y/image/upload/v1747403920/careXpert_profile_pictures/kxwsom57lcjamzpfjdod.jpg",
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

        if (clinicLocation) {
          let cityRoom = await tx.room.findFirst({
            where: { name: clinicLocation },
          });

          if (!cityRoom) {
            cityRoom = await tx.room.create({
              data: { name: clinicLocation },
            });
          }

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

        if (location) {
          let cityRoom = await tx.room.findFirst({
            where: { name: location },
          });

          if (!cityRoom) {
            cityRoom = await tx.room.create({
              data: { name: location },
            });
          }

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



const adminSignup = async (req: Request, res: any, next: NextFunction) => {
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
    return next(new AppError("Name, email, and password are required", 400));
  }

  const passwordValidation = validatePassword(password);
  if (!passwordValidation.isValid) {
    return res
      .status(400)
      .json(new ApiError(400, passwordValidation.message || "Invalid password"));
  }

  // Check if any admin exists for first-admin bootstrap logic
  const adminCount = await prisma.admin.count();
  const isFirstAdmin = adminCount === 0;

  // Secret bypass for initial seeding (only if no admins exist)
  const adminSecret = req.header("X-Admin-Secret");
  const isSecretValid = isFirstAdmin && adminSecret && adminSecret === process.env.ADMIN_SIGNUP_SECRET;

  // If not using secret (or secret is invalid/not allowed), the request must be authenticated by an existing admin
  if (!isSecretValid) {
    if (!req.user || req.user.role !== "ADMIN") {
      return res.status(403).json(new ApiError(403, isFirstAdmin ? "Valid Admin Secret required for first admin" : "Unauthorized: Admin access required"));
    }
  }

  try {
    let existingUser = await prisma.user.findFirst({
      where: { name },
    });

    if (existingUser) {
      return next(new AppError("Username already taken", 409));
    }

    existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return next(new AppError("User already exists", 409));
    }
    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {

      const user = await tx.user.create({
        data: {
          name: name.toLowerCase(),
          email,
          password: hashedPassword,
          role: "ADMIN",
          isEmailVerified: true,
          profilePicture: null,
        },
      });

      const admin = await tx.admin.create({
        data: {
          userId: user.id,
          permissions: {
            canManageUsers: true,
            canManageDoctors: true,
            canManagePatients: true,
            canViewAnalytics: true,
            // allow report access by default for new admin accounts
            canViewReports: true,
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
    return next(err);
  }
};

const login = async (req: any, res: any, next: NextFunction) => {
  const { data, password } = req.body;
  try {
    if (!data) {
      throw new AppError("Username or email is required", 400);
    }
    if (!password) {
      throw new AppError("Password is required", 400);
    }
    if ([password, data].some((field) => field.trim() === "")) {
      throw new AppError("All fields are required", 400);
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
      throw new AppError("Invalid username or password", 401);
    }

    if (user.deletedAt) {
      return res
        .status(403)
        .json(new ApiError(403, "This account has been deactivated. Please contact support."));
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      throw new AppError("Invalid username or password", 401);
    }

    if (!user.isEmailVerified) {
      return res
        .status(403)
        .json(new ApiError(
          403,
          "Please verify your email before logging in. Check your inbox for verification link."
        ));
    }

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
    return next(err);
  }
};

const logout = async (req: any, res: any, next: NextFunction) => {
  try {
    const id = (req as any).user.id;

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
      sameSite: "lax" as const,
    };

    return res
      .status(200)
      .clearCookie("accessToken", options)
      .clearCookie("refreshToken", options)
      .json(new ApiResponse(200, "Logout successfully"));
  } catch (err) {
    return next(err);
  }
};



const doctorProfile = async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = (req as any).params;

    if (!id || !isValidUUID(id)) {
      return res.status(400).json(new ApiError(400, "Doctor id not found"));
    }

    const doctor = await prisma.doctor.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            name: true,
            email: true,
            profilePicture: true,

            createdAt: true,
          },
        },
      },
    });

    return res.status(200).json(new ApiResponse(200, doctor));
  } catch (error) {
    return res.status(500).json(new ApiError(500, "internal server error", [error]));
  }
};

const userProfile = async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = (req as any).params;

    if (!id || !isValidUUID(id)) {
      return res.status(400).json(new ApiError(400, "patient id not valid"));
    }

    const patient = await prisma.patient.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            name: true,
            email: true,
            profilePicture: true,

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

const updatePatientProfile = async (req: any, res: Response): Promise<any> => {
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

        createdAt: true,
      },
    });

    return res
      .status(200)
      .json(new ApiResponse(200, user, "Profile updated successfulyy"));
  } catch (error) {
    return res.status(500).json(new ApiError(500, "Internal server error", [error]));
  }
};

const updateDoctorProfile = async (req: any, res: Response) => {
  try {
    // Verify the user is a doctor
    if ((req as any).user?.role !== 'DOCTOR') {
      res.status(403).json(new ApiError(403, "Unauthorized: Only doctors can update doctor profile"));
      return;
    }

    let id = (req as any).user?.doctor?.id;
    const { specialty, clinicLocation, experience, bio, name, education, languages } = req.body;
    const imageUrl = req.file?.path;

    const doctorData: {
      specialty?: string;
      clinicLocation?: string;
      experience?: string;
      bio?: string;
      education?: string;
      languages?: string[];
    } = {};
    if (specialty) doctorData.specialty = specialty;
    if (clinicLocation) doctorData.clinicLocation = clinicLocation;
    if (experience) doctorData.experience = experience;
    if (bio) doctorData.bio = bio;
    if (education) doctorData.education = education;
    if (languages) doctorData.languages = Array.isArray(languages) ? languages : [languages];

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

      res.status(404).json(new ApiError(404, "User not found"));
      return;
    }

    let relatedProfileData = null;

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
const getNotifications = async (req: any, res: Response): Promise<any> => {
  try {
    const userId = (req as any).user?.id;
    const hasPagination = req.query.page !== undefined || req.query.limit !== undefined;

    let page = parseInt(req.query.page as string);
    let limit = parseInt(req.query.limit as string);

    if (hasPagination) {
      if (isNaN(page) || page < 1) page = 1;
      if (isNaN(limit) || limit < 1) limit = 10;
      if (limit > 100) limit = 100;
    }

    const totalCount = await prisma.notification.count({
      where: { userId },
    });

    const findOptions: any = {
      where: { userId },
      orderBy: { createdAt: "desc" },
    };

    if (hasPagination) {
      findOptions.skip = (page - 1) * limit;
      findOptions.take = limit;
    }

    const notifications = await prisma.notification.findMany(findOptions);

    if (hasPagination) {
      const totalPages = Math.ceil(totalCount / limit);
      const meta = { totalCount, page, limit, totalPages };
      return res.status(200).json(
        new ApiResponse(200, { notifications }, "Notifications fetched successfully", meta)
      );
    }

    return res.status(200).json(
      new ApiResponse(200, { notifications }, "Notifications fetched successfully")
    );
  } catch (error) {
    console.error("Error fetching notifications:", error);
    return res.status(500).json(new ApiError(500, "Internal server error", [error]));
  }
};

const getUnreadNotificationCount = async (req: any, res: Response): Promise<any> => {
  try {
    const userId = (req as any).user?.id;

    const unreadCount = await prisma.notification.count({
      where: {
        userId,
        isRead: false,
      },
    });

    return res
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
    return res.status(500).json(new ApiError(500, "Internal server error", [error]));
  }
};

const markNotificationAsRead = async (req: any, res: Response): Promise<any> => {
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

    return res.status(200).json(
      new ApiResponse(200, {}, "Notification marked as read")
    );
  } catch (error) {
    console.error("Error marking notification as read:", error);
    return res.status(500).json(new ApiError(500, "Internal server error", [error]));
  }
};

const markAllNotificationsAsRead = async (req: any, res: Response): Promise<any> => {
  try {
    const userId = (req as any).user?.id;

    await prisma.notification.updateMany({
      where: {
        userId,
        isRead: false,
      },
      data: { isRead: true },
    });

    return res.status(200).json(
      new ApiResponse(200, {}, "All notifications marked as read")
    );
  } catch (error) {
    console.error("Error marking all notifications as read:", error);
    return res.status(500).json(new ApiError(500, "Internal server error", [error]));
  }
};

// Community API
const getCommunityMembers = async (req: any, res: Response): Promise<any> => {
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

    const members = room.members.map((member: any) => ({
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

    return res.status(200).json(
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
    return res.status(500).json(new ApiError(500, "Internal server error", [error]));
  }
};

const joinCommunity = async (req: any, res: Response): Promise<any> => {
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

    await prisma.room.update({
      where: { id: roomId },
      data: {
        members: {
          connect: { id: userId },
        },
      },
    });

    return res.status(200).json(
      new ApiResponse(200, {}, "Successfully joined the community")
    );
  } catch (error) {
    console.error("Error joining community:", error);
    return res.status(500).json(new ApiError(500, "Internal server error", [error]));
  }
};

const leaveCommunity = async (req: any, res: Response): Promise<any> => {
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

    await prisma.room.update({
      where: { id: roomId },
      data: {
        members: {
          disconnect: { id: userId },
        },
      },
    });

    return res.status(200).json(
      new ApiResponse(200, {}, "Successfully left the community")
    );
  } catch (error) {
    console.error("Error leaving community:", error);
    return res.status(500).json(new ApiError(500, "Internal server error", [error]));
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
  verifyEmail,
  resendVerificationEmail,
  forgotPassword,
  resetPassword,
};
