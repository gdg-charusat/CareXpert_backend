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
  viewDoctorPrescriptions,
  getDoctorPrescriptionPdf,
  getPatientReports,
  getPatientReport,
} from "../controllers/doctor.controller";
import { isDoctor } from "../utils/helper";
import { isAuthenticated } from "../middlewares/auth.middleware";
import { globalRateLimiter } from "../middlewares/rateLimiter.middleware";

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
  updateAppointmentStatus as any
);
router.patch(
  "/cancel-appointment/:appointmentId",
  isAuthenticated,
  globalRateLimiter,
  isDoctor,
  cancelAppointment as any
);
router.get(
  "/patient-history/:patientId",
  isAuthenticated,
  globalRateLimiter,
  isDoctor,
  getPatientHistory as any
);
router.patch(
  "/update-timeSlot/:timeSlotID",
  isAuthenticated,
  globalRateLimiter,
  isDoctor,
  updateTimeSlot as any
);
router.delete(
  "/delete-timeSlot/:timeSlotId",
  isAuthenticated,
  globalRateLimiter,
  isDoctor,
  deleteTimeSlot as any
);

router.get("/city-rooms", isAuthenticated, globalRateLimiter, isDoctor, cityRooms);
router.put("/create-room", isAuthenticated, globalRateLimiter, isDoctor, createRoom);

router.get(
  "/all-appointments",
  isAuthenticated,
  globalRateLimiter,
  isDoctor,
  getAllDoctorAppointments as any
);

router.get(
  "/pending-requests",
  isAuthenticated,
  globalRateLimiter,
  isDoctor,
  getPendingAppointmentRequests as any
);

router.patch(
  "/appointment-requests/:appointmentId/respond",
  isAuthenticated,
  globalRateLimiter,
  isDoctor,
  respondToAppointmentRequest as any
);

router.post(
  "/appointments/:appointmentId/prescription",
  isAuthenticated,
  globalRateLimiter,
  isDoctor,
  addPrescriptionToAppointment as any
);
router.patch(
  "/appointments/:appointmentId/complete",
  isAuthenticated,
  globalRateLimiter,
  isDoctor,
  markAppointmentCompleted as any
);

router.get(
  "/notifications",
  isAuthenticated,
  globalRateLimiter,
  isDoctor,
  getDoctorNotifications as any
);

router.patch(
  "/notifications/:notificationId/read",
  isAuthenticated,
  globalRateLimiter,
  isDoctor,
  markNotificationAsRead as any
);
router.get(
  "/prescriptions",
  isAuthenticated,
  globalRateLimiter,
  isDoctor,
  viewDoctorPrescriptions
);

router.get(
  "/prescription-pdf/:id",
  isAuthenticated,
  globalRateLimiter,
  isDoctor,
  getDoctorPrescriptionPdf
);

router.get(
  "/patient/:patientId/reports",
  isAuthenticated,
  globalRateLimiter,
  isDoctor,
  getPatientReports
);

router.get(
  "/patient/report/:reportId",
  isAuthenticated,
  globalRateLimiter,
  isDoctor,
  getPatientReport
);

export default router;
