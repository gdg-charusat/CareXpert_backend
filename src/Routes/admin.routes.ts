import { Router } from "express";
import {
    listAllUsers,
    verifyDoctor,
    getDashboardStats,
    softDeleteUser,
    changeUserRole,
} from "../controllers/admin.controller";
import { isAdmin } from "../utils/helper";
import { isAuthenticated } from "../middlewares/auth.middleware";
import { globalRateLimiter } from "../middlewares/rateLimiter.middleware";

const router = Router();

router.use(isAuthenticated, globalRateLimiter, isAdmin);

router.get("/users", listAllUsers);
router.patch("/verify-doctor/:doctorUserId", verifyDoctor);
router.get("/dashboard-stats", getDashboardStats);
router.delete("/users/:userId", softDeleteUser);
router.patch("/users/:userId/role", changeUserRole);

export default router;
