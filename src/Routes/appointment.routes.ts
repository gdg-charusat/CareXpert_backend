import { Router } from "express";
import {
  updateAppointmentNotes,
  addFollowUpDate,
  getAppointmentsWithFollowUps,
  sendFollowUpReminder,
  getAppointmentDetails,
} from "../controllers/appointment.controller";
import { isDoctor, doctorOrAdminAccess } from "../utils/helper";
import { isAuthenticated } from "../middlewares/auth.middleware";
import { globalRateLimiter } from "../middlewares/rateLimiter.middleware";

const router = Router();

// Update appointment notes (Doctor only)
router.patch(
  "/:appointmentId/notes",
  isAuthenticated,
  globalRateLimiter,
  isDoctor,
  updateAppointmentNotes as any
);

// Add/update follow-up date (Doctor only)
router.patch(
  "/:appointmentId/followup",
  isAuthenticated,
  globalRateLimiter,
  isDoctor,
  addFollowUpDate as any
);

// Get appointments with follow-ups (Doctor only)
router.get(
  "/followups",
  isAuthenticated,
  globalRateLimiter,
  isDoctor,
  getAppointmentsWithFollowUps as any
);

// Send follow-up reminder manually (Doctor or Admin)
router.post(
  "/:appointmentId/send-followup-reminder",
  isAuthenticated,
  globalRateLimiter,
  doctorOrAdminAccess,
  sendFollowUpReminder as any
);

// Get appointment details with notes (Doctor or Patient)
router.get(
  "/:appointmentId/details",
  isAuthenticated,
  globalRateLimiter,
  getAppointmentDetails as any
);

export default router;
