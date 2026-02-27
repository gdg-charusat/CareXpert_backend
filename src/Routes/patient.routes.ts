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
import { globalRateLimiter } from "../middlewares/rateLimiter.middleware";

const router = express.Router();

router.get("/search-doctors", isAuthenticated, globalRateLimiter, isPatient, searchDoctors as any);
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
router.get("/fetchAllDoctors", fetchAllDoctors as any);
router.get("/city-rooms", isAuthenticated, globalRateLimiter, isPatient, cityRooms as any);

router.post("/book-direct-appointment", isAuthenticated, globalRateLimiter, isPatient, bookDirectAppointment as any);
router.get("/all-appointments", isAuthenticated, globalRateLimiter, isPatient, getAllPatientAppointments as any);

router.get("/notifications", isAuthenticated, globalRateLimiter, isPatient, getPatientNotifications as any);
router.patch("/notifications/:notificationId/read", isAuthenticated, globalRateLimiter, isPatient, markNotificationAsRead as any);
router.patch("/notifications/mark-all-read", isAuthenticated, globalRateLimiter, isPatient, markAllNotificationsAsRead as any);

export default router;
