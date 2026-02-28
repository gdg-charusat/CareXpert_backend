import express from "express";
import {
  doctorProfile,
  login,
  logout,
  signup,
  adminSignup,
  refreshAccessToken,
  updateDoctorProfile,
  updatePatientProfile,
  userProfile,
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
} from "../controllers/user.controller";

import { isAuthenticated } from "../middlewares/auth.middleware";
import { isDoctor, isPatient } from "../utils/helper";
import { upload } from "../middlewares/upload";
import {
  loginRateLimiter,
  signupRateLimiter,
  emailResendLimiter,
  emailVerificationLimiter,
  passwordResetRequestLimiter,
  passwordResetLimiter,
  globalRateLimiter,
} from "../middlewares/rateLimiter.middleware";

const router = express.Router();

// Auth routes with rate limiting
router.post("/signup", signupRateLimiter, signup);
router.post("/admin-signup", signupRateLimiter, adminSignup);
router.post("/login", loginRateLimiter, login);
router.post("/logout", isAuthenticated, logout);
router.post("/refresh-token", refreshAccessToken as any);

router.get("/verify-email", emailVerificationLimiter, verifyEmail);
router.post("/resend-verification-email", emailResendLimiter, resendVerificationEmail);

// Password reset routes
router.post("/forgot-password", passwordResetRequestLimiter, forgotPassword as any);
router.post("/reset-password", passwordResetLimiter, resetPassword as any);

router.get(
  "/patient/profile/:id",
  isAuthenticated,
  globalRateLimiter,
  userProfile as any
);

router.get(
  "/doctor/profile/:id",
  isAuthenticated,
  globalRateLimiter,
  doctorProfile as any
);

router.put(
  "/update-patient",
  isAuthenticated,
  globalRateLimiter,
  isPatient,
  upload.single("profilePicture"),
  updatePatientProfile
);

router.put(
  "/update-doctor",
  isAuthenticated,
  globalRateLimiter,
  isDoctor,
  upload.single("profilePicture"),
  updateDoctorProfile
);

router.get(
  "/authenticated-profile",
  isAuthenticated,
  globalRateLimiter,
  getAuthenticatedUserProfile
);

router.get(
  "/notifications",
  isAuthenticated,
  globalRateLimiter,
  getNotifications
);

router.get(
  "/notifications/unread-count",
  isAuthenticated,
  globalRateLimiter,
  getUnreadNotificationCount
);

router.put(
  "/notifications/:notificationId/read",
  isAuthenticated,
  globalRateLimiter,
  markNotificationAsRead
);

router.put(
  "/notifications/mark-all-read",
  isAuthenticated,
  globalRateLimiter,
  markAllNotificationsAsRead
);

router.get(
  "/communities/:roomId/members",
  isAuthenticated,
  globalRateLimiter,
  getCommunityMembers
);

router.post(
  "/communities/:roomId/join",
  isAuthenticated,
  globalRateLimiter,
  joinCommunity
);

router.post(
  "/communities/:roomId/leave",
  isAuthenticated,
  globalRateLimiter,
  leaveCommunity
);

export default router;
