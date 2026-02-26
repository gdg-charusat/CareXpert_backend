import jwt from "jsonwebtoken";
import prisma from "../utils/prismClient";
import { ApiError } from "../utils/ApiError";

/**
 * Authentication middleware to verify JWT tokens and validate user access
 * Checks token validity, user existence, and token version for security
 */
export const isAuthenticated = async (req: any, res: any, next: any) => {
  try {
    // Extract token from cookies or Authorization header
    const token =
      req.cookies?.accessToken ||
      req.header("Authorization")?.replace("Bearer ", "");

    if (!token) {
      return res.status(401).json(new ApiError(401, "Unauthorized request"));
    }

    // Verify JWT token
    const decodedToken = jwt.verify(
      token,
      process.env.ACCESS_TOKEN_SECRET as string
    );

    if (typeof decodedToken === "object" && decodedToken !== null) {
      // Fetch user from database with soft-delete check
      const user = await prisma.user.findFirst({
        where: { id: decodedToken.userId, deletedAt: null },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          tokenVersion: true,
          patient: {
            select: {
              id: true,
            },
          },
          doctor: {
            select: {
              id: true,
            },
          },
          admin: {
            select: {
              id: true,
              permissions: true,
            },
          },
        },
      });

      if (!user) {
        return res.status(401).json(new ApiError(401, "Account not found or has been deactivated"));
      }

      // Validate token version to ensure token hasn't been invalidated
      if (
        decodedToken.tokenVersion !== undefined &&
        decodedToken.tokenVersion !== user.tokenVersion
      ) {
        return res
          .status(401)
          .json(new ApiError(401, "Token has been invalidated, please login again"));
      }

      // Attach user data to request object
      req.user = {
        ...user,
        patient: user.patient || null,
        doctor: user.doctor || null,
        admin: user.admin || null,
      };

      next();
    } else {
      return res.status(401).json(new ApiError(401, "Invalid token"));
    }
  } catch (err) {
    return res
      .status(500)
      .json(new ApiError(500, "Error in authentication", [err]));
  }
};
