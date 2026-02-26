import express, { Router } from "express";
import {
  logSymptom,
  getSymptomHistory,
  deleteSymptom,
} from "../controllers/symptom.controller";
import { isAuthenticated } from "../middlewares/auth.middleware";
import { isPatient } from "../utils/helper";

const router = express.Router();

router.post("/log", isAuthenticated, isPatient, logSymptom);

router.get("/history", isAuthenticated, isPatient, getSymptomHistory);

router.delete("/:symptomId", isAuthenticated, isPatient, deleteSymptom);

export default router;
