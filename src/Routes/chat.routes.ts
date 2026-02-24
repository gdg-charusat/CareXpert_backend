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
import { globalRateLimiter } from "../middlewares/rateLimiter";

const router = express.Router();

// Apply authentication and rate limiting middleware to all routes
router.use(isAuthenticated);
router.use(globalRateLimiter);

// Route to get messages for a specific room (city chat)
// Example: GET /api/chat/room/roomId?page=1&limit=50
router.get("/room/:roomId", getRoomMessages as any);

// Route to get messages for a specific DM room
// Example: GET /api/chat/dm/roomId?page=1&limit=50
router.get("/dm/:roomId", getDmMessages as any);

// Route to get 1-on-1 chat history between two users
// Example: GET /api/chat/one-on-one/otherUserId?page=1&limit=50
router.get("/one-on-one/:otherUserId", getOneOnOneChatHistory as any);

// Route to get city-based room chat history
// Example: GET /api/chat/city/New York?page=1&limit=50
router.get("/city/:cityName", getCityChatHistory as any);

// Route to get video call token
router.post("/get-token", getToken as any);

// Route to get all DM conversations for doctors
router.get("/doctor/conversations", getDoctorDmConversations as any);

// Route to get all DM conversations for patients
router.get("/patient/conversations", getPatientDmConversations as any);

export default router;
