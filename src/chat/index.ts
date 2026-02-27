import { Server } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import Redis from "ioredis";
import { handleRoomSocket } from "./roomManager";
import { handleDmSocket } from "./dmManager";
import { socketAuthMiddleware } from "../middlewares/socketAuth.middleware";

/**
 * Bootstraps the Socket.IO server with:
 *  - Redis adapter for cross-server (horizontal-scale) event broadcasting
 *  - /chat/room namespace for group / room-based messaging
 *  - /chat/dm   namespace for direct messaging between two users
 *  - JWT authentication middleware applied to both namespaces
 *
 * Clients must supply a valid access token via
 *   socket.handshake.auth.token  OR  Authorization: Bearer <token>
 * before any event is processed.
 */
export async function setupChatSocket(io: Server): Promise<void> {
  // ── Redis Adapter ─────────────────────────────────────────────────────────
  // Two separate ioredis connections are required by the adapter (pub / sub).
  const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

  const pubClient = new Redis(redisUrl);
  const subClient = pubClient.duplicate();

  pubClient.on("error", (err) =>
    console.error("[Redis Adapter] pubClient error:", err)
  );
  subClient.on("error", (err) =>
    console.error("[Redis Adapter] subClient error:", err)
  );

  try {
    await Promise.all([pubClient.ping(), subClient.ping()]);
    io.adapter(createAdapter(pubClient, subClient));
    console.log("[Socket.IO] Redis adapter attached");
  } catch (err) {
    console.error(
      "[Socket.IO] Redis adapter disabled, falling back to in-memory adapter:",
      err
    );
    try {
      pubClient.disconnect();
    } catch {
      // ignore
    }
    try {
      subClient.disconnect();
    } catch {
      // ignore
    }
  }

  // ── /chat/room Namespace ──────────────────────────────────────────────────
  const roomNsp = io.of("/chat/room");
  roomNsp.use(socketAuthMiddleware);

  roomNsp.on("connection", (socket) => {
    console.log(
      `[Room] connected  socket=${socket.id}  userId=${socket.data.userId}`
    );

    try {
      handleRoomSocket(roomNsp, socket);
    } catch (error) {
      console.error("[Room] Error setting up socket handlers:", error);
    }

    socket.on("disconnect", () => {
      console.log(
        `[Room] disconnected  socket=${socket.id}  userId=${socket.data.userId}`
      );
    });
  });

  // ── /chat/dm Namespace ────────────────────────────────────────────────────
  const dmNsp = io.of("/chat/dm");
  dmNsp.use(socketAuthMiddleware);

  dmNsp.on("connection", (socket) => {
    console.log(
      `[DM] connected  socket=${socket.id}  userId=${socket.data.userId}`
    );

    try {
      handleDmSocket(dmNsp, socket);
    } catch (error) {
      console.error("[DM] Error setting up socket handlers:", error);
    }

    socket.on("disconnect", () => {
      console.log(
        `[DM] disconnected  socket=${socket.id}  userId=${socket.data.userId}`
      );
    });
  });

  // ── /notifications Namespace ─────────────────────────────────────────────
  const notifNsp = io.of("/notifications");
  notifNsp.use(socketAuthMiddleware);

  notifNsp.on("connection", (socket) => {
    // Join a room named by userId for targeted notification delivery
    const userId = socket.data.userId;
    if (userId) {
      socket.join(userId);
    }
    // Optionally log connection
    // console.log(`[Notifications] connected socket=${socket.id} userId=${userId}`);
    socket.on("disconnect", () => {
      // console.log(`[Notifications] disconnected socket=${socket.id} userId=${userId}`);
    });
  });
}

/**
 * Emits a new_notification event to a specific user via the /notifications namespace.
 * @param io - The Socket.IO server instance
 * @param userId - The userId to notify
 * @param payload - The notification payload (object)
 */
export function emitNotificationToUser(io: Server, userId: string, payload: any) {
  io.of("/notifications").to(userId).emit("new_notification", payload);
}
