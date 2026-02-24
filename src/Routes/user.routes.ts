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
} from "../controllers/user.controller";

import { isAuthenticated } from "../middlewares/auth.middleware";
import { isDoctor, isPatient } from "../utils/helper";
import { upload } from "../middlewares/upload";
import {
  loginRateLimiter,
  signupRateLimiter,
  globalRateLimiter,
} from "../middlewares/rateLimiter";

const router = express.Router();

/* ===================== AUTH ROUTES ===================== */

router.post("/signup", signupRateLimiter, signup);
router.post("/admin-signup", signupRateLimiter, adminSignup);
router.post("/login", loginRateLimiter, login);
router.post("/logout", isAuthenticated, globalRateLimiter, logout);
router.post("/refresh-token", refreshAccessToken);

/* ===================== EMAIL VERIFICATION ===================== */

router.get("/verify-email", verifyEmail);
router.post("/resend-verification-email", resendVerificationEmail);

/* ===================== PROFILE ROUTES ===================== */

router.get(
  "/patient/profile/:id",
  isAuthenticated,
  globalRateLimiter,
  userProfile
);

router.get(
  "/doctor/profile/:id",
  isAuthenticated,
  globalRateLimiter,
  doctorProfile
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

/* ===================== NOTIFICATIONS ===================== */

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

/* ===================== COMMUNITY ===================== */

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