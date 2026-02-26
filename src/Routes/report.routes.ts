import { Router, Request, Response, NextFunction } from "express";
import { isAuthenticated } from "../middlewares/auth.middleware";
import { authorizeReportAccess } from "../middlewares/authorization.middleware";
import { createReport, getReport } from "../controllers/report.controller";
import { upload2 } from "../middlewares/upload";
import { globalRateLimiter } from "../middlewares/rateLimiter.middleware";

const router = Router();

const asyncHandler =
  <T extends (req: Request, res: Response, next: NextFunction) => Promise<any>>(
    fn: T
  ) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

router.post(
  "/",
  isAuthenticated,
  globalRateLimiter,
  upload2.single("report"),
  asyncHandler(createReport)
);

router.get(
  "/:id",
  isAuthenticated,
  globalRateLimiter,
  authorizeReportAccess,
  asyncHandler(getReport)
);

export default router;
