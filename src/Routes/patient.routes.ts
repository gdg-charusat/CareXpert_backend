import express, { Router } from "express";
import {
  searchDoctors,
  availableTimeSlots,
  bookAppointment,
  cancelAppointment,
  viewPrescriptions,
  prescriptionPdf,
  getUpcomingAppointments,
  getPastAppointments,
  fetchAllDoctors,
  cityRooms,
  bookDirectAppointment,
  getAllPatientAppointments,
  getPatientNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from "../controllers/patient.controller";
import { isAuthenticated } from "../middlewares/auth.middleware";
import { isPatient } from "../utils/helper";
import { globalRateLimiter } from "../middlewares/rateLimiter";

const router = express.Router();

router.get("/search-doctors", isAuthenticated, globalRateLimiter, isPatient, searchDoctors);
router.get(
  "/:doctorId/timeSlots",
  isAuthenticated,
  globalRateLimiter,
  isPatient,
  availableTimeSlots
);
router.post("/book-appointment", isAuthenticated, globalRateLimiter, isPatient, bookAppointment);

router.get(
  "/upcoming-appointments",
  isAuthenticated,
  globalRateLimiter,
  isPatient,
  getUpcomingAppointments
);
router.get(
  "/past-appointments",
  isAuthenticated,
  globalRateLimiter,
  isPatient,
  getPastAppointments
);

router.patch(
  "/cancel-appointment/:appointmentId",
  isAuthenticated,
  globalRateLimiter,
  isPatient,
  cancelAppointment as any
);

router.get(
  "/view-Prescriptions",
  isAuthenticated,
  globalRateLimiter,
  isPatient,
  viewPrescriptions as any
);
router.get("/prescription-pdf/:id", prescriptionPdf as any);
router.get("/fetchAllDoctors", fetchAllDoctors);
router.get("/city-rooms", isAuthenticated, globalRateLimiter, isPatient, cityRooms as any);

// New direct appointment booking routes
router.post("/book-direct-appointment", isAuthenticated, globalRateLimiter, isPatient, bookDirectAppointment);
router.get("/all-appointments", isAuthenticated, globalRateLimiter, isPatient, getAllPatientAppointments);

// Notification routes
router.get("/notifications", isAuthenticated, globalRateLimiter, isPatient, getPatientNotifications);
router.patch("/notifications/:notificationId/read", isAuthenticated, globalRateLimiter, isPatient, markNotificationAsRead);
router.patch("/notifications/mark-all-read", isAuthenticated, globalRateLimiter, isPatient, markAllNotificationsAsRead);

export default router;
