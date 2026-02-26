import jwt from "jsonwebtoken";
import prisma from "../utils/prismClient";
import { ApiError } from "../utils/ApiError";

export const isAuthenticated = async (req: any, res: any, next: any) => {
  try {
    const token =
      req.cookies?.accessToken ||
      req.header("Authorization")?.replace("Bearer ", "");

    if (!token) {
      return res.status(401).json(new ApiError(401, "Unauthorized request"));
    }

    const decodedToken = jwt.verify(
      token,
      process.env.ACCESS_TOKEN_SECRET as string
    );

    if (typeof decodedToken === "object" && decodedToken !== null) {
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

      if (
        decodedToken.tokenVersion !== undefined &&
        decodedToken.tokenVersion !== user.tokenVersion
      ) {
        return res
          .status(401)
          .json(new ApiError(401, "Token has been invalidated, please login again"));
      }

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
      .json(new ApiError(500, "error in authenticated", [err]));
  }
};
