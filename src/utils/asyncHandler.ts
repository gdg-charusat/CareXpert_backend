import { Request, Response, NextFunction } from "express";
import { ApiError } from "./ApiError";

/**
 * Async handler wrapper to catch errors in async route handlers
 * Prevents unhandled promise rejections and ensures consistent error handling
 * 
 * @param fn - Async function to wrap
 * @returns Express middleware function
 */
export const asyncHandler = (
    fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) => {
    return async (req: Request, res: Response, next: NextFunction) => {
        try {
            await fn(req, res, next);
        } catch (error) {
            console.error("Async error:", error);

            // If error is already an ApiError, use its status and message
            if (error instanceof ApiError) {
                return res.status(error.statusCode).json(error);
            }

            // For unknown errors, return 500
            return res.status(500).json(
                new ApiError(500, "Internal server error", [
                    error instanceof Error ? error.message : "Unknown error"
                ])
            );
        }
    };
};
