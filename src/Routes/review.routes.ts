import { Router } from "express";
import { createReview, deleteReview, getMyReviews, getDoctorReviews, updateReview } from "../controllers/review.controller";
import { isAuthenticated } from "../middlewares/auth.middleware";
import { globalRateLimiter } from "../middlewares/rateLimiter.middleware";
import { isPatient, isDoctor } from "../utils/helper";

const router = Router();

router.post("/", isAuthenticated, globalRateLimiter, isPatient, createReview);
router.get("/my", isAuthenticated, globalRateLimiter, isPatient, getMyReviews);
router.get("/doctor", isAuthenticated, globalRateLimiter, isDoctor, getDoctorReviews);
router.patch("/:reviewId", isAuthenticated, globalRateLimiter, isPatient, updateReview);
router.delete("/:reviewId", isAuthenticated, globalRateLimiter, deleteReview);

export default router;
