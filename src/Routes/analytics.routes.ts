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

router.get("/summary", getHealthSummary as any);
router.get("/doctors-visited", getDoctorVisitFrequency as any);
router.get("/reports", getReportTrends as any);
router.get("/symptoms", getSymptomPatterns as any);

export default router;
