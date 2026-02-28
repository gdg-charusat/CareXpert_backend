import express from "express";

import userRoute from "./user.routes";
import doctorRoutes from "./doctor.routes";
import patientRoutes from "./patient.routes";
import chatRoutes from "./chat.routes";
import aiChatRoutes from "./ai-chat.routes";
import reportRoutes from "./report.routes";
import analyticsRoutes from "./analytics.routes";
import adminRoutes from "./admin.routes";
import symptomRoutes from "./symptom.routes";
import healthMetricsRoutes from "./healthMetrics.routes";

const router = express.Router();

router.use("/user", userRoute);
router.use("/doctor", doctorRoutes);
router.use("/patient", patientRoutes);
router.use("/chat", chatRoutes);
router.use("/ai-chat", aiChatRoutes);
router.use("/report", reportRoutes);
router.use("/analytics", analyticsRoutes);
router.use("/admin", adminRoutes);
router.use("/symptom", symptomRoutes);
router.use("/", healthMetricsRoutes);

export default router;
