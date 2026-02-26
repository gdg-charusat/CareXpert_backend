import express, { Router } from "express";
import {
  logSymptom,
  getSymptomHistory,
  deleteSymptom,
} from "../controllers/symptom.controller";
import { isAuthenticated } from "../middlewares/auth.middleware";

const router = express.Router();

router.post("/log", isAuthenticated, logSymptom);

router.get("/history", isAuthenticated, getSymptomHistory);

router.delete("/:symptomId", isAuthenticated, deleteSymptom);

export default router;
