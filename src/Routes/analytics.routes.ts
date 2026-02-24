import express from "express";
import { isAuthenticated } from "../middlewares/auth.middleware";
import {
  getHealthSummary,
  getDoctorVisitFrequency,
  getReportTrends,
  getSymptomPatterns,
} from "../controllers/analytics.controller";

const router = express.Router();

// Apply auth middleware to all analytics routes to ensure privacy
router.use(isAuthenticated);

router.get("/summary", getHealthSummary);
router.get("/doctors-visited", getDoctorVisitFrequency);
router.get("/reports", getReportTrends);
router.get("/symptoms", getSymptomPatterns);

export default router;
