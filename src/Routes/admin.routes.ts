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

const router = Router();

router.get("/users", isAuthenticated, isAdmin, listAllUsers);
router.patch("/verify-doctor/:doctorUserId", isAuthenticated, isAdmin, verifyDoctor);
router.get("/dashboard-stats", isAuthenticated, isAdmin, getDashboardStats);
router.delete("/users/:userId", isAuthenticated, isAdmin, softDeleteUser);
router.patch("/users/:userId/role", isAuthenticated, isAdmin, changeUserRole);

export default router;
