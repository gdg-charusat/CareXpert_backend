import { Router } from "express";
import {
  viewDoctorAppointment,
  updateAppointmentStatus,
  addTimeslot,
  viewTimeslots,
  cancelAppointment,
  getPatientHistory,
  updateTimeSlot,
  deleteTimeSlot,
  cityRooms,
  createRoom,
  getAllDoctorAppointments,
  getPendingAppointmentRequests,
  respondToAppointmentRequest,
  getDoctorNotifications,
  markNotificationAsRead,
  addPrescriptionToAppointment,
  markAppointmentCompleted,
  generateBulkTimeSlots,
} from "../controllers/doctor.controller";
import { isDoctor } from "../utils/helper";
import { isAuthenticated } from "../middlewares/auth.middleware";
import { globalRateLimiter } from "../middlewares/rateLimiter";

const router = Router();

router.post("/add-timeslot", isAuthenticated, globalRateLimiter, isDoctor, addTimeslot);
router.post("/timeslots/bulk", isAuthenticated, globalRateLimiter, isDoctor, generateBulkTimeSlots);
router.get("/view-timeslots", isAuthenticated, globalRateLimiter, isDoctor, viewTimeslots);

router.get("/appointments", isAuthenticated, globalRateLimiter, isDoctor, viewDoctorAppointment);
router.patch(
  "/appointments/:id",
  isAuthenticated,
  globalRateLimiter,
  isDoctor,
  updateAppointmentStatus
);
router.patch(
  "/cancel-appointment/:appointmentId",
  isAuthenticated,
  globalRateLimiter,
  isDoctor,
  cancelAppointment
);
router.get(
  "/patient-history/:patientId",
  isAuthenticated,
  globalRateLimiter,
  isDoctor,
  getPatientHistory
);
router.patch(
  "/update-timeSlot/:timeSlotID",
  isAuthenticated,
  globalRateLimiter,
  isDoctor,
  updateTimeSlot
);
router.delete(
  "/delete-timeSlot/:timeSlotId",
  isAuthenticated,
  globalRateLimiter,
  isDoctor,
  deleteTimeSlot
);

router.get("/city-rooms", isAuthenticated, globalRateLimiter, isDoctor, cityRooms);
router.put("/create-room", isAuthenticated, globalRateLimiter, isDoctor, createRoom);

// New direct appointment routes
router.get(
  "/all-appointments",
  isAuthenticated,
  globalRateLimiter,
  isDoctor,
  getAllDoctorAppointments as any
);

// New appointment request management routes
router.get(
  "/pending-requests",
  isAuthenticated,
  globalRateLimiter,
  isDoctor,
  getPendingAppointmentRequests
);

router.patch(
  "/appointment-requests/:appointmentId/respond",
  isAuthenticated,
  globalRateLimiter,
  isDoctor,
  respondToAppointmentRequest
);

// Prescription and completion routes
router.post(
  "/appointments/:appointmentId/prescription",
  isAuthenticated,
  globalRateLimiter,
  isDoctor,
  addPrescriptionToAppointment
);
router.patch(
  "/appointments/:appointmentId/complete",
  isAuthenticated,
  globalRateLimiter,
  isDoctor,
  markAppointmentCompleted
);

// Notification routes
router.get(
  "/notifications",
  isAuthenticated,
  globalRateLimiter,
  isDoctor,
  getDoctorNotifications
);

router.patch(
  "/notifications/:notificationId/read",
  isAuthenticated,
  globalRateLimiter,
  isDoctor,
  markNotificationAsRead
);

export default router;
