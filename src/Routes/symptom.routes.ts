import express, { Router } from "express";
import {
  logSymptom,
  getSymptomHistory,
  deleteSymptom,
} from "../controllers/symptom.controller";
import { isAuthenticated } from "../middlewares/auth.middleware";
import { globalRateLimiter } from "../middlewares/rateLimiter.middleware";
import { isPatient } from "../utils/helper";

const router = express.Router();

router.use(isAuthenticated, globalRateLimiter, isPatient);

router.post("/log", logSymptom);

router.get("/history", getSymptomHistory);

router.delete("/:symptomId", deleteSymptom);

export default router;
