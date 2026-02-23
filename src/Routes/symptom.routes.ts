import express, { Router } from "express";
import {
  logSymptom,
  getSymptomHistory,
  deleteSymptom,
} from "../controllers/symptom.controller";
import { isAuthenticated } from "../middlewares/auth.middleware";
import { isPatient } from "../utils/helper";

const router = express.Router();

// Log a new symptom
router.post("/log", isAuthenticated, isPatient, logSymptom);

// Get all logged symptoms for the authenticated patient
router.get("/history", isAuthenticated, isPatient, getSymptomHistory);

// Delete a logged symptom by ID
router.delete("/:symptomId", isAuthenticated, isPatient, deleteSymptom);

export default router;
