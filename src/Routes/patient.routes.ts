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
import { globalRateLimiter } from "../middlewares/rateLimiter.middleware";

const router = express.Router();

router.get("/search-doctors", isAuthenticated, globalRateLimiter, searchDoctors as any);
router.get(
  "/:doctorId/timeSlots",
  isAuthenticated,
  globalRateLimiter,
  availableTimeSlots
);
router.post("/book-appointment", isAuthenticated, globalRateLimiter, bookAppointment);

router.get(
  "/upcoming-appointments",
  isAuthenticated,
  globalRateLimiter,
  getUpcomingAppointments
);
router.get(
  "/past-appointments",
  isAuthenticated,
  globalRateLimiter,
  getPastAppointments
);

router.patch(
  "/cancel-appointment/:appointmentId",
  isAuthenticated,
  globalRateLimiter,
  cancelAppointment as any
);

router.get(
  "/view-Prescriptions",
  isAuthenticated,
  globalRateLimiter,
  viewPrescriptions as any
);
router.get("/prescription-pdf/:id", prescriptionPdf as any);
router.get("/fetchAllDoctors", fetchAllDoctors);
router.get("/city-rooms", isAuthenticated, globalRateLimiter, cityRooms as any);

router.post("/book-direct-appointment", isAuthenticated, globalRateLimiter, bookDirectAppointment);
router.get("/all-appointments", isAuthenticated, globalRateLimiter, getAllPatientAppointments);

router.get("/notifications", isAuthenticated, globalRateLimiter, getPatientNotifications);
router.patch("/notifications/:notificationId/read", isAuthenticated, globalRateLimiter, markNotificationAsRead);
router.patch("/notifications/mark-all-read", isAuthenticated, globalRateLimiter, markAllNotificationsAsRead);

export default router;
