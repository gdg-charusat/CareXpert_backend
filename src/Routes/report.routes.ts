import { Router, Request, Response, NextFunction } from "express";
import { isAuthenticated } from "../middlewares/auth.middleware";
import { createReport, getReport } from "../controllers/report.controller";
import { upload2 } from "../middlewares/upload";
import { globalRateLimiter } from "../middlewares/rateLimiter";

// Using the global Request type from helper.ts

const router = Router();

// Async handler wrapper
const asyncHandler =
  <T extends (req: Request, res: Response, next: NextFunction) => Promise<any>>(
    fn: T
  ) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

// Upload a new report
router.post(
  "/",
  isAuthenticated,
  globalRateLimiter,
  upload2.single("report"),
  asyncHandler(createReport)
);

// Get a report by ID
router.get("/:id", isAuthenticated, globalRateLimiter, asyncHandler(getReport));

// Error handling is now done globally in index.ts

export default router;
