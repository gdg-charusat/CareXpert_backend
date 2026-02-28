import express from "express";
import {
  doctorProfile,
  login,
  logout,
  signup,
  adminSignup,
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
  refreshAccessToken,
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
} from "../middlewares/rateLimiter.middleware";

const router = express.Router();

// Auth routes with rate limiting
router.post("/signup", signupRateLimiter, signup);
router.post("/admin-signup", signupRateLimiter, adminSignup);
router.post("/login", loginRateLimiter, login);
router.post("/logout", isAuthenticated, logout);
router.post("/refresh-token", refreshAccessToken as any);

// Email verification routes
router.get("/verify-email", emailVerificationLimiter, verifyEmail as any);
router.post("/resend-verification", emailResendLimiter, resendVerificationEmail as any);

// Password reset routes
router.post("/forgot-password", passwordResetRequestLimiter, forgotPassword as any);
router.post("/reset-password", passwordResetLimiter, resetPassword as any);

router.get("/patient/profile/:id", isAuthenticated, userProfile);
router.get("/doctor/profile/:id", isAuthenticated, doctorProfile);

router.put(
  "/update-patient",
  isAuthenticated,
  isPatient,
  upload.single("profilePicture"),
  updatePatientProfile
);
router.put(
  "/update-doctor",
  isAuthenticated,
  isDoctor,
  upload.single("profilePicture"),
  updateDoctorProfile
);

router.get(
  "/authenticated-profile",
  isAuthenticated,
  getAuthenticatedUserProfile
);

// Notification routes
router.get("/notifications", isAuthenticated, getNotifications);
router.get("/notifications/unread-count", isAuthenticated, getUnreadNotificationCount);
router.put("/notifications/:notificationId/read", isAuthenticated, markNotificationAsRead);
router.put("/notifications/mark-all-read", isAuthenticated, markAllNotificationsAsRead);

// Community routes
router.get("/communities/:roomId/members", isAuthenticated, getCommunityMembers);
router.post("/communities/:roomId/join", isAuthenticated, joinCommunity);
router.post("/communities/:roomId/leave", isAuthenticated, leaveCommunity);

export default router;
