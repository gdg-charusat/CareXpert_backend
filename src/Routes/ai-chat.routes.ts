import express from "express";
import {
  processSymptoms,
  getChatHistory,
  getChatById,
  clearChatHistory,
} from "../controllers/ai-chat.controller";
import { isAuthenticated } from "../middlewares/auth.middleware";
import { globalRateLimiter } from "../middlewares/rateLimiter.middleware";

const router = express.Router();

router.use(isAuthenticated);
router.use(globalRateLimiter);

router.post("/process", processSymptoms as any);

router.get("/history", getChatHistory as any);

router.get("/:chatId", getChatById as any);

router.delete("/history", clearChatHistory as any);

export default router;
