import express from "express";
import {
  getRoomMessages,
  getDmMessages,
  getToken,
  getOneOnOneChatHistory,
  getCityChatHistory,
  getDoctorDmConversations,
  getPatientDmConversations,
} from "../controllers/chat.controller";
import { isAuthenticated } from "../middlewares/auth.middleware";
import { globalRateLimiter } from "../middlewares/rateLimiter.middleware";

const router = express.Router();

router.use(isAuthenticated);
router.use(globalRateLimiter);

router.get("/room/:roomId", getRoomMessages as any);

router.get("/dm/:roomId", getDmMessages as any);

router.get("/one-on-one/:otherUserId", getOneOnOneChatHistory as any);

router.get("/city/:cityName", getCityChatHistory as any);

router.post("/get-token", getToken as any);

router.get("/doctor/conversations", getDoctorDmConversations as any);

router.get("/patient/conversations", getPatientDmConversations as any);

export default router;
