import { AppError } from "../utils/AppError";
import { ApiError } from "../utils/ApiError"; // legacy – remaining secondary handlers still use this
import { ApiResponse } from "../utils/ApiResponse";
import prisma from "../utils/prismClient";
import bcrypt from "bcrypt";
import { Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { generateAccessToken, generateRefreshToken } from "../utils/jwt";
import { Prisma } from "@prisma/client";
import { Request } from "express";
import { hash, randomBytes } from "crypto";
import { isValidUUID, validatePassword } from "../utils/helper";
import { generateVerificationToken, sendVerificationEmail, sendWelcomeEmail, sendPasswordResetEmail, sendPasswordResetConfirmationEmail } from "../utils/emailService";

const generateToken = async (userId: string) => {
  try {

    const user = await prisma.user.update({
      where: { id: userId },
      data: { tokenVersion: { increment: 1 } },
      select: { tokenVersion: true },
    });

    const accessToken = generateAccessToken(userId, user.tokenVersion);
    const refreshToken = generateRefreshToken(userId, user.tokenVersion);
    const hashedRefreshToken = await bcrypt.hash(refreshToken, 10);

    await prisma.user.update({
      where: { id: userId },
      data: { refreshToken: hashedRefreshToken },
    });

    return { accessToken, refreshToken };
  } catch (err) {
    throw new AppError("Error in generating token", 500, false);
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
    const verificationToken = generateVerificationToken();
    const tokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const user = await tx.user.create({
        data: {
          name: name.toLowerCase(),
          email,
          password: hashedPassword,
          role,
          isEmailVerified: false,
          emailVerificationToken: verificationToken,
          tokenExpiresAt: tokenExpiresAt,
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

    try {
      await sendVerificationEmail(result.email, result.name, verificationToken);
    } catch (emailError) {
      console.error("Failed to send verification email:", emailError);

    }

    return res
      .status(201)
      .json(new ApiResponse(
        201,
        {
          user: {
            id: result.id,
            email: result.email,
            name: result.name,
            isEmailVerified: result.isEmailVerified
          }
        },
        "Signup successful! Please verify your email address."
      ));
  } catch (err) {
    console.error(err);
    return res
      .status(500)
      .json(new ApiError(500, "Internal server error", [err]));
  }
};

const verifyEmail = async (req: Request, res: any) => {
  try {
    const { token, email } = req.query;

    if (!token || !email) {
      return res
        .status(400)
        .json(new ApiError(400, "Verification token and email are required"));
    }

    const user = await prisma.user.findUnique({
      where: { email: String(email) },
    });

    if (!user) {
      return res
        .status(404)
        .json(new ApiError(404, "User not found"));
    }

    if (user.isEmailVerified) {
      return res
        .status(200)
        .json(new ApiResponse(200, {}, "Email is already verified"));
    }

    if (user.emailVerificationToken !== String(token)) {
      return res
        .status(400)
        .json(new ApiError(400, "Invalid verification token"));
    }

    if (user.tokenExpiresAt && new Date() > user.tokenExpiresAt) {
      return res
        .status(400)
        .json(new ApiError(400, "Verification token has expired"));
    }

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        isEmailVerified: true,
        emailVerificationToken: null,
        tokenExpiresAt: null,
      },
    });

    try {
      await sendWelcomeEmail(updatedUser.email, updatedUser.name);
    } catch (emailError) {
      console.error("Failed to send welcome email:", emailError);
    }

    return res
      .status(200)
      .json(new ApiResponse(
        200,
        {
          user: {
            id: updatedUser.id,
            email: updatedUser.email,
            name: updatedUser.name,
            isEmailVerified: updatedUser.isEmailVerified
          }
        },
        "Email verified successfully! Your account is now active."
      ));
  } catch (err) {
    console.error(err);
    return res
      .status(500)
      .json(new ApiError(500, "Internal server error", [err]));
  }
};

const resendVerificationEmail = async (req: Request, res: any, next: NextFunction) => {
  try {
    const { email } = req.body;

    if (!email || email.trim() === "") {
      return res
        .status(400)
        .json(new ApiError(400, "Email is required"));
    }

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return res
        .status(404)
        .json(new ApiError(404, "User not found"));
    }

    if (user.isEmailVerified) {
      return res
        .status(200)
        .json(new ApiResponse(200, {}, "Email is already verified"));
    }

    const verificationToken = generateVerificationToken();
    const tokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerificationToken: verificationToken,
        tokenExpiresAt: tokenExpiresAt,
      },
    });

    try {
      await sendVerificationEmail(user.email, user.name, verificationToken);
    } catch (emailError) {
      console.error("Failed to send verification email:", emailError);
      return res
        .status(500)
        .json(new ApiError(500, "Failed to send verification email"));
    }

    return res
      .status(200)
      .json(new ApiResponse(
        200,
        {},
        "Verification email sent successfully"
      ));
  } catch (err) {
    return next(err);
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

const refreshAccessToken = async (req: any, res: any) => {
  try {
    const incomingRefreshToken =
      req.cookies?.refreshToken || req.body?.refreshToken;

    if (!incomingRefreshToken) {
      return res
        .status(401)
        .json(new ApiError(401, "Refresh token is required"));
    }

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

    if (
      typeof decoded !== "object" ||
      !decoded.userId ||
      typeof decoded.userId !== "string" ||
      typeof decoded.tokenVersion !== "number"
    ) {
      return res
        .status(401)
        .json(new ApiError(401, "Invalid token payload"));
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, refreshToken: true, tokenVersion: true },
    });

    if (!user) {
      return res.status(401).json(new ApiError(401, "User not found"));
    }

    if (!user.refreshToken) {
      return res
        .status(401)
        .json(new ApiError(401, "Refresh token has been revoked"));
    }

    const isRefreshTokenValid = await bcrypt.compare(
      incomingRefreshToken,
      user.refreshToken
    );

    if (!isRefreshTokenValid) {
      return res
        .status(401)
        .json(new ApiError(401, "Refresh token has been revoked"));
    }

    if (decoded.tokenVersion !== user.tokenVersion) {
      return res
        .status(401)
        .json(new ApiError(401, "Token version mismatch, please login again"));
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

    return res.status(200).json(
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

const forgotPassword = async (req: Request, res: Response, next: NextFunction) => {
  const { email } = req.body;

  if (!email || email.trim() === "") {
    return next(new AppError("Email is required", 400));
  }

  try {
    // Always return same response to prevent email enumeration
    const genericResponse = "If an account exists with this email, a password reset link has been sent.";

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: email.trim() },
    });

    // If user doesn't exist, still return success to prevent email enumeration
    if (!user) {
      res.status(200).json(new ApiResponse(200, genericResponse));
      return;
    }

    // Generate secure reset token (32 bytes = 64 hex characters)
    const resetToken = randomBytes(32).toString("hex");
    
    // Hash the token before storing
    const hashedToken = await bcrypt.hash(resetToken, 10);
    
    // Set expiration time (30 minutes from now)
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

    // Update user with reset token and expiry
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: hashedToken,
        passwordResetExpiry: expiresAt,
      },
    });

    // Send reset email with plain token (not hashed)
    try {
      await sendPasswordResetEmail(user.email, user.name, resetToken);
      console.log(`✓ Password reset email sent to ${user.email}`);
    } catch (emailError) {
      console.error("Failed to send password reset email:", emailError);
      // Still return success to prevent email enumeration
      // But the email won't be sent - admin should check logs
    }

    res.status(200).json(new ApiResponse(200, genericResponse));
    return;
  } catch (error) {
    console.error("Error in forgot password:", error);
    return next(new AppError("Failed to process password reset request", 500));
  }
};

const resetPassword = async (req: Request, res: Response, next: NextFunction) => {
  const { token, newPassword } = req.body;

  if (!token || token.trim() === "") {
    return next(new AppError("Reset token is required", 400));
  }

  if (!newPassword || newPassword.trim() === "") {
    return next(new AppError("New password is required", 400));
  }

  // Validate password strength
  const passwordValidation = validatePassword(newPassword);
  if (!passwordValidation.isValid) {
    return next(new AppError(passwordValidation.message || "Invalid password", 400));
  }

  try {
    // Find users with non-expired reset tokens
    const users = await prisma.user.findMany({
      where: {
        passwordResetToken: { not: null },
        passwordResetExpiry: { gte: new Date() },
      },
    });

    // Find the user whose hashed token matches the provided token
    let matchedUser = null;
    for (const user of users) {
      if (user.passwordResetToken) {
        const isMatch = await bcrypt.compare(token, user.passwordResetToken);
        if (isMatch) {
          matchedUser = user;
          break;
        }
      }
    }

    if (!matchedUser) {
      return next(new AppError("Invalid or expired reset token", 400));
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update user: set new password, clear reset token, increment tokenVersion
    await prisma.user.update({
      where: { id: matchedUser.id },
      data: {
        password: hashedPassword,
        passwordResetToken: null,
        passwordResetExpiry: null,
        tokenVersion: { increment: 1 }, // Invalidate all existing sessions
      },
    });

    // Send confirmation email
    try {
      await sendPasswordResetConfirmationEmail(matchedUser.email, matchedUser.name);
    } catch (emailError) {
      console.error("Failed to send password reset confirmation email:", emailError);
    }

    res.status(200).json(new ApiResponse(200, "Password reset successful"));
    return;
  } catch (error) {
    console.error("Error in reset password:", error);
    return next(new AppError("Failed to reset password", 500));
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
