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
import { isDoctor, isPatient, isAdmin } from "../utils/helper";
import prisma from "../utils/prismClient";
import { upload } from "../middlewares/upload";
import {
  loginRateLimiter,
  signupRateLimiter,
  globalRateLimiter,
} from "../middlewares/rateLimiter.middleware";

const router = express.Router();

router.post("/signup", signupRateLimiter, signup);
router.post(
  "/admin-signup",
  signupRateLimiter,
  async (req, res, next) => {
    const secret = req.header("X-Admin-Secret");
    if (secret && secret === process.env.ADMIN_SIGNUP_SECRET) {
      try {
        const adminCount = await prisma.admin.count();
        if (adminCount === 0) {
          return next();
        }
      } catch (err) {
        return next(err);
      }
    }
    return isAuthenticated(req, res, () => isAdmin(req, res, next));
  },
  adminSignup
);
router.post("/login", loginRateLimiter, login);
router.post("/logout", isAuthenticated, globalRateLimiter, logout);
router.post("/refresh-token", refreshAccessToken);

router.get("/verify-email", verifyEmail);
router.post("/resend-verification-email", resendVerificationEmail);

router.post("/forgot-password", signupRateLimiter, forgotPassword);
router.post("/reset-password", signupRateLimiter, resetPassword);

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
