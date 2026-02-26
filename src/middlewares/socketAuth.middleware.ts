import { Socket } from "socket.io";
import jwt from "jsonwebtoken";
import prisma from "../utils/prismClient";

/**
 * Socket.IO authentication middleware.
 *
 * Reads the JWT from either:
 *   - socket.handshake.auth.token  (preferred – sent by the frontend on connect)
 *   - Authorization header          ("Bearer <token>")
 *
 * On success it attaches `userId`, `name` and `role` to `socket.data` so that
 * every event handler in the namespace can access the verified caller without
 * repeating the verification step.
 */
export async function socketAuthMiddleware(
  socket: Socket,
  next: (err?: Error) => void
): Promise<void> {
  try {
    const authToken = (socket.handshake.auth as Record<string, string>)?.token;
    const headerToken = socket.handshake.headers?.authorization?.replace(
      "Bearer ",
      ""
    );
    const token = authToken || headerToken;

    if (!token) {
      return next(new Error("Authentication error: No token provided"));
    }

    let decoded: { userId: string; tokenVersion?: number };

    try {
      decoded = jwt.verify(
        token,
        process.env.ACCESS_TOKEN_SECRET as string
      ) as { userId: string; tokenVersion?: number };
    } catch {
      return next(
        new Error("Authentication error: Invalid or expired token")
      );
    }

    const user = await prisma.user.findFirst({
      where: { id: decoded.userId, deletedAt: null },
      select: { id: true, name: true, role: true, tokenVersion: true },
    });

    if (!user) {
      return next(new Error("Authentication error: User not found"));
    }

    if (
      decoded.tokenVersion !== undefined &&
      decoded.tokenVersion !== user.tokenVersion
    ) {
      return next(
        new Error("Authentication error: Token has been invalidated")
      );
    }

    // Attach verified user data to the socket for use in event handlers
    socket.data.userId = user.id;
    socket.data.name = user.name;
    socket.data.role = user.role;

    next();
  } catch (err) {
    next(new Error("Authentication error: Internal server error"));
  }
}
