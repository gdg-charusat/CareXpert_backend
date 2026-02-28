import { Socket } from "socket.io";
import jwt from "jsonwebtoken";
import prisma from "../utils/prismClient";

/** Shape returned by the user lookup – mirrors the Prisma select used in production. */
export interface AuthUser {
  id: string;
  name: string;
  role: string;
  tokenVersion: number;
}

/**
 * Injectable user-lookup function signature.
 * Receives the decoded `userId` and must return the matching active user or
 * `null` if the user does not exist / is deleted.
 */
export type FindUserFn = (userId: string) => Promise<AuthUser | null>;

/** Default production lookup — queries the real database via Prisma. */
const defaultFindUser: FindUserFn = (userId) =>
  prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
    select: { id: true, name: true, role: true, tokenVersion: true },
  });

/**
 * Factory that creates a Socket.IO authentication middleware.
 *
 * Accepts an optional `findUser` function so the data-access layer can be
 * replaced in tests without duplicating any middleware logic.
 *
 * Reads the JWT from (in priority order):
 *   1. socket.handshake.auth.token  (preferred – sent explicitly by the client)
 *   2. Authorization header          ("Bearer <token>")
 *   3. accessToken httpOnly cookie   (sent automatically by browsers when
 *                                     withCredentials: true is set on the socket)
 *
 * On success it attaches `userId`, `name` and `role` to `socket.data` so that
 * every event handler in the namespace can access the verified caller without
 * repeating the verification step.
 */
export function createSocketAuthMiddleware(findUser: FindUserFn = defaultFindUser) {
  return async function socketAuthMiddleware(
    socket: Socket,
    next: (err?: Error) => void
  ): Promise<void> {
    try {
      const authToken = (socket.handshake.auth as Record<string, string>)?.token;
      const headerToken = socket.handshake.headers?.authorization?.replace(
        "Bearer ",
        ""
      );

      // Also support httpOnly cookie sent by the browser (withCredentials: true).
      // Inline parse: extract accessToken=<value> from the raw cookie header.
      const rawCookie = socket.handshake.headers?.cookie ?? "";
      const cookieToken = rawCookie
        ? (rawCookie
            .split(";")
            .map((c) => c.trim())
            .find((c) => c.startsWith("accessToken="))
            ?.split("=")
            .slice(1)
            .join("=") ?? null)
        : null;

      const token = authToken || headerToken || cookieToken;

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

      const user = await findUser(decoded.userId);

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
      console.error("[socketAuth] Unexpected middleware error:", err);
      next(new Error("Authentication error: Internal server error"));
    }
  };
}

/**
 * Ready-to-use production middleware instance.
 * Uses the default Prisma-backed `findUser` implementation.
 */
export const socketAuthMiddleware = createSocketAuthMiddleware();
