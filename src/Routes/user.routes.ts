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
import {upload} from "../middlewares/upload";

const router = express.Router();

router.post("/signup", signup);
router.post("/admin-signup", adminSignup);
router.post("/login", login);
router.post("/logout", isAuthenticated, logout);
router.post("/refresh-token", refreshAccessToken);

// Email Verification routes
router.get("/verify-email", verifyEmail);
router.post("/resend-verification-email", resendVerificationEmail);

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